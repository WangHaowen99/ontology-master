import type { LLMProvider, ProviderConfig, ProviderRegistry as IProviderRegistry } from '../types.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';

type ProviderFactory = (config: ProviderConfig) => LLMProvider;

/**
 * Registry for LLM providers — supports runtime switching and custom provider registration.
 */
export class ProviderRegistryImpl implements IProviderRegistry {
  private factories = new Map<string, ProviderFactory>();

  constructor() {
    // Register built-in providers
    this.register('openai', (config) => new OpenAIProvider(config, 'openai'));
    this.register('deepseek', (config) =>
      new OpenAIProvider(
        { ...config, baseUrl: config.baseUrl ?? 'https://api.deepseek.com/v1', defaultModel: config.defaultModel ?? 'deepseek-chat' },
        'deepseek',
      )
    );
    this.register('anthropic', (config) => new AnthropicProvider(config));
  }

  register(name: string, factory: ProviderFactory): void {
    this.factories.set(name, factory);
  }

  create(name: string, config: ProviderConfig): LLMProvider {
    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(`Unknown provider: ${name}. Available: ${this.listProviders().join(', ')}`);
    }
    return factory(config);
  }

  listProviders(): string[] {
    return Array.from(this.factories.keys());
  }
}

/** Singleton registry instance */
export const registry = new ProviderRegistryImpl();
