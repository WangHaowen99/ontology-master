import type { OntologyModel, IngestedSchema } from '@om/ontology';
import { validateOntology } from '@om/ontology';
import { createModelingTools } from './tools/modeling-tools.js';
import OpenAI from 'openai';

// ─── Phase Definitions ───

export type PhaseName = 'precheck' | 'interview' | 'cqs' | 'extract' | 'review' | 'finalize';

export interface PhaseResult {
  phase: PhaseName;
  status: 'completed' | 'skipped' | 'failed';
  summary: string;
  duration: number;
}

export interface PipelineConfig {
  provider: 'openai' | 'deepseek' | 'anthropic';
  apiKey: string;
  baseUrl?: string;
  model?: string;
  language?: 'zh' | 'en';
}

const SYSTEM_PROMPT_ZH = `你是一位专业的本体建模大师。你的任务是根据提供的数据源，帮助用户构建高质量的 OWL 本体模型。

你需要：
1. 分析数据源的结构和内容
2. 识别核心概念（类）和关系（属性）
3. 使用工具创建本体元素
4. 确保本体的一致性和完整性

使用 PascalCase 命名类（如 Person、Book），camelCase 命名属性（如 hasName、borrows）。
每个类和属性都应有清晰的中文描述。`;

const SYSTEM_PROMPT_EN = `You are an expert ontology modeling master. Your task is to help users build high-quality OWL ontology models from provided data sources.

Use PascalCase for class names (e.g., Person, Book), camelCase for property names (e.g., hasName, borrows).`;

/**
 * Multi-phase AI ontology modeling pipeline.
 * Uses OpenAI-compatible API directly (no pi-agent dependency).
 */
export class ModelingPipeline {
  private client: OpenAI;
  private config: PipelineConfig;

  constructor(config: PipelineConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl ?? (config.provider === 'deepseek' ? 'https://api.deepseek.com/v1' : undefined),
    });
  }

  /** Run a single phase with AI assistance */
  async runPhase(
    phase: PhaseName,
    model: OntologyModel,
    schemas: IngestedSchema[],
    userMessage?: string,
  ): Promise<{ model: OntologyModel; response: string }> {
    const systemPrompt = this.config.language === 'zh' ? SYSTEM_PROMPT_ZH : SYSTEM_PROMPT_EN;
    const tools = createModelingTools(model, schemas);
    const phasePrompt = userMessage ?? this.getPhasePrompt(phase, schemas);

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: phasePrompt },
    ];

    const toolDefs: OpenAI.ChatCompletionTool[] = tools.map((t) => ({
      type: 'function' as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));

    // Auto-execute tool loop (max 10 turns)
    for (let turn = 0; turn < 10; turn++) {
      const response = await this.client.chat.completions.create({
        model: this.config.model ?? (this.config.provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o'),
        messages,
        tools: toolDefs.length > 0 ? toolDefs : undefined,
        temperature: 0.3,
      });

      const choice = response.choices[0];
      if (!choice) break;

      const assistantMessage = choice.message;
      messages.push(assistantMessage);

      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        return { model, response: assistantMessage.content ?? '' };
      }

      // Execute tool calls
      for (const tc of assistantMessage.tool_calls) {
        const tool = tools.find((t) => t.name === tc.function.name);
        let result: string;
        if (tool) {
          try {
            const args = JSON.parse(tc.function.arguments);
            result = await tool.execute(args, { agentId: 'cli', variables: new Map() });
          } catch (e) {
            result = `Error: ${e instanceof Error ? e.message : String(e)}`;
          }
        } else {
          result = `Unknown tool: ${tc.function.name}`;
        }
        messages.push({ role: 'tool', content: result, tool_call_id: tc.id });
      }
    }

    return { model, response: 'Max turns reached' };
  }

  /** Run the full pipeline automatically */
  async runFull(model: OntologyModel, schemas: IngestedSchema[]): Promise<OntologyModel> {
    const phases: PhaseName[] = ['precheck', 'cqs', 'extract', 'finalize'];
    for (const phase of phases) {
      const result = await this.runPhase(phase, model, schemas);
      model = result.model;
    }
    validateOntology(model);
    return model;
  }

  private getPhasePrompt(phase: PhaseName, schemas: IngestedSchema[]): string {
    const info = schemas.map((s) => `${s.source} (${s.type})`).join(', ');
    switch (phase) {
      case 'precheck':
        return `分析数据源 ${info} 的质量和结构，给出本体建模建议。使用 get_data_schema 获取详情。`;
      case 'interview':
        return `基于数据源分析，提出关于领域范围的问题。`;
      case 'cqs':
        return `根据数据源 ${info} 生成 5-10 个能力问题。`;
      case 'extract':
        return `分析数据源 ${info}，使用 get_data_schema 获取详情，然后用 create_class、create_object_property、create_data_property 工具构建本体。`;
      case 'review':
        return `审查本体模型，使用 list_classes 和 get_ontology_stats 检查一致性。`;
      case 'finalize':
        return `执行最终检查，确保所有元素正确定义。`;
    }
  }
}
