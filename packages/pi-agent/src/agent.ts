import type { LLMProvider, ChatMessage, ChatOptions, StreamChunk, ToolDefinition } from '@om/pi-ai';
import type { AgentConfig, AgentEvent, AgentState, AgentTool, AgentContext, AgentMessage } from './types.js';
import { toToolDefinition } from './types.js';

/**
 * Stateful AI Agent with tool execution, event streaming, and conversation management.
 *
 * Usage:
 *   const agent = new Agent({ systemPrompt: '...', provider, tools: [...] });
 *   for await (const event of agent.prompt('Hello')) { ... }
 */
export class Agent {
  private config: AgentConfig;
  private state: AgentState;
  private tools: Map<string, AgentTool>;
  private provider: LLMProvider;
  private context: AgentContext;

  constructor(config: AgentConfig) {
    this.config = config;
    this.provider = config.provider;
    this.tools = new Map((config.tools ?? []).map((t) => [t.name, t]));
    this.context = {
      agentId: config.agentId ?? crypto.randomUUID(),
      variables: new Map(),
    };
    this.state = {
      status: 'idle',
      currentTurn: 0,
      maxTurns: config.maxTurns ?? 20,
      messages: [
        { role: 'system', content: config.systemPrompt, timestamp: Date.now() },
      ],
    };
  }

  get id(): string { return this.context.agentId; }
  get currentState(): Readonly<AgentState> { return this.state; }
  get messageHistory(): ReadonlyArray<AgentMessage> { return this.state.messages; }

  /** Set the LLM provider at runtime (for model switching) */
  setProvider(provider: LLMProvider): void {
    this.provider = provider;
  }

  /** Add a tool at runtime */
  addTool(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
  }

  /** Remove a tool */
  removeTool(name: string): void {
    this.tools.delete(name);
  }

  /** Send a user message and stream agent events */
  async *prompt(userMessage: string): AsyncGenerator<AgentEvent> {
    this.state.messages.push({ role: 'user', content: userMessage, timestamp: Date.now() });
    this.state.status = 'running';
    this.state.currentTurn = 0;

    yield { type: 'agent_start', agentId: this.id };

    try {
      while (this.state.currentTurn < this.state.maxTurns) {
        this.state.currentTurn++;
        yield { type: 'turn_start', turnNumber: this.state.currentTurn };

        const turnEvents = yield* this.executeTurn();
        yield { type: 'turn_end', turnNumber: this.state.currentTurn };

        // If no tool calls in this turn, we're done
        const hasToolCalls = turnEvents.some((e) => e.type === 'tool_call_start');
        if (!hasToolCalls) break;
      }

      this.state.status = 'idle';
      yield { type: 'agent_end', agentId: this.id, totalTurns: this.state.currentTurn };
    } catch (error) {
      this.state.status = 'error';
      this.state.lastError = error instanceof Error ? error : new Error(String(error));
      yield { type: 'error', error: this.state.lastError };
      yield { type: 'agent_end', agentId: this.id, totalTurns: this.state.currentTurn };
    }
  }

  /** Execute a single turn: LLM call + tool execution */
  private async *executeTurn(): AsyncGenerator<AgentEvent, AgentEvent[]> {
    const chatMessages: ChatMessage[] = this.state.messages.map((m) => ({
      role: m.role,
      content: m.content,
      toolCallId: m.toolCallId,
    }));

    const toolDefs: ToolDefinition[] = Array.from(this.tools.values()).map(toToolDefinition);

    const options: ChatOptions = {
      model: this.config.model,
      temperature: this.config.temperature,
      tools: toolDefs.length > 0 ? toolDefs : undefined,
      stream: true,
    };

    let fullText = '';
    const pendingToolCalls: Array<{ id: string; name: string; arguments: string }> = [];
    const events: AgentEvent[] = [];

    for await (const chunk of this.provider.chat(chatMessages, options)) {
      switch (chunk.type) {
        case 'text':
          fullText += chunk.content;
          yield { type: 'text_delta', content: chunk.content };
          events.push({ type: 'text_delta', content: chunk.content });
          break;

        case 'tool_call':
          pendingToolCalls.push({
            id: chunk.toolCall.id,
            name: chunk.toolCall.function.name,
            arguments: chunk.toolCall.function.arguments,
          });
          break;

        case 'done':
          break;

        case 'error':
          throw chunk.error;
      }
    }

    // Record assistant message
    this.state.messages.push({
      role: 'assistant',
      content: fullText,
      toolCalls: pendingToolCalls.length > 0 ? pendingToolCalls : undefined,
      timestamp: Date.now(),
    });

    if (fullText) {
      yield { type: 'text_complete', content: fullText };
      events.push({ type: 'text_complete', content: fullText });
    }

    // Execute tool calls
    for (const tc of pendingToolCalls) {
      yield { type: 'tool_call_start', toolName: tc.name, toolCallId: tc.id };
      events.push({ type: 'tool_call_start', toolName: tc.name, toolCallId: tc.id });

      const tool = this.tools.get(tc.name);
      let result: string;
      let error: string | undefined;

      if (!tool) {
        result = `Error: Unknown tool "${tc.name}"`;
        error = `Unknown tool: ${tc.name}`;
      } else {
        try {
          const args = JSON.parse(tc.arguments);
          result = await tool.execute(args, this.context);
        } catch (e) {
          result = `Error: ${e instanceof Error ? e.message : String(e)}`;
          error = result;
        }
      }

      // Record tool result
      this.state.messages.push({
        role: 'tool',
        content: result,
        toolCallId: tc.id,
        timestamp: Date.now(),
      });

      yield { type: 'tool_call_end', toolName: tc.name, toolCallId: tc.id, result, error };
      events.push({ type: 'tool_call_end', toolName: tc.name, toolCallId: tc.id, result, error });
    }

    return events;
  }

  /** Clear conversation history */
  reset(): void {
    this.state = {
      ...this.state,
      status: 'idle',
      currentTurn: 0,
      messages: [
        { role: 'system', content: this.config.systemPrompt, timestamp: Date.now() },
      ],
      lastError: undefined,
    };
  }
}
