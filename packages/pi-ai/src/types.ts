// ─── LLM Provider Types ───

export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: Role;
  content: string;
  toolCallId?: string;
  name?: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  stream?: boolean;
  systemPrompt?: string;
}

// ─── Streaming ───

export type StreamChunk =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; toolCall: ToolCall }
  | { type: 'done'; finishReason: string }
  | { type: 'error'; error: Error };

// ─── Provider Interface ───

export interface LLMProvider {
  readonly name: string;
  readonly defaultModel: string;

  /** Stream a chat completion */
  chat(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<StreamChunk>;

  /** List available models */
  models(): Promise<string[]>;
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
}

// ─── Registry ───

export interface ProviderRegistry {
  register(name: string, factory: (config: ProviderConfig) => LLMProvider): void;
  create(name: string, config: ProviderConfig): LLMProvider;
  listProviders(): string[];
}
