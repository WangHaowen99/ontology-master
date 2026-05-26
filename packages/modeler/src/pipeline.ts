import type { LLMProvider, ProviderConfig } from '@om/pi-ai';
import { registry } from '@om/pi-ai';
import { Agent } from '@om/pi-agent';
import type { AgentEvent } from '@om/pi-agent';
import type { OntologyModel, IngestedSchema } from '@om/ontology';
import { validateOntology } from '@om/ontology';
import { createModelingTools } from './tools/modeling-tools.js';

// ─── Phase Definitions ───

export type PhaseName = 'precheck' | 'interview' | 'cqs' | 'extract' | 'review' | 'finalize';

export interface PhaseResult {
  phase: PhaseName;
  status: 'completed' | 'skipped' | 'failed';
  summary: string;
  duration: number;
}

export interface PipelineConfig {
  provider: string;
  providerConfig: ProviderConfig;
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

You need to:
1. Analyze the structure and content of data sources
2. Identify core concepts (classes) and relationships (properties)
3. Use tools to create ontology elements
4. Ensure ontology consistency and completeness

Use PascalCase for class names (e.g., Person, Book), camelCase for property names (e.g., hasName, borrows).
Every class and property should have a clear description.`;

/**
 * Multi-phase AI ontology modeling pipeline.
 *
 * Phases:
 * 1. Precheck — data quality analysis
 * 2. Interview — domain scope confirmation
 * 3. CQs — competency question generation
 * 4. Extract — entity/relation extraction + class creation
 * 5. Review — human review of AI suggestions
 * 6. Finalize — consistency check + export
 */
export class ModelingPipeline {
  private provider: LLMProvider;
  private language: 'zh' | 'en';

  constructor(private config: PipelineConfig) {
    this.provider = registry.create(config.provider, config.providerConfig);
    this.language = config.language ?? 'zh';
  }

  /** Run a single interactive phase */
  async *runPhase(
    phase: PhaseName,
    model: OntologyModel,
    schemas: IngestedSchema[],
    userMessage?: string,
  ): AsyncGenerator<AgentEvent> {
    const systemPrompt = this.language === 'zh' ? SYSTEM_PROMPT_ZH : SYSTEM_PROMPT_EN;
    const tools = createModelingTools(model, schemas);

    const phasePrompt = this.getPhasePrompt(phase, schemas);
    const fullPrompt = userMessage ?? phasePrompt;

    const agent = new Agent({
      systemPrompt,
      tools,
      provider: this.provider,
      model: this.config.model,
      temperature: 0.3,
    });

    yield* agent.prompt(fullPrompt);
  }

  /** Auto-run the full pipeline (non-interactive) */
  async *runFull(
    model: OntologyModel,
    schemas: IngestedSchema[],
  ): AsyncGenerator<AgentEvent & { phase?: PhaseName }> {
    const phases: PhaseName[] = ['precheck', 'cqs', 'extract', 'finalize'];

    for (const phase of phases) {
      for await (const event of this.runPhase(phase, model, schemas)) {
        yield { ...event, phase };
      }
    }

    // Run validation
    const validation = validateOntology(model);
    if (!validation.valid) {
      yield {
        type: 'text_complete',
        content: `Validation warnings: ${validation.errors.map((e) => e.message).join('; ')}`,
        phase: 'finalize',
      };
    }
  }

  /** Switch LLM provider at runtime */
  switchProvider(name: string, config: ProviderConfig): void {
    this.provider = registry.create(name, config);
  }

  private getPhasePrompt(phase: PhaseName, schemas: IngestedSchema[]): string {
    const schemaInfo = schemas.map((s) => `${s.source} (${s.type})`).join(', ');

    switch (phase) {
      case 'precheck':
        return `请分析以下数据源的质量和结构：${schemaInfo}。使用 get_data_schema 工具获取详细信息，然后给出数据质量报告和本体建模建议。`;

      case 'interview':
        return `基于数据源分析结果，请向我提出关于领域范围、核心概念和业务规则的问题，以便更好地理解本体需求。`;

      case 'cqs':
        return `请根据数据源 ${schemaInfo} 生成 5-10 个能力问题（Competency Questions），这些问题定义了本体应该能够回答的关键查询。`;

      case 'extract':
        return `请分析数据源 ${schemaInfo}，识别核心实体和关系。使用 get_data_schema 获取数据详情，然后使用 create_class、create_object_property、create_data_property 等工具构建本体模型。`;

      case 'review':
        return `请审查当前本体模型的状态。使用 get_ontology_stats 和 list_classes 获取信息，检查是否有遗漏或不一致之处。`;

      case 'finalize':
        return `本体建模即将完成。请执行最终检查，确保所有类、属性和关系都已正确定义。使用 get_ontology_stats 查看统计信息。`;
    }
  }
}
