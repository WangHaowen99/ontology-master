import type { OntologyModel, ValidationResult } from "@om/ontology";
import type { SessionRef } from "@pi-gui/session-driver";

export type OntologySourceKind =
  | "csv"
  | "excel"
  | "json"
  | "xml"
  | "yaml"
  | "pdf"
  | "docx"
  | "markdown"
  | "sqlite"
  | "postgres"
  | "mysql";

export type OntologySourceStatus = "ready" | "processing" | "failed";
export type OntologyModelingStatus = "idle" | "ready" | "running" | "waitingReview" | "completed" | "failed";
export type OntologyPhaseId = "precheck" | "interview" | "cqs" | "extract" | "review" | "finalize";
export type OntologyPhaseStatus = "pending" | "running" | "completed" | "failed";
export type OntologyMessageRole = "user" | "assistant" | "system";
export type OntologyExportFormat = "turtle" | "rdfxml" | "owlxml" | "jsonld";

export interface OntologyImportFileInput {
  readonly name: string;
  readonly path: string;
  readonly sizeBytes: number;
}

export interface OntologyDatabaseConnectionInput {
  readonly kind: "postgres" | "mysql" | "sqlite";
  readonly host: string;
  readonly port: string;
  readonly database: string;
  readonly username: string;
  readonly password?: string;
  readonly filePath: string;
}

export interface ImportedOntologySource {
  readonly id: string;
  readonly name: string;
  readonly kind: OntologySourceKind;
  readonly path?: string;
  readonly sizeBytes: number;
  readonly importedAt: string;
  readonly tableCount: number;
  readonly entityCount: number;
  readonly textSegmentCount: number;
  readonly summary: string;
  readonly status: OntologySourceStatus;
  readonly errorMessage?: string;
}

export interface OntologyPhaseRun {
  readonly id: OntologyPhaseId;
  readonly label: string;
  readonly status: OntologyPhaseStatus;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly summary?: string;
  readonly errorMessage?: string;
}

export interface OntologyWorkbenchMessage {
  readonly id: string;
  readonly role: OntologyMessageRole;
  readonly content: string;
  readonly timestamp: string;
  readonly toolCalls?: readonly { readonly name: string; readonly args: string; readonly result?: string }[];
}

export interface OntologyExportSummary {
  readonly title: string;
  readonly iri: string;
  readonly classCount: number;
  readonly objectPropertyCount: number;
  readonly dataPropertyCount: number;
  readonly individualCount: number;
  readonly axiomCount: number;
  readonly validationErrors: readonly string[];
  readonly lastModified: string;
}

export interface OntologyWorkbenchState {
  readonly sources: readonly ImportedOntologySource[];
  readonly selectedSourceIds: readonly string[];
  readonly modelingSessionRef: SessionRef | null;
  readonly modelingStatus: OntologyModelingStatus;
  readonly activePhase: OntologyPhaseId | null;
  readonly phaseRuns: readonly OntologyPhaseRun[];
  readonly messages: readonly OntologyWorkbenchMessage[];
  readonly ontologyModel: OntologyModel | null;
  readonly exportSummary: OntologyExportSummary | null;
  readonly validationResult: ValidationResult | null;
  readonly isExporting: boolean;
  readonly isValidating: boolean;
  readonly isReasoning: boolean;
  readonly exportPreview: string | null;
  readonly lastError: string | null;
  readonly revision: number;
}

export const ONTOLOGY_PHASE_LABELS: Record<OntologyPhaseId, string> = {
  precheck: "数据预检",
  interview: "建模访谈",
  cqs: "能力问题",
  extract: "实体抽取",
  review: "专家审查",
  finalize: "本体定稿",
};

export const ONTOLOGY_PHASE_ORDER: readonly OntologyPhaseId[] = [
  "precheck",
  "interview",
  "cqs",
  "extract",
  "review",
  "finalize",
];

export function createEmptyOntologyWorkbenchState(): OntologyWorkbenchState {
  return {
    sources: [],
    selectedSourceIds: [],
    modelingSessionRef: null,
    modelingStatus: "idle",
    activePhase: null,
    phaseRuns: ONTOLOGY_PHASE_ORDER.map((id) => ({ id, label: ONTOLOGY_PHASE_LABELS[id], status: "pending" })),
    messages: [],
    ontologyModel: null,
    exportSummary: null,
    validationResult: null,
    isExporting: false,
    isValidating: false,
    isReasoning: false,
    exportPreview: null,
    lastError: null,
    revision: 0,
  };
}

export function getReadySelectedSourceIds(state: OntologyWorkbenchState): string[] {
  const readyIds = new Set(state.sources.filter((source) => source.status === "ready").map((source) => source.id));
  return state.selectedSourceIds.filter((id) => readyIds.has(id));
}
