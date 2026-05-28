import { basename, extname } from "node:path";
import {
  buildPiAgentModelingPrompt,
  convertProtocolResultToOntology,
  extractOntologyJsonBlock,
  parseOntologyJsonBlock,
  type PiAgentModelingPromptSource,
} from "@om/modeler";
import { validateOntology, type OntologyModel, type ValidationResult } from "@om/ontology";
import type { SessionDriverEvent, SessionRef } from "@pi-gui/session-driver";
import type { AppStoreInternals } from "./app-store-internals";
import {
  createEmptyOntologyWorkbenchState,
  getReadySelectedSourceIds,
  ONTOLOGY_PHASE_LABELS,
  ONTOLOGY_PHASE_ORDER,
  type ImportedOntologySource,
  type OntologyDatabaseConnectionInput,
  type OntologyExportFormat,
  type OntologyExportSummary,
  type OntologyImportFileInput,
  type OntologyPhaseId,
  type OntologyPhaseRun,
  type OntologySourceKind,
  type OntologyWorkbenchMessage,
  type OntologyWorkbenchState,
} from "../src/ontology-workbench-state";

type OntologyStateListener = (state: OntologyWorkbenchState) => void;

const MODELING_SESSION_TITLE = "本体建模";

export class OntologyWorkbenchStore {
  private state = createEmptyOntologyWorkbenchState();
  private readonly listeners = new Set<OntologyStateListener>();
  private readonly assistantBuffers = new Map<string, string>();

  constructor(private readonly appStore: AppStoreInternals) {}

  getState(): OntologyWorkbenchState {
    return structuredClone(this.state);
  }

  subscribe(listener: OntologyStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  importFiles(files: readonly OntologyImportFileInput[]): OntologyWorkbenchState {
    const importedAt = new Date().toISOString();
    const sources = files.map((file) => createFileSource(file, importedAt));
    this.update({
      sources: [...this.state.sources, ...sources],
      selectedSourceIds: [...this.state.selectedSourceIds, ...sources.map((source) => source.id)],
      modelingStatus: this.state.modelingStatus === "idle" ? "ready" : this.state.modelingStatus,
      lastError: null,
    });
    return this.getState();
  }

  connectDatabase(input: OntologyDatabaseConnectionInput): OntologyWorkbenchState {
    const now = new Date().toISOString();
    const name = input.kind === "sqlite" ? basename(input.filePath || "SQLite 数据库") : `${input.host}:${input.port}/${input.database}`;
    const source: ImportedOntologySource = {
      id: nextId("db"),
      name,
      kind: input.kind,
      path: input.kind === "sqlite" ? input.filePath : undefined,
      sizeBytes: 0,
      importedAt: now,
      tableCount: 0,
      entityCount: 0,
      textSegmentCount: 0,
      summary: input.kind === "sqlite" ? "SQLite 数据库连接已登记，等待后续真实摄入。" : "数据库连接已登记，等待后续真实摄入。",
      status: "ready",
    };
    this.update({
      sources: [...this.state.sources, source],
      selectedSourceIds: [...this.state.selectedSourceIds, source.id],
      modelingStatus: this.state.modelingStatus === "idle" ? "ready" : this.state.modelingStatus,
      lastError: null,
    });
    return this.getState();
  }

  removeSource(id: string): OntologyWorkbenchState {
    this.update({
      sources: this.state.sources.filter((source) => source.id !== id),
      selectedSourceIds: this.state.selectedSourceIds.filter((sourceId) => sourceId !== id),
      lastError: null,
    });
    return this.getState();
  }

  selectSources(ids: readonly string[]): OntologyWorkbenchState {
    const knownReadyIds = new Set(this.state.sources.filter((source) => source.status === "ready").map((source) => source.id));
    this.update({
      selectedSourceIds: [...new Set(ids)].filter((id) => knownReadyIds.has(id)),
      modelingStatus: ids.length > 0 ? "ready" : this.state.modelingStatus,
      lastError: null,
    });
    return this.getState();
  }

  async startModeling(userRequirement?: string): Promise<OntologyWorkbenchState> {
    await this.appStore.initialize();
    const readySourceIds = getReadySelectedSourceIds(this.state);
    if (readySourceIds.length === 0) {
      this.update({ modelingStatus: "failed", lastError: "请先选择至少一个已就绪的数据源。" });
      return this.getState();
    }

    const workspaceId = this.appStore.state.selectedWorkspaceId;
    const workspace = this.appStore.workspaceRefFromState(workspaceId);
    if (!workspace) {
      this.update({ modelingStatus: "failed", lastError: "请先打开一个工作区。" });
      return this.getState();
    }

    try {
      const sessionRef = await this.ensureModelingSession(workspaceId);
      const prompt = buildPiAgentModelingPrompt({
        phase: "extract",
        sources: this.selectedPromptSources(),
        userRequirement,
      });

      this.update({
        modelingSessionRef: sessionRef,
        modelingStatus: "running",
        activePhase: "precheck",
        phaseRuns: startPhaseRuns("precheck"),
        messages: [
          ...this.state.messages,
          createMessage("user", userRequirement?.trim() || "请基于已选择的数据源开始本体建模。"),
          createMessage("system", "已通过 pi agent 启动本体建模任务。"),
        ],
        lastError: null,
      });

      await this.appStore.driver.sendUserMessage(sessionRef, { text: prompt });
      return this.getState();
    } catch (error) {
      this.update({
        modelingStatus: "failed",
        activePhase: null,
        phaseRuns: failActivePhase(this.state.phaseRuns, this.state.activePhase, formatError(error)),
        lastError: formatError(error),
      });
      return this.getState();
    }
  }

  async sendModelingMessage(text: string): Promise<OntologyWorkbenchState> {
    const trimmed = text.trim();
    if (!trimmed) {
      return this.getState();
    }
    const sessionRef = this.state.modelingSessionRef;
    if (!sessionRef) {
      return this.startModeling(trimmed);
    }

    try {
      this.update({
        modelingStatus: "running",
        messages: [...this.state.messages, createMessage("user", trimmed)],
        lastError: null,
      });
      await this.appStore.driver.sendUserMessage(sessionRef, { text: trimmed, deliverAs: "followUp" });
      return this.getState();
    } catch (error) {
      this.update({ modelingStatus: "failed", lastError: formatError(error) });
      return this.getState();
    }
  }

  createClass(name: string, superClassName?: string): OntologyWorkbenchState {
    const model = this.state.ontologyModel;
    if (!model || !name.trim()) {
      return this.getState();
    }
    const namespace = `${model.iri}#`;
    const iri = `${namespace}${name.trim()}`;
    if (model.classes.some((item) => item.iri.full === iri)) {
      this.update({ lastError: `类已存在：${name.trim()}` });
      return this.getState();
    }
    const nextModel: OntologyModel = structuredClone(model);
    nextModel.classes.push({
      type: "class",
      iri: { full: iri, namespace, local: name.trim() },
      label: name.trim(),
      labels: { zh: name.trim() },
      superClasses: superClassName ? [{ full: `${namespace}${superClassName}`, namespace, local: superClassName }] : [],
      equivalentClasses: [],
      disjointWith: [],
      restrictions: [],
    });
    nextModel.metadata.modified = new Date().toISOString();
    this.setOntologyModel(nextModel);
    return this.getState();
  }

  deleteClass(iri: string): OntologyWorkbenchState {
    const model = this.state.ontologyModel;
    if (!model) {
      return this.getState();
    }
    const target = model.classes.find((item) => item.iri.full === iri);
    if (!target) {
      return this.getState();
    }
    const nextModel: OntologyModel = structuredClone(model);
    nextModel.classes = nextModel.classes
      .filter((item) => item.iri.full !== iri)
      .map((item) => ({
        ...item,
        superClasses: item.superClasses.filter((superClass) => superClass.full !== iri),
      }));
    nextModel.objectProperties = nextModel.objectProperties.filter((property) =>
      !property.domain.some((domain) => domain.kind === "iri" && domain.iri.full === iri) &&
      !property.range.some((range) => range.kind === "iri" && range.iri.full === iri),
    );
    nextModel.dataProperties = nextModel.dataProperties.filter((property) =>
      !property.domain.some((domain) => domain.kind === "iri" && domain.iri.full === iri),
    );
    nextModel.metadata.modified = new Date().toISOString();
    this.setOntologyModel(nextModel);
    return this.getState();
  }

  validate(): OntologyWorkbenchState {
    if (!this.state.ontologyModel) {
      this.update({ validationResult: null, lastError: "暂无可验证的本体。" });
      return this.getState();
    }
    const validationResult = validateOntology(this.state.ontologyModel);
    this.update({
      validationResult,
      exportSummary: createExportSummary(this.state.ontologyModel, validationResult),
      lastError: null,
    });
    return this.getState();
  }

  runReasoner(): OntologyWorkbenchState {
    const validationResult = this.state.ontologyModel
      ? validateOntology(this.state.ontologyModel)
      : { valid: false, errors: [{ severity: "error" as const, message: "暂无可推理的本体。" }], warnings: [] };
    this.update({
      validationResult,
      lastError: validationResult.valid ? null : "推理前验证未通过。",
    });
    return this.getState();
  }

  export(format: OntologyExportFormat): OntologyWorkbenchState {
    if (!this.state.ontologyModel) {
      this.update({ exportPreview: null, lastError: "暂无可导出的本体。" });
      return this.getState();
    }
    this.update({
      exportPreview: format === "turtle"
        ? generateTurtlePreview(this.state.ontologyModel)
        : `${format} 导出将在接入 Python reasoner 后生成。\n\n${generateTurtlePreview(this.state.ontologyModel)}`,
      lastError: null,
    });
    return this.getState();
  }

  async handleSessionEvent(event: SessionDriverEvent): Promise<void> {
    if (!this.isModelingSession(event.sessionRef)) {
      return;
    }

    switch (event.type) {
      case "assistantDelta":
        this.appendAssistantDelta(event);
        return;
      case "toolStarted":
        this.update({
          messages: [...this.state.messages, createMessage("system", `pi agent 正在调用工具：${event.toolName}`)],
        });
        return;
      case "runCompleted":
        await this.completeModelingRun(event.sessionRef);
        return;
      case "runFailed":
        this.update({
          modelingStatus: "failed",
          activePhase: null,
          phaseRuns: failActivePhase(this.state.phaseRuns, this.state.activePhase, event.error.message),
          lastError: event.error.message,
        });
        return;
      case "sessionUpdated":
        if (event.snapshot.status === "running") {
          this.update({ modelingStatus: "running" });
        }
        return;
      default:
        return;
    }
  }

  private async ensureModelingSession(workspaceId: string): Promise<SessionRef> {
    const existing = this.state.modelingSessionRef;
    if (existing?.workspaceId === workspaceId) {
      await this.appStore.ensureSessionReady(existing);
      return existing;
    }

    const workspace = this.appStore.workspaceRefFromState(workspaceId);
    if (!workspace) {
      throw new Error(`Unknown workspace: ${workspaceId}`);
    }
    const createOptions = await this.appStore.buildCreateSessionOptions(workspaceId);
    const snapshot = await this.appStore.driver.createSession(workspace, {
      ...createOptions,
      title: MODELING_SESSION_TITLE,
    });
    await this.appStore.ensureSessionSubscribed(snapshot.ref);
    return snapshot.ref;
  }

  private selectedPromptSources(): PiAgentModelingPromptSource[] {
    const selectedIds = new Set(getReadySelectedSourceIds(this.state));
    return this.state.sources
      .filter((source) => selectedIds.has(source.id))
      .map((source) => ({
        id: source.id,
        name: source.name,
        kind: source.kind,
        summary: source.summary,
      }));
  }

  private appendAssistantDelta(event: Extract<SessionDriverEvent, { type: "assistantDelta" }>): void {
    const key = `${event.sessionRef.workspaceId}:${event.sessionRef.sessionId}`;
    const nextText = `${this.assistantBuffers.get(key) ?? ""}${event.text}`;
    this.assistantBuffers.set(key, nextText);
    const existingIndex = this.state.messages.findIndex((message) => message.id === `assistant-${key}`);
    const assistantMessage: OntologyWorkbenchMessage = {
      id: `assistant-${key}`,
      role: "assistant",
      content: nextText,
      timestamp: event.timestamp,
    };
    const messages = existingIndex === -1
      ? [...this.state.messages, assistantMessage]
      : this.state.messages.map((message, index) => index === existingIndex ? assistantMessage : message);
    this.update({
      messages,
      activePhase: advancePhaseForText(nextText, this.state.activePhase),
      phaseRuns: updatePhaseRunsForText(this.state.phaseRuns, nextText),
    });
  }

  private async completeModelingRun(sessionRef: SessionRef): Promise<void> {
    let assistantText = this.assistantBuffers.get(`${sessionRef.workspaceId}:${sessionRef.sessionId}`) ?? "";
    try {
      const transcript = await this.appStore.driver.getTranscript(sessionRef);
      const transcriptText = JSON.stringify(transcript);
      const parsedFromTranscript = extractOntologyJsonBlock(transcriptText);
      if (parsedFromTranscript) {
        assistantText = parsedFromTranscript;
      }
    } catch {
      // The streamed assistant buffer remains the fallback source.
    }

    const block = extractOntologyJsonBlock(assistantText) ?? (assistantText.trim().startsWith("{") ? assistantText.trim() : null);
    if (!block) {
      this.update({
        modelingStatus: "waitingReview",
        activePhase: "review",
        phaseRuns: completeThroughPhase(this.state.phaseRuns, "review"),
        lastError: "未检测到可解析本体结果。",
      });
      return;
    }

    try {
      const parsed = parseOntologyJsonBlock(block);
      const model = convertProtocolResultToOntology(parsed);
      this.setOntologyModel(model, {
        modelingStatus: "completed",
        activePhase: "finalize",
        phaseRuns: completeThroughPhase(this.state.phaseRuns, "finalize"),
        messages: [...this.state.messages, createMessage("system", "已解析 pi agent 返回的本体结果。")],
      });
    } catch (error) {
      this.update({
        modelingStatus: "waitingReview",
        activePhase: "review",
        phaseRuns: completeThroughPhase(this.state.phaseRuns, "review"),
        lastError: formatError(error),
      });
    }
  }

  private isModelingSession(sessionRef: SessionRef): boolean {
    return this.state.modelingSessionRef?.workspaceId === sessionRef.workspaceId &&
      this.state.modelingSessionRef.sessionId === sessionRef.sessionId;
  }

  private setOntologyModel(model: OntologyModel, extra?: Partial<OntologyWorkbenchState>): void {
    const validationResult = validateOntology(model);
    this.update({
      ontologyModel: model,
      exportSummary: createExportSummary(model, validationResult),
      validationResult,
      modelingStatus: "completed",
      exportPreview: generateTurtlePreview(model),
      lastError: null,
      ...extra,
    });
  }

  private update(patch: Partial<OntologyWorkbenchState>): void {
    this.state = {
      ...this.state,
      ...patch,
      revision: this.state.revision + 1,
    };
    this.emit();
  }

  private emit(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

function createFileSource(file: OntologyImportFileInput, importedAt: string): ImportedOntologySource {
  const kind = detectKind(file.name);
  return {
    id: nextId("src"),
    name: file.name,
    kind,
    path: file.path,
    sizeBytes: file.sizeBytes,
    importedAt,
    tableCount: kind === "csv" || kind === "excel" ? 1 : 0,
    entityCount: 0,
    textSegmentCount: kind === "pdf" || kind === "docx" || kind === "markdown" ? 1 : 0,
    summary: summarizeSource(kind, file),
    status: "ready",
  };
}

function detectKind(fileName: string): OntologySourceKind {
  const ext = extname(fileName).toLowerCase().replace(".", "");
  switch (ext) {
    case "csv":
    case "tsv":
      return "csv";
    case "xlsx":
    case "xls":
      return "excel";
    case "json":
      return "json";
    case "xml":
      return "xml";
    case "yaml":
    case "yml":
      return "yaml";
    case "pdf":
      return "pdf";
    case "docx":
      return "docx";
    case "md":
    case "markdown":
      return "markdown";
    case "sqlite":
    case "db":
      return "sqlite";
    default:
      return "csv";
  }
}

function summarizeSource(kind: OntologySourceKind, file: OntologyImportFileInput): string {
  const size = formatBytes(file.sizeBytes);
  if (kind === "csv" || kind === "excel") {
    return `表格数据源，文件大小 ${size}。后续真实摄入会提取字段、样例值和关系。`;
  }
  if (kind === "pdf" || kind === "docx" || kind === "markdown") {
    return `文档数据源，文件大小 ${size}。后续真实摄入会提取文本片段和候选概念。`;
  }
  return `结构化数据源，文件大小 ${size}。后续真实摄入会提取实体和关系。`;
}

function createExportSummary(model: OntologyModel, validationResult?: ValidationResult): OntologyExportSummary {
  return {
    title: model.metadata.title,
    iri: model.iri,
    classCount: model.classes.length,
    objectPropertyCount: model.objectProperties.length,
    dataPropertyCount: model.dataProperties.length,
    individualCount: model.individuals.length,
    axiomCount: model.axioms.length,
    validationErrors: validationResult?.errors.map((error) => error.message) ?? [],
    lastModified: model.metadata.modified,
  };
}

function startPhaseRuns(activePhase: OntologyPhaseId): OntologyPhaseRun[] {
  const now = new Date().toISOString();
  return ONTOLOGY_PHASE_ORDER.map((id) => ({
    id,
    label: ONTOLOGY_PHASE_LABELS[id],
    status: id === activePhase ? "running" : "pending",
    ...(id === activePhase ? { startedAt: now } : {}),
  }));
}

function completeThroughPhase(phaseRuns: readonly OntologyPhaseRun[], activePhase: OntologyPhaseId): OntologyPhaseRun[] {
  const activeIndex = ONTOLOGY_PHASE_ORDER.indexOf(activePhase);
  const now = new Date().toISOString();
  return phaseRuns.map((phase) => {
    const index = ONTOLOGY_PHASE_ORDER.indexOf(phase.id);
    if (index <= activeIndex) {
      return { ...phase, status: "completed", completedAt: phase.completedAt ?? now };
    }
    return phase;
  });
}

function failActivePhase(
  phaseRuns: readonly OntologyPhaseRun[],
  activePhase: OntologyPhaseId | null,
  errorMessage: string,
): readonly OntologyPhaseRun[] {
  if (!activePhase) {
    return phaseRuns;
  }
  return phaseRuns.map((phase) => phase.id === activePhase ? { ...phase, status: "failed", errorMessage } : phase);
}

function advancePhaseForText(text: string, fallback: OntologyPhaseId | null): OntologyPhaseId | null {
  for (const phase of ONTOLOGY_PHASE_ORDER) {
    if (text.includes(ONTOLOGY_PHASE_LABELS[phase])) {
      return phase;
    }
  }
  if (text.includes("ontology-json")) {
    return "finalize";
  }
  return fallback;
}

function updatePhaseRunsForText(phaseRuns: readonly OntologyPhaseRun[], text: string): OntologyPhaseRun[] {
  const activePhase = advancePhaseForText(text, null);
  if (!activePhase) {
    return [...phaseRuns];
  }
  const activeIndex = ONTOLOGY_PHASE_ORDER.indexOf(activePhase);
  const now = new Date().toISOString();
  return phaseRuns.map((phase) => {
    const index = ONTOLOGY_PHASE_ORDER.indexOf(phase.id);
    if (index < activeIndex) {
      return { ...phase, status: "completed", completedAt: phase.completedAt ?? now };
    }
    if (index === activeIndex) {
      return { ...phase, status: "running", startedAt: phase.startedAt ?? now };
    }
    return phase;
  });
}

function generateTurtlePreview(model: OntologyModel): string {
  const lines = [
    `@prefix ${model.prefix}: <${model.iri}#> .`,
    "@prefix owl: <http://www.w3.org/2002/07/owl#> .",
    "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
    "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
    "",
    `<${model.iri}> a owl:Ontology ;`,
    `  rdfs:label "${escapeTurtle(model.metadata.title)}" .`,
    "",
  ];

  for (const cls of model.classes) {
    lines.push(`${model.prefix}:${cls.iri.local} a owl:Class ;`);
    lines.push(`  rdfs:label "${escapeTurtle(cls.label)}"${cls.description ? " ;" : " ."}`);
    if (cls.description) {
      lines.push(`  rdfs:comment "${escapeTurtle(cls.description)}" .`);
    }
    lines.push("");
  }

  for (const prop of model.objectProperties) {
    lines.push(`${model.prefix}:${prop.iri.local} a owl:ObjectProperty ;`);
    lines.push(`  rdfs:label "${escapeTurtle(prop.label)}" ;`);
    const domain = prop.domain.find((item) => item.kind === "iri");
    const range = prop.range.find((item) => item.kind === "iri");
    if (domain?.kind === "iri") {
      lines.push(`  rdfs:domain ${model.prefix}:${domain.iri.local} ;`);
    }
    if (range?.kind === "iri") {
      lines.push(`  rdfs:range ${model.prefix}:${range.iri.local} .`);
    } else {
      lines[lines.length - 1] = lines[lines.length - 1]?.replace(/ ;$/, " .") ?? "";
    }
    lines.push("");
  }

  for (const prop of model.dataProperties) {
    lines.push(`${model.prefix}:${prop.iri.local} a owl:DatatypeProperty ;`);
    lines.push(`  rdfs:label "${escapeTurtle(prop.label)}" ;`);
    const domain = prop.domain.find((item) => item.kind === "iri");
    if (domain?.kind === "iri") {
      lines.push(`  rdfs:domain ${model.prefix}:${domain.iri.local} ;`);
    }
    lines.push(`  rdfs:range ${prop.range[0] ?? "xsd:string"} .`);
    lines.push("");
  }

  return lines.join("\n");
}

function createMessage(role: OntologyWorkbenchMessage["role"], content: string): OntologyWorkbenchMessage {
  return {
    id: nextId("msg"),
    role,
    content,
    timestamp: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
  };
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}-${Date.now().toString(36)}`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function escapeTurtle(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
