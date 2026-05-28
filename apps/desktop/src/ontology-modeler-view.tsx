import { useMemo, useState } from "react";
import type { ImportedSource } from "./data-import-view";
import type {
  OntologyModelingStatus,
  OntologyPhaseId,
  OntologyPhaseRun,
  OntologyPhaseStatus,
} from "./ontology-workbench-state";

export interface OntologyClassNode {
  readonly iri: string;
  readonly name: string;
  readonly description?: string;
  readonly superClassIris: readonly string[];
  readonly childIris: readonly string[];
  readonly propertyCount: number;
  readonly individualCount: number;
}

export interface OntologyProperty {
  readonly iri: string;
  readonly name: string;
  readonly kind: "object" | "data";
  readonly domainName: string;
  readonly rangeName: string;
  readonly description?: string;
}

export interface OntologyStats {
  readonly classCount: number;
  readonly objectPropertyCount: number;
  readonly dataPropertyCount: number;
  readonly individualCount: number;
  readonly axiomCount: number;
  readonly title: string;
  readonly iri: string;
}

export interface ModelerMessage {
  readonly id: string;
  readonly role: "user" | "assistant" | "system";
  readonly content: string;
  readonly timestamp: string;
  readonly toolCalls?: readonly { name: string; args: string; result?: string }[];
}

interface OntologyModelerViewProps {
  readonly classes: readonly OntologyClassNode[];
  readonly properties: readonly OntologyProperty[];
  readonly stats: OntologyStats;
  readonly messages: readonly ModelerMessage[];
  readonly sources: readonly ImportedSource[];
  readonly selectedSourceIds: readonly string[];
  readonly phaseRuns: readonly OntologyPhaseRun[];
  readonly modelingStatus: OntologyModelingStatus;
  readonly activePhase: OntologyPhaseId | null;
  readonly lastError: string | null;
  readonly isAgentRunning: boolean;
  readonly onSendMessage: (text: string) => void;
  readonly onRunPipeline: (requirement?: string) => void;
  readonly onSelectClass: (iri: string) => void;
  readonly onCreateClass: (name: string, superClassName?: string) => void;
  readonly onDeleteClass: (iri: string) => void;
  readonly onGoToImport: () => void;
  readonly onGoToExport: () => void;
  readonly onOpenModelSettings: () => void;
}

type ModelerTab = "tree" | "properties" | "individuals";

const PHASE_STATUS_LABELS: Record<OntologyPhaseStatus, string> = {
  pending: "待处理",
  running: "进行中",
  completed: "完成",
  failed: "失败",
};

const MODELING_STATUS_LABELS: Record<OntologyModelingStatus, string> = {
  idle: "待开始",
  ready: "可建模",
  running: "pi agent 建模中",
  waitingReview: "等待审查",
  completed: "已完成",
  failed: "失败",
};

export function OntologyModelerView(props: OntologyModelerViewProps) {
  const {
    classes,
    properties,
    stats,
    messages,
    sources,
    selectedSourceIds,
    phaseRuns,
    modelingStatus,
    activePhase,
    lastError,
    isAgentRunning,
    onSendMessage,
    onRunPipeline,
    onSelectClass,
    onCreateClass,
    onDeleteClass,
    onGoToImport,
    onGoToExport,
    onOpenModelSettings,
  } = props;

  const [selectedClassIri, setSelectedClassIri] = useState<string | null>(null);
  const [composerDraft, setComposerDraft] = useState("");
  const [leftTab, setLeftTab] = useState<ModelerTab>("tree");
  const [classFilter, setClassFilter] = useState("");
  const [showCreateClassDialog, setShowCreateClassDialog] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassSuper, setNewClassSuper] = useState("");

  const rootClasses = useMemo(
    () => classes.filter((c) => c.superClassIris.length === 0 || c.superClassIris.every((s) => !classes.some((x) => x.iri === s))),
    [classes],
  );

  const filteredClasses = useMemo(() => {
    if (!classFilter.trim()) return classes;
    const normalized = classFilter.toLowerCase();
    return classes.filter(
      (c) => c.name.toLowerCase().includes(normalized) || (c.description ?? "").toLowerCase().includes(normalized),
    );
  }, [classes, classFilter]);

  const selectedSourceSet = useMemo(() => new Set(selectedSourceIds), [selectedSourceIds]);
  const selectedSources = useMemo(
    () => sources.filter((source) => selectedSourceSet.has(source.id)),
    [selectedSourceSet, sources],
  );
  const readySelectedSources = selectedSources.filter((source) => source.status === "ready");
  const hasReadySources = readySelectedSources.length > 0;

  const selectedClass = classes.find((c) => c.iri === selectedClassIri);
  const selectedClassProperties = selectedClass
    ? properties.filter((p) => p.domainName === selectedClass.name)
    : [];

  const classMap = useMemo(() => new Map(classes.map((c) => [c.iri, c])), [classes]);

  function buildTree(nodes: readonly OntologyClassNode[], depth: number = 0): React.ReactNode {
    return nodes.map((node) => {
      const children = node.childIris.map((iri) => classMap.get(iri)).filter(Boolean) as OntologyClassNode[];
      const isSelected = node.iri === selectedClassIri;
      return (
        <div key={node.iri} className="ontology-tree__node" style={{ paddingLeft: depth * 16 }}>
          <button
            className={`ontology-tree__item ${isSelected ? "ontology-tree__item--selected" : ""}`}
            type="button"
            onClick={() => {
              setSelectedClassIri(node.iri);
              onSelectClass(node.iri);
            }}
          >
            <span className="ontology-tree__icon">类</span>
            <span className="ontology-tree__label">{node.name}</span>
            <span className="ontology-tree__counts">
              {node.propertyCount > 0 ? <span>{node.propertyCount} 属性</span> : null}
              {node.individualCount > 0 ? <span>{node.individualCount} 个体</span> : null}
            </span>
          </button>
          {children.length > 0 ? buildTree(children, depth + 1) : null}
        </div>
      );
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!composerDraft.trim() || isAgentRunning || !hasReadySources) return;
    onSendMessage(composerDraft.trim());
    setComposerDraft("");
  }

  function handleCreateClass(event: React.FormEvent) {
    event.preventDefault();
    if (!newClassName.trim()) return;
    onCreateClass(newClassName.trim(), newClassSuper.trim() || undefined);
    setNewClassName("");
    setNewClassSuper("");
    setShowCreateClassDialog(false);
  }

  function handleRunPipeline() {
    onRunPipeline(composerDraft.trim() || undefined);
    setComposerDraft("");
  }

  return (
    <section className="canvas canvas--ontology-modeler">
      <nav className="ontology-workbench-nav" aria-label="本体工作台流程">
        <button className="ontology-workbench-nav__item" type="button" onClick={onGoToImport}>
          数据导入
        </button>
        <button className="ontology-workbench-nav__item ontology-workbench-nav__item--active" type="button">
          本体建模
        </button>
        <button className="ontology-workbench-nav__item" type="button" onClick={onGoToExport}>
          OWL 导出
        </button>
        <button className="ontology-workbench-nav__item ontology-workbench-nav__item--settings" type="button" onClick={onOpenModelSettings}>
          模型配置
        </button>
      </nav>
      <div className="ontology-modeler-layout">
        <aside className="ontology-panel ontology-panel--left">
          <div className="ontology-panel__header">
            <div className="ontology-panel__tabs">
              <button
                className={`ontology-tab ${leftTab === "tree" ? "ontology-tab--active" : ""}`}
                type="button"
                onClick={() => setLeftTab("tree")}
              >
                类
              </button>
              <button
                className={`ontology-tab ${leftTab === "properties" ? "ontology-tab--active" : ""}`}
                type="button"
                onClick={() => setLeftTab("properties")}
              >
                属性
              </button>
              <button
                className={`ontology-tab ${leftTab === "individuals" ? "ontology-tab--active" : ""}`}
                type="button"
                onClick={() => setLeftTab("individuals")}
              >
                个体
              </button>
            </div>
          </div>

          {leftTab === "tree" ? (
            <>
              <div className="ontology-panel__toolbar">
                <input
                  className="ontology-panel__search"
                  placeholder="筛选类..."
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                />
                <button
                  className="icon-button ontology-panel__add"
                  type="button"
                  title="新建类"
                  onClick={() => setShowCreateClassDialog(true)}
                >
                  +
                </button>
              </div>
              <div className="ontology-tree">
                {classes.length === 0 ? (
                  <div className="ontology-tree__empty">
                    <p>暂无类。</p>
                    <p>请通过 pi agent 建模，或手动新建类。</p>
                  </div>
                ) : classFilter ? (
                  filteredClasses.map((node) => (
                    <button
                      key={node.iri}
                      className={`ontology-tree__item ${node.iri === selectedClassIri ? "ontology-tree__item--selected" : ""}`}
                      type="button"
                      onClick={() => {
                        setSelectedClassIri(node.iri);
                        onSelectClass(node.iri);
                      }}
                    >
                      <span className="ontology-tree__icon">类</span>
                      <span className="ontology-tree__label">{node.name}</span>
                    </button>
                  ))
                ) : (
                  buildTree(rootClasses)
                )}
              </div>
            </>
          ) : leftTab === "properties" ? (
            <div className="ontology-property-list">
              {properties.length === 0 ? (
                <div className="ontology-tree__empty">
                  <p>暂无属性。</p>
                </div>
              ) : (
                properties.map((prop) => (
                  <div key={prop.iri} className="ontology-property-item">
                    <div className="ontology-property-item__header">
                      <span className={`ontology-property-item__kind ontology-property-item__kind--${prop.kind}`}>
                        {prop.kind === "object" ? "对象" : "数据"}
                      </span>
                      <span className="ontology-property-item__name">{prop.name}</span>
                    </div>
                    <div className="ontology-property-item__signature">
                      {prop.domainName} → {prop.rangeName}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="ontology-tree__empty">
              <p>个体视图将在后续接入。</p>
            </div>
          )}

          {showCreateClassDialog ? (
            <div className="ontology-dialog-overlay" onClick={() => setShowCreateClassDialog(false)}>
              <form className="ontology-dialog" onSubmit={handleCreateClass} onClick={(e) => e.stopPropagation()}>
                <h3>新建类</h3>
                <label className="db-form__field">
                  <span>类名（PascalCase）</span>
                  <input
                    type="text"
                    placeholder="例如 Customer, Order"
                    value={newClassName}
                    autoFocus
                    onChange={(e) => setNewClassName(e.target.value)}
                  />
                </label>
                <label className="db-form__field">
                  <span>父类（可选）</span>
                  <select value={newClassSuper} onChange={(e) => setNewClassSuper(e.target.value)}>
                    <option value="">无（根类）</option>
                    {classes.map((c) => (
                      <option key={c.iri} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <div className="ontology-dialog__actions">
                  <button className="button button--secondary" type="button" onClick={() => setShowCreateClassDialog(false)}>取消</button>
                  <button className="button button--primary" type="submit">创建</button>
                </div>
              </form>
            </div>
          ) : null}
        </aside>

        <main className="ontology-modeler-center">
          <div className="ontology-modeler-center__toolbar">
            <div className="ontology-stats-bar">
              <span><strong>{stats.classCount}</strong> 类</span>
              <span><strong>{stats.objectPropertyCount}</strong> 对象属性</span>
              <span><strong>{stats.dataPropertyCount}</strong> 数据属性</span>
              <span><strong>{stats.individualCount}</strong> 个体</span>
            </div>
            <div className="ontology-modeler-center__actions">
              {classes.length > 0 ? (
                <button className="button button--secondary" type="button" onClick={onGoToExport}>
                  进入导出
                </button>
              ) : null}
              <button
                className="button button--primary"
                type="button"
                disabled={isAgentRunning || !hasReadySources}
                onClick={handleRunPipeline}
              >
                {isAgentRunning ? "建模中..." : "开始建模"}
              </button>
            </div>
          </div>

          <div className="ontology-workflow-status">
            <div className="ontology-source-summary">
              <span className="ontology-source-summary__label">已选数据源</span>
              {readySelectedSources.length > 0 ? (
                <span className="ontology-source-summary__value">
                  {readySelectedSources.map((source) => source.name).join("、")}
                </span>
              ) : (
                <button className="ontology-source-summary__link" type="button" onClick={onGoToImport}>
                  去导入数据
                </button>
              )}
            </div>
            <div className={`ontology-modeling-badge ontology-modeling-badge--${modelingStatus}`}>
              {MODELING_STATUS_LABELS[modelingStatus]}
            </div>
          </div>

          <div className="ontology-phase-strip" aria-label="本体建模阶段">
            {phaseRuns.map((phase, index) => (
              <div
                key={phase.id}
                className={[
                  "ontology-phase-step",
                  `ontology-phase-step--${phase.status}`,
                  activePhase === phase.id ? "ontology-phase-step--active" : "",
                ].filter(Boolean).join(" ")}
              >
                <span className="ontology-phase-step__index">{index + 1}</span>
                <span className="ontology-phase-step__body">
                  <span className="ontology-phase-step__label">{phase.label}</span>
                  <span className="ontology-phase-step__status">{PHASE_STATUS_LABELS[phase.status]}</span>
                </span>
              </div>
            ))}
          </div>

          {lastError ? (
            <div className="ontology-modeler-alert ontology-modeler-alert--error">
              {lastError}
            </div>
          ) : null}

          {modelingStatus === "completed" && classes.length > 0 ? (
            <div className="ontology-modeler-alert ontology-modeler-alert--success">
              已解析 pi agent 输出，共生成 {stats.classCount} 个类、{stats.objectPropertyCount + stats.dataPropertyCount} 个属性。
            </div>
          ) : modelingStatus === "completed" && classes.length === 0 ? (
            <div className="ontology-modeler-alert">
              pi agent 已完成，但还没有解析到本体结果。请让 pi agent 输出 ontology-json 代码块。
            </div>
          ) : null}

          <div className="ontology-chat-timeline">
            {!hasReadySources ? (
              <div className="ontology-chat-empty">
                <div className="session-header__eyebrow">pi agent 本体建模</div>
                <h1>请先导入数据</h1>
                <p>本体建模会通过 pi agent 读取已选择的数据源，完成类、属性、关系和能力问题抽取。</p>
                <div className="ontology-chat-empty__suggestions">
                  <button type="button" className="button button--primary" onClick={onGoToImport}>
                    去导入数据
                  </button>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="ontology-chat-empty">
                <div className="session-header__eyebrow">pi agent 本体建模</div>
                <h1>让 pi agent 开始建模</h1>
                <p>
                  pi agent 会基于已选数据源完成预检、访谈、能力问题、实体抽取、审查和定稿，并输出可解析的 ontology-json。
                </p>
                <div className="ontology-chat-empty__suggestions">
                  <button type="button" className="suggestion-chip" onClick={() => onSendMessage("请分析已导入数据，并建议核心本体类。")}>
                    建议核心类
                  </button>
                  <button type="button" className="suggestion-chip" onClick={() => onSendMessage("请为当前领域生成能力问题，并说明预期答案类型。")}>
                    生成能力问题
                  </button>
                  <button type="button" className="suggestion-chip" onClick={() => onRunPipeline("请基于已选择的数据源执行完整本体建模流程，并输出 ontology-json。")}>
                    执行完整流程
                  </button>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`ontology-chat-message ontology-chat-message--${msg.role}`}>
                  <div className="ontology-chat-message__header">
                    <span className="ontology-chat-message__role">
                      {msg.role === "user" ? "你" : msg.role === "assistant" ? "pi agent" : "系统"}
                    </span>
                    <span className="ontology-chat-message__time">{msg.timestamp}</span>
                  </div>
                  <div className="ontology-chat-message__content">{msg.content}</div>
                  {msg.toolCalls && msg.toolCalls.length > 0 ? (
                    <div className="ontology-chat-message__tools">
                      {msg.toolCalls.map((tc, i) => (
                        <div key={i} className="tool-call-chip">
                          <span className="tool-call-chip__name">{tc.name}</span>
                          {tc.result ? <span className="tool-call-chip__result">{tc.result}</span> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>

          <form className="ontology-composer" onSubmit={handleSubmit}>
            <textarea
              className="ontology-composer__input"
              placeholder="补充你的建模要求..."
              value={composerDraft}
              rows={3}
              disabled={!hasReadySources}
              onChange={(e) => setComposerDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <div className="ontology-composer__footer">
              <span className="ontology-composer__hint">Enter 发送，Shift+Enter 换行</span>
              <button
                className="button button--primary"
                type="submit"
                disabled={!composerDraft.trim() || isAgentRunning || !hasReadySources}
              >
                {isAgentRunning ? "pi agent 运行中..." : "发送"}
              </button>
            </div>
          </form>
        </main>

        <aside className="ontology-panel ontology-panel--right">
          {selectedClass ? (
            <div className="ontology-detail-panel">
              <header className="ontology-detail-panel__header">
                <div className="session-header__eyebrow">类</div>
                <h2>{selectedClass.name}</h2>
                <div className="ontology-detail-panel__iri">{selectedClass.iri}</div>
              </header>

              {selectedClass.description ? (
                <p className="ontology-detail-panel__description">{selectedClass.description}</p>
              ) : null}

              {selectedClass.superClassIris.length > 0 ? (
                <div className="ontology-detail-panel__section">
                  <h3>父类</h3>
                  <ul className="ontology-detail-panel__list">
                    {selectedClass.superClassIris.map((iri) => {
                      const parent = classMap.get(iri);
                      return (
                        <li key={iri}>
                          <button
                            className="ontology-detail-panel__link"
                            type="button"
                            onClick={() => {
                              setSelectedClassIri(iri);
                              onSelectClass(iri);
                            }}
                          >
                            {parent?.name ?? iri}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {selectedClassProperties.length > 0 ? (
                <div className="ontology-detail-panel__section">
                  <h3>属性（{selectedClassProperties.length}）</h3>
                  <ul className="ontology-detail-panel__list">
                    {selectedClassProperties.map((prop) => (
                      <li key={prop.iri} className="ontology-detail-panel__property">
                        <span className={`ontology-property-item__kind ontology-property-item__kind--${prop.kind}`}>
                          {prop.kind === "object" ? "对象" : "数据"}
                        </span>
                        <span>{prop.name}</span>
                        <span className="ontology-detail-panel__range">→ {prop.rangeName}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="ontology-detail-panel__section ontology-detail-panel__actions">
                <button
                  className="button button--secondary button--danger"
                  type="button"
                  onClick={() => {
                    onDeleteClass(selectedClass.iri);
                    setSelectedClassIri(null);
                  }}
                >
                  删除类
                </button>
              </div>
            </div>
          ) : (
            <div className="ontology-detail-panel ontology-detail-panel--empty">
              <p>选择一个类以查看描述、属性和关系。</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
