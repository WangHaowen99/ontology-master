import type { ChatMessage, ChatOptions, LLMProvider, StreamChunk, ProviderConfig } from '../types.js';

/**
 * Anthropic Claude provider — uses the Messages API with streaming.
 */
export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  readonly defaultModel: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey;
    this.defaultModel = config.defaultModel ?? 'claude-sonnet-4-20250514';
    this.baseUrl = config.baseUrl ?? 'https://api.anthropic.com/v1';
  }

  async *chat(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<StreamChunk> {
    const model = options?.model ?? this.defaultModel;
    const systemPrompt = options?.systemPrompt ?? '';

    const anthropicMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: m.content,
      }));

    const body: Record<string, unknown> = {
      model,
      max_tokens: options?.maxTokens ?? 4096,
      messages: anthropicMessages,
      stream: true,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    if (options?.tools) {
      body.tools = options.tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      yield { type: 'error', error: new Error(`Anthropic API error: ${response.status} ${text}`) };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', error: new Error('No response body') };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') {
          yield { type: 'done', finishReason: 'end_turn' };
          return;
        }

        try {
          const event = JSON.parse(data);

          if (event.type === 'content_block_delta') {
            if (event.delta?.type === 'text_delta') {
              yield { type: 'text', content: event.delta.text };
            } else if (event.delta?.type === 'input_json_delta') {
              // Tool use input delta — handled in content_block_stop
            }
          }

          if (event.type === 'content_block_start') {
            if (event.content_block?.type === 'tool_use') {
              yield {
                type: 'tool_call',
                toolCall: {
                  id: event.content_block.id,
                  type: 'function',
                  function: {
                    name: event.content_block.name,
                    arguments: '{}',
                  },
                },
              };
            }
          }

          if (event.type === 'message_stop') {
            yield { type: 'done', finishReason: event.message?.stop_reason ?? 'end_turn' };
          }
        } catch {
          // skip non-JSON lines
        }
      }
    }
  }

  async models(): Promise<string[]> {
    return [
      'claude-opus-4-20250918',
      'claude-sonnet-4-20250514',
      'claude-haiku-3-5-20241022',
    ];
  }
}
