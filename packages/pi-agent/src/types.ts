import type { ToolDefinition } from '@om/pi-ai';

// ─── Agent Events ───

export type AgentEvent =
  | { type: 'agent_start'; agentId: string }
  | { type: 'agent_end'; agentId: string; totalTurns: number }
  | { type: 'turn_start'; turnNumber: number }
  | { type: 'turn_end'; turnNumber: number }
  | { type: 'text_delta'; content: string }
  | { type: 'text_complete'; content: string }
  | { type: 'tool_call_start'; toolName: string; toolCallId: string }
  | { type: 'tool_call_end'; toolName: string; toolCallId: string; result: string; error?: string }
  | { type: 'error'; error: Error }
  | { type: 'thinking'; content: string };

// ─── Agent Tools ───

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(args: Record<string, unknown>, context: AgentContext): Promise<string>;
}

// ─── Agent State ───

export type AgentStatus = 'idle' | 'running' | 'error' | 'waiting_for_tool';

export interface AgentState {
  status: AgentStatus;
  currentTurn: number;
  maxTurns: number;
  messages: AgentMessage[];
  lastError?: Error;
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: Array<{ id: string; name: string; arguments: string }>;
  toolCallId?: string;
  timestamp: number;
}

// ─── Agent Context ───

export interface AgentContext {
  agentId: string;
  variables: Map<string, unknown>;
  abortSignal?: AbortSignal;
}

// ─── Agent Config ───

export interface AgentConfig {
  agentId?: string;
  systemPrompt: string;
  tools?: AgentTool[];
  maxTurns?: number;
  provider: import('@om/pi-ai').LLMProvider;
  model?: string;
  temperature?: number;
}

/** Convert AgentTool to LLM ToolDefinition */
export function toToolDefinition(tool: AgentTool): ToolDefinition {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}
