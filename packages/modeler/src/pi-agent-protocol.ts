import {
  createOntology,
  makeIRI,
  type CompetencyQuestion,
  type DataType,
  type Individual,
  type OntologyModel,
  type OwlClass,
  type OwlDataProperty,
  type OwlObjectProperty,
} from "@om/ontology";

export type PiAgentModelingPhase = "precheck" | "interview" | "cqs" | "extract" | "review" | "finalize";

export interface PiAgentModelingPromptSource {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly summary: string;
}

export interface BuildPiAgentModelingPromptInput {
  readonly phase: PiAgentModelingPhase;
  readonly sources: readonly PiAgentModelingPromptSource[];
  readonly userRequirement?: string;
}

export interface PiAgentOntologyClassJson {
  readonly name: string;
  readonly label?: string;
  readonly description?: string;
  readonly superClasses?: readonly string[];
}

export interface PiAgentOntologyObjectPropertyJson {
  readonly name: string;
  readonly label?: string;
  readonly description?: string;
  readonly domain: string;
  readonly range: string;
}

export interface PiAgentOntologyDataPropertyJson {
  readonly name: string;
  readonly label?: string;
  readonly description?: string;
  readonly domain: string;
  readonly range?: DataType;
}

export interface PiAgentOntologyIndividualJson {
  readonly name: string;
  readonly label?: string;
  readonly description?: string;
  readonly classes?: readonly string[];
}

export interface PiAgentOntologyCompetencyQuestionJson {
  readonly id?: string;
  readonly question: string;
  readonly expectedAnswerType?: string;
  readonly relevantClasses?: readonly string[];
  readonly relevantProperties?: readonly string[];
  readonly sparqlQuery?: string;
}

export interface PiAgentOntologyJson {
  readonly title: string;
  readonly iri: string;
  readonly prefix?: string;
  readonly description?: string;
  readonly classes: readonly PiAgentOntologyClassJson[];
  readonly objectProperties: readonly PiAgentOntologyObjectPropertyJson[];
  readonly dataProperties: readonly PiAgentOntologyDataPropertyJson[];
  readonly individuals: readonly PiAgentOntologyIndividualJson[];
  readonly competencyQuestions: readonly PiAgentOntologyCompetencyQuestionJson[];
  readonly notes: readonly string[];
}

const PHASE_LABELS: Record<PiAgentModelingPhase, string> = {
  precheck: "数据预检",
  interview: "建模访谈",
  cqs: "能力问题",
  extract: "实体抽取",
  review: "专家审查",
  finalize: "本体定稿",
};

const DEFAULT_PREFIX = "om";
const DEFAULT_DATATYPE: DataType = "xsd:string";
const ONTOLOGY_JSON_BLOCK = /```ontology-json\s*([\s\S]*?)```/g;

export function buildPiAgentModelingPrompt(input: BuildPiAgentModelingPromptInput): string {
  const sourceLines = input.sources.length > 0
    ? input.sources.map((source, index) =>
        `${index + 1}. ${source.name}（${source.kind}，id: ${source.id}）：${source.summary}`,
      ).join("\n")
    : "暂无已选择的数据源。请明确提示用户先导入数据。";
  const requirement = input.userRequirement?.trim() || "无额外补充要求。";

  return [
    "你正在通过 pi agent 执行本体建模。请作为专业本体建模师，用中文分析数据并构建 OWL 本体。",
    "",
    `当前阶段：${PHASE_LABELS[input.phase]}`,
    "",
    "已选择的数据源：",
    sourceLines,
    "",
    `用户补充要求：${requirement}`,
    "",
    "建模规则：",
    "- 类名使用 PascalCase，例如 Customer、Order。",
    "- 对象属性和数据属性使用 camelCase，例如 placesOrder、hasName。",
    "- 每个类、属性、能力问题都要有中文 label 或中文描述。",
    "- 优先抽取能解释数据结构和业务关系的核心类、对象属性、数据属性和能力问题。",
    "- 不要虚构无法从数据源或用户要求推断出的关键事实；不确定时写入 notes。",
    "",
    "请先给出简短中文说明，然后在回答末尾输出一个可解析的 ontology-json 代码块：",
    "```ontology-json",
    "{",
    '  "title": "中文本体名称",',
    '  "iri": "http://example.org/ontology",',
    '  "classes": [{ "name": "Customer", "label": "客户", "description": "..." }],',
    '  "objectProperties": [{ "name": "placesOrder", "label": "下单", "domain": "Customer", "range": "Order" }],',
    '  "dataProperties": [{ "name": "hasName", "label": "名称", "domain": "Customer", "range": "xsd:string" }],',
    '  "individuals": [],',
    '  "competencyQuestions": [{ "question": "某个客户有哪些订单？", "expectedAnswerType": "Order" }],',
    '  "notes": []',
    "}",
    "```",
  ].join("\n");
}

export function extractOntologyJsonBlock(text: string): string | null {
  let lastMatch: string | null = null;
  for (const match of text.matchAll(ONTOLOGY_JSON_BLOCK)) {
    lastMatch = match[1]?.trim() || null;
  }
  return lastMatch;
}

export function parseOntologyJsonBlock(jsonText: string): PiAgentOntologyJson {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`ontology-json 不是有效 JSON：${error instanceof Error ? error.message : String(error)}`);
  }

  if (!isRecord(raw)) {
    throw new Error("ontology-json 必须是对象");
  }

  const title = readRequiredString(raw, "title");
  const iri = readRequiredString(raw, "iri");
  const prefix = readOptionalString(raw, "prefix");
  const description = readOptionalString(raw, "description");

  return {
    title,
    iri,
    ...(prefix ? { prefix } : {}),
    ...(description ? { description } : {}),
    classes: readArray(raw, "classes").map(readClass),
    objectProperties: readArray(raw, "objectProperties").map(readObjectProperty),
    dataProperties: readArray(raw, "dataProperties").map(readDataProperty),
    individuals: readArray(raw, "individuals").map(readIndividual),
    competencyQuestions: readArray(raw, "competencyQuestions").map(readCompetencyQuestion),
    notes: readArray(raw, "notes").map((value) => typeof value === "string" ? value : JSON.stringify(value)),
  };
}

export function convertProtocolResultToOntology(result: PiAgentOntologyJson): OntologyModel {
  const prefix = result.prefix?.trim() || DEFAULT_PREFIX;
  const model = createOntology(result.iri, prefix, {
    title: result.title,
    description: result.description,
    language: "zh",
  });
  const namespace = `${result.iri}#`;

  model.classes.push(...result.classes.map((entry): OwlClass => ({
    type: "class",
    iri: makeIRI(namespace, entry.name),
    label: entry.label || entry.name,
    labels: entry.label ? { zh: entry.label } : undefined,
    description: entry.description,
    superClasses: (entry.superClasses ?? []).map((name) => makeIRI(namespace, name)),
    equivalentClasses: [],
    disjointWith: [],
    restrictions: [],
  })));

  model.objectProperties.push(...result.objectProperties.map((entry): OwlObjectProperty => ({
    type: "object-property",
    iri: makeIRI(namespace, entry.name),
    label: entry.label || entry.name,
    labels: entry.label ? { zh: entry.label } : undefined,
    description: entry.description,
    domain: [{ kind: "iri", iri: makeIRI(namespace, entry.domain) }],
    range: [{ kind: "iri", iri: makeIRI(namespace, entry.range) }],
    superProperties: [],
    characteristics: [],
  })));

  model.dataProperties.push(...result.dataProperties.map((entry): OwlDataProperty => ({
    type: "data-property",
    iri: makeIRI(namespace, entry.name),
    label: entry.label || entry.name,
    labels: entry.label ? { zh: entry.label } : undefined,
    description: entry.description,
    domain: [{ kind: "iri", iri: makeIRI(namespace, entry.domain) }],
    range: [entry.range || DEFAULT_DATATYPE],
    superProperties: [],
    characteristics: [],
  })));

  model.individuals.push(...result.individuals.map((entry): Individual => ({
    type: "individual",
    iri: makeIRI(namespace, entry.name),
    label: entry.label || entry.name,
    labels: entry.label ? { zh: entry.label } : undefined,
    description: entry.description,
    classIRIs: (entry.classes ?? []).map((name) => makeIRI(namespace, name)),
    propertyValues: [],
  })));

  model.competencyQuestions.push(...result.competencyQuestions.map((entry, index): CompetencyQuestion => ({
    id: entry.id || `cq-${index + 1}`,
    question: entry.question,
    expectedAnswerType: entry.expectedAnswerType || "未知",
    relevantClasses: (entry.relevantClasses ?? []).map((name) => makeIRI(namespace, name)),
    relevantProperties: (entry.relevantProperties ?? []).map((name) => makeIRI(namespace, name)),
    sparqlQuery: entry.sparqlQuery,
  })));

  return model;
}

function readClass(value: unknown): PiAgentOntologyClassJson {
  const record = requireRecord(value, "classes[]");
  return {
    name: readRequiredString(record, "name"),
    label: readOptionalString(record, "label"),
    description: readOptionalString(record, "description"),
    superClasses: readStringArray(record, "superClasses"),
  };
}

function readObjectProperty(value: unknown): PiAgentOntologyObjectPropertyJson {
  const record = requireRecord(value, "objectProperties[]");
  return {
    name: readRequiredString(record, "name"),
    label: readOptionalString(record, "label"),
    description: readOptionalString(record, "description"),
    domain: readRequiredString(record, "domain"),
    range: readRequiredString(record, "range"),
  };
}

function readDataProperty(value: unknown): PiAgentOntologyDataPropertyJson {
  const record = requireRecord(value, "dataProperties[]");
  const range = readOptionalString(record, "range");
  return {
    name: readRequiredString(record, "name"),
    label: readOptionalString(record, "label"),
    description: readOptionalString(record, "description"),
    domain: readRequiredString(record, "domain"),
    range: isDataType(range) ? range : DEFAULT_DATATYPE,
  };
}

function readIndividual(value: unknown): PiAgentOntologyIndividualJson {
  const record = requireRecord(value, "individuals[]");
  return {
    name: readRequiredString(record, "name"),
    label: readOptionalString(record, "label"),
    description: readOptionalString(record, "description"),
    classes: readStringArray(record, "classes"),
  };
}

function readCompetencyQuestion(value: unknown): PiAgentOntologyCompetencyQuestionJson {
  const record = requireRecord(value, "competencyQuestions[]");
  return {
    id: readOptionalString(record, "id"),
    question: readRequiredString(record, "question"),
    expectedAnswerType: readOptionalString(record, "expectedAnswerType"),
    relevantClasses: readStringArray(record, "relevantClasses"),
    relevantProperties: readStringArray(record, "relevantProperties"),
    sparqlQuery: readOptionalString(record, "sparqlQuery"),
  };
}

function readRequiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`ontology-json 缺少 ${key}`);
  }
  return value.trim();
}

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readArray(record: Record<string, unknown>, key: string): unknown[] {
  const value = record[key];
  return Array.isArray(value) ? value : [];
}

function readStringArray(record: Record<string, unknown>, key: string): string[] {
  return readArray(record, key).filter((value): value is string => typeof value === "string" && value.trim() !== "");
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`ontology-json ${label} 必须是对象`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDataType(value: string | undefined): value is DataType {
  return value === "xsd:string" ||
    value === "xsd:boolean" ||
    value === "xsd:integer" ||
    value === "xsd:int" ||
    value === "xsd:long" ||
    value === "xsd:float" ||
    value === "xsd:double" ||
    value === "xsd:decimal" ||
    value === "xsd:date" ||
    value === "xsd:dateTime" ||
    value === "xsd:time" ||
    value === "xsd:anyURI" ||
    value === "rdfs:Literal";
}
