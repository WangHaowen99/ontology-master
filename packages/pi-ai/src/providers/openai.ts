import type { ChatMessage, ChatOptions, LLMProvider, StreamChunk, ProviderConfig } from '../types.js';
import OpenAI from 'openai';

/**
 * OpenAI-compatible provider — works with OpenAI, DeepSeek, and any compatible API.
 */
export class OpenAIProvider implements LLMProvider {
  readonly name: string;
  readonly defaultModel: string;
  private client: OpenAI;

  constructor(config: ProviderConfig, name = 'openai') {
    this.name = name;
    this.defaultModel = config.defaultModel ?? 'gpt-4o';
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async *chat(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<StreamChunk> {
    const model = options?.model ?? this.defaultModel;

    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [];

    if (options?.systemPrompt) {
      openaiMessages.push({ role: 'system', content: options.systemPrompt });
    }

    for (const msg of messages) {
      if (msg.role === 'tool') {
        openaiMessages.push({
          role: 'tool',
          content: msg.content,
          tool_call_id: msg.toolCallId ?? '',
        });
      } else {
        openaiMessages.push({ role: msg.role, content: msg.content });
      }
    }

    const stream = await this.client.chat.completions.create({
      model,
      messages: openaiMessages,
      stream: true,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      tools: options?.tools as OpenAI.ChatCompletionTool[],
    });

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;

      const delta = choice.delta;

      if (delta?.content) {
        yield { type: 'text', content: delta.content };
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.function?.name) {
            yield {
              type: 'tool_call',
              toolCall: {
                id: tc.id ?? '',
                type: 'function',
                function: {
                  name: tc.function.name,
                  arguments: tc.function.arguments ?? '',
                },
              },
            };
          }
        }
      }

      if (choice.finish_reason) {
        yield { type: 'done', finishReason: choice.finish_reason };
      }
    }
  }

  async models(): Promise<string[]> {
    try {
      const response = await this.client.models.list();
      return response.data.map((m) => m.id);
    } catch {
      return [this.defaultModel];
    }
  }
}
