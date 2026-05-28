import { useMemo, useState } from "react";

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
  readonly isAgentRunning: boolean;
  readonly onSendMessage: (text: string) => void;
  readonly onRunPipeline: () => void;
  readonly onSelectClass: (iri: string) => void;
  readonly onCreateClass: (name: string, superClassName?: string) => void;
  readonly onDeleteClass: (iri: string) => void;
}

type ModelerTab = "tree" | "properties" | "individuals";

export function OntologyModelerView(props: OntologyModelerViewProps) {
  const {
    classes,
    properties,
    stats,
    messages,
    isAgentRunning,
    onSendMessage,
    onRunPipeline,
    onSelectClass,
    onCreateClass,
    onDeleteClass,
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
            <span className="ontology-tree__icon">C</span>
            <span className="ontology-tree__label">{node.name}</span>
            <span className="ontology-tree__counts">
              {node.propertyCount > 0 ? <span>{node.propertyCount}p</span> : null}
              {node.individualCount > 0 ? <span>{node.individualCount}i</span> : null}
            </span>
          </button>
          {children.length > 0 ? buildTree(children, depth + 1) : null}
        </div>
      );
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!composerDraft.trim() || isAgentRunning) return;
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

  return (
    <section className="canvas canvas--ontology-modeler">
      <div className="ontology-modeler-layout">
        {/* Left panel: Ontology tree */}
        <aside className="ontology-panel ontology-panel--left">
          <div className="ontology-panel__header">
            <div className="ontology-panel__tabs">
              <button
                className={`ontology-tab ${leftTab === "tree" ? "ontology-tab--active" : ""}`}
                type="button"
                onClick={() => setLeftTab("tree")}
              >
                Classes
              </button>
              <button
                className={`ontology-tab ${leftTab === "properties" ? "ontology-tab--active" : ""}`}
                type="button"
                onClick={() => setLeftTab("properties")}
              >
                Properties
              </button>
              <button
                className={`ontology-tab ${leftTab === "individuals" ? "ontology-tab--active" : ""}`}
                type="button"
                onClick={() => setLeftTab("individuals")}
              >
                Individuals
              </button>
            </div>
          </div>

          {leftTab === "tree" ? (
            <>
              <div className="ontology-panel__toolbar">
                <input
                  className="ontology-panel__search"
                  placeholder="Filter classes..."
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                />
                <button
                  className="icon-button ontology-panel__add"
                  type="button"
                  title="Add class"
                  onClick={() => setShowCreateClassDialog(true)}
                >
                  +
                </button>
              </div>
              <div className="ontology-tree">
                {classes.length === 0 ? (
                  <div className="ontology-tree__empty">
                    <p>No classes yet.</p>
                    <p>Run the modeling pipeline or create classes manually.</p>
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
                      <span className="ontology-tree__icon">C</span>
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
                  <p>No properties defined yet.</p>
                </div>
              ) : (
                properties.map((prop) => (
                  <div key={prop.iri} className="ontology-property-item">
                    <div className="ontology-property-item__header">
                      <span className={`ontology-property-item__kind ontology-property-item__kind--${prop.kind}`}>
                        {prop.kind === "object" ? "OP" : "DP"}
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
              <p>Individuals view coming soon.</p>
            </div>
          )}

          {showCreateClassDialog ? (
            <div className="ontology-dialog-overlay" onClick={() => setShowCreateClassDialog(false)}>
              <form className="ontology-dialog" onSubmit={handleCreateClass} onClick={(e) => e.stopPropagation()}>
                <h3>Create class</h3>
                <label className="db-form__field">
                  <span>Class name (PascalCase)</span>
                  <input
                    type="text"
                    placeholder="e.g. Person, Book"
                    value={newClassName}
                    autoFocus
                    onChange={(e) => setNewClassName(e.target.value)}
                  />
                </label>
                <label className="db-form__field">
                  <span>Superclass (optional)</span>
                  <select value={newClassSuper} onChange={(e) => setNewClassSuper(e.target.value)}>
                    <option value="">None (root class)</option>
                    {classes.map((c) => (
                      <option key={c.iri} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <div className="ontology-dialog__actions">
                  <button className="button button--secondary" type="button" onClick={() => setShowCreateClassDialog(false)}>Cancel</button>
                  <button className="button button--primary" type="submit">Create</button>
                </div>
              </form>
            </div>
          ) : null}
        </aside>

        {/* Center: Agent chat */}
        <main className="ontology-modeler-center">
          <div className="ontology-modeler-center__toolbar">
            <div className="ontology-stats-bar">
              <span><strong>{stats.classCount}</strong> classes</span>
              <span><strong>{stats.objectPropertyCount}</strong> object props</span>
              <span><strong>{stats.dataPropertyCount}</strong> data props</span>
              <span><strong>{stats.individualCount}</strong> individuals</span>
            </div>
            <button
              className="button button--primary"
              type="button"
              disabled={isAgentRunning}
              onClick={onRunPipeline}
            >
              {isAgentRunning ? "Running..." : "Run Modeling Pipeline"}
            </button>
          </div>

          <div className="ontology-chat-timeline">
            {messages.length === 0 ? (
              <div className="ontology-chat-empty">
                <div className="session-header__eyebrow">Ontology Modeler</div>
                <h1>AI-Powered Ontology Modeling</h1>
                <p>
                  Import data sources, then ask the AI agent to help you design an ontology.
                  The agent can create classes, properties, and relationships based on your data.
                </p>
                <div className="ontology-chat-empty__suggestions">
                  <button type="button" className="suggestion-chip" onClick={() => onSendMessage("Analyze my imported data and suggest core ontology classes.")}>
                    Suggest core classes
                  </button>
                  <button type="button" className="suggestion-chip" onClick={() => onSendMessage("Generate competency questions for this domain.")}>
                    Generate competency questions
                  </button>
                  <button type="button" className="suggestion-chip" onClick={() => onSendMessage("Run the full ontology modeling pipeline.")}>
                    Run full pipeline
                  </button>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`ontology-chat-message ontology-chat-message--${msg.role}`}>
                  <div className="ontology-chat-message__header">
                    <span className="ontology-chat-message__role">
                      {msg.role === "user" ? "You" : msg.role === "assistant" ? "Ontology Agent" : "System"}
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
              placeholder="Ask the agent to model your ontology..."
              value={composerDraft}
              rows={3}
              onChange={(e) => setComposerDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <div className="ontology-composer__footer">
              <span className="ontology-composer__hint">Shift+Enter for newline</span>
              <button
                className="button button--primary"
                type="submit"
                disabled={!composerDraft.trim() || isAgentRunning}
              >
                {isAgentRunning ? "Agent running..." : "Send"}
              </button>
            </div>
          </form>
        </main>

        {/* Right panel: Class details */}
        <aside className="ontology-panel ontology-panel--right">
          {selectedClass ? (
            <div className="ontology-detail-panel">
              <header className="ontology-detail-panel__header">
                <div className="session-header__eyebrow">Class</div>
                <h2>{selectedClass.name}</h2>
                <div className="ontology-detail-panel__iri">{selectedClass.iri}</div>
              </header>

              {selectedClass.description ? (
                <p className="ontology-detail-panel__description">{selectedClass.description}</p>
              ) : null}

              {selectedClass.superClassIris.length > 0 ? (
                <div className="ontology-detail-panel__section">
                  <h3>Superclasses</h3>
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
                  <h3>Properties ({selectedClassProperties.length})</h3>
                  <ul className="ontology-detail-panel__list">
                    {selectedClassProperties.map((prop) => (
                      <li key={prop.iri} className="ontology-detail-panel__property">
                        <span className={`ontology-property-item__kind ontology-property-item__kind--${prop.kind}`}>
                          {prop.kind === "object" ? "OP" : "DP"}
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
                  Delete class
                </button>
              </div>
            </div>
          ) : (
            <div className="ontology-detail-panel ontology-detail-panel--empty">
              <p>Select a class to view its details, properties, and relationships.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
