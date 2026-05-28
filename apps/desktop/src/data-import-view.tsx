import { useCallback, useRef, useState } from "react";

export type DataSourceKind =
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

export interface ImportedSource {
  readonly id: string;
  readonly name: string;
  readonly kind: DataSourceKind;
  readonly sizeBytes: number;
  readonly importedAt: string;
  readonly tableCount: number;
  readonly entityCount: number;
  readonly textSegmentCount: number;
  readonly status: "ready" | "processing" | "failed";
  readonly errorMessage?: string;
}

interface DatabaseConnectionForm {
  readonly kind: "postgres" | "mysql" | "sqlite";
  readonly host: string;
  readonly port: string;
  readonly database: string;
  readonly username: string;
  readonly password: string;
  readonly filePath: string;
}

interface DataImportViewProps {
  readonly sources: readonly ImportedSource[];
  readonly onImportFiles: (files: FileList) => void;
  readonly onConnectDatabase: (form: DatabaseConnectionForm) => void;
  readonly onRemoveSource: (id: string) => void;
  readonly onSendToModeler: (ids: readonly string[]) => void;
}

const FILE_ACCEPT = [
  ".csv",
  ".tsv",
  ".xlsx",
  ".xls",
  ".json",
  ".xml",
  ".yaml",
  ".yml",
  ".pdf",
  ".docx",
  ".md",
  ".markdown",
  ".sqlite",
  ".db",
].join(",");

const SOURCE_KIND_LABELS: Record<DataSourceKind, string> = {
  csv: "CSV",
  excel: "Excel",
  json: "JSON",
  xml: "XML",
  yaml: "YAML",
  pdf: "PDF",
  docx: "DOCX",
  markdown: "Markdown",
  sqlite: "SQLite",
  postgres: "PostgreSQL",
  mysql: "MySQL",
};

const EMPTY_DB_FORM: DatabaseConnectionForm = {
  kind: "postgres",
  host: "localhost",
  port: "5432",
  database: "",
  username: "",
  password: "",
  filePath: "",
};

export function DataImportView(props: DataImportViewProps) {
  const { sources, onImportFiles, onConnectDatabase, onRemoveSource, onSendToModeler } = props;
  const [mode, setMode] = useState<"files" | "database">("files");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dbForm, setDbForm] = useState<DatabaseConnectionForm>(EMPTY_DB_FORM);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragOver(false);
      if (event.dataTransfer.files.length > 0) {
        onImportFiles(event.dataTransfer.files);
      }
    },
    [onImportFiles],
  );

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const fileSources = sources.filter((s) => s.kind !== "postgres" && s.kind !== "mysql" && s.kind !== "sqlite");
  const dbSources = sources.filter((s) => s.kind === "postgres" || s.kind === "mysql" || s.kind === "sqlite");
  const visibleSources = mode === "files" ? fileSources : dbSources;

  return (
    <section className="canvas">
      <div className="conversation data-import-view">
        <header className="view-header">
          <div>
            <div className="chat-header__eyebrow">Data Import</div>
            <h1 className="view-header__title">Import Data Sources</h1>
            <p className="view-header__body">
              Ingest structured, semi-structured, and unstructured data to inform ontology design.
            </p>
          </div>
          <div className="view-header__actions">
            <button
              className="button button--primary"
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() => onSendToModeler(Array.from(selectedIds))}
            >
              Send to Modeler ({selectedIds.size})
            </button>
          </div>
        </header>

        <div className="data-import-toolbar">
          <div className="data-import-toolbar__tabs">
            <button
              className={`data-import-tab ${mode === "files" ? "data-import-tab--active" : ""}`}
              type="button"
              onClick={() => setMode("files")}
            >
              File Sources
            </button>
            <button
              className={`data-import-tab ${mode === "database" ? "data-import-tab--active" : ""}`}
              type="button"
              onClick={() => setMode("database")}
            >
              Database Connections
            </button>
          </div>
        </div>

        {mode === "files" ? (
          <div
            className={`data-import-dropzone ${isDragOver ? "data-import-dropzone--active" : ""}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className="data-import-dropzone__content">
              <div className="data-import-dropzone__icon">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none">
                  <path
                    d="M12 16V4m0 0L8 8m4-4 4 4M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h2>Drop files here</h2>
              <p>CSV, Excel, JSON, XML, YAML, PDF, DOCX, Markdown</p>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                Browse files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={FILE_ACCEPT}
                style={{ display: "none" }}
                onChange={(event) => {
                  if (event.target.files && event.target.files.length > 0) {
                    onImportFiles(event.target.files);
                    event.target.value = "";
                  }
                }}
              />
            </div>
          </div>
        ) : (
          <div className="data-import-db-form">
            <div className="db-form__row">
              <label className="db-form__field">
                <span>Database type</span>
                <select
                  value={dbForm.kind}
                  onChange={(e) => {
                    const kind = e.target.value as DatabaseConnectionForm["kind"];
                    setDbForm((prev) => ({
                      ...prev,
                      kind,
                      port: kind === "postgres" ? "5432" : kind === "mysql" ? "3306" : "",
                    }));
                  }}
                >
                  <option value="postgres">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                  <option value="sqlite">SQLite</option>
                </select>
              </label>
            </div>
            {dbForm.kind === "sqlite" ? (
              <label className="db-form__field">
                <span>Database file path</span>
                <input
                  type="text"
                  placeholder="/path/to/database.sqlite"
                  value={dbForm.filePath}
                  onChange={(e) => setDbForm((prev) => ({ ...prev, filePath: e.target.value }))}
                />
              </label>
            ) : (
              <>
                <div className="db-form__row db-form__row--two-col">
                  <label className="db-form__field">
                    <span>Host</span>
                    <input
                      type="text"
                      value={dbForm.host}
                      onChange={(e) => setDbForm((prev) => ({ ...prev, host: e.target.value }))}
                    />
                  </label>
                  <label className="db-form__field">
                    <span>Port</span>
                    <input
                      type="text"
                      value={dbForm.port}
                      onChange={(e) => setDbForm((prev) => ({ ...prev, port: e.target.value }))}
                    />
                  </label>
                </div>
                <label className="db-form__field">
                  <span>Database name</span>
                  <input
                    type="text"
                    value={dbForm.database}
                    onChange={(e) => setDbForm((prev) => ({ ...prev, database: e.target.value }))}
                  />
                </label>
                <div className="db-form__row db-form__row--two-col">
                  <label className="db-form__field">
                    <span>Username</span>
                    <input
                      type="text"
                      value={dbForm.username}
                      onChange={(e) => setDbForm((prev) => ({ ...prev, username: e.target.value }))}
                    />
                  </label>
                  <label className="db-form__field">
                    <span>Password</span>
                    <input
                      type="password"
                      value={dbForm.password}
                      onChange={(e) => setDbForm((prev) => ({ ...prev, password: e.target.value }))}
                    />
                  </label>
                </div>
              </>
            )}
            <div className="db-form__actions">
              <button
                className="button button--primary"
                type="button"
                onClick={() => {
                  onConnectDatabase(dbForm);
                  setDbForm(EMPTY_DB_FORM);
                }}
              >
                Connect and ingest schema
              </button>
            </div>
          </div>
        )}

        <div className="data-import-sources">
          <h3 className="data-import-sources__title">
            Imported sources ({visibleSources.length})
          </h3>
          {visibleSources.length === 0 ? (
            <div className="empty-state">
              <p>No {mode === "files" ? "file" : "database"} sources imported yet.</p>
            </div>
          ) : (
            <div className="data-import-source-list">
              {visibleSources.map((source) => (
                <label
                  key={source.id}
                  className={`data-import-source ${selectedIds.has(source.id) ? "data-import-source--selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(source.id)}
                    onChange={() => toggleSelected(source.id)}
                  />
                  <div className="data-import-source__info">
                    <div className="data-import-source__name">{source.name}</div>
                    <div className="data-import-source__meta">
                      <span className="data-import-source__kind">{SOURCE_KIND_LABELS[source.kind]}</span>
                      <span>{formatBytes(source.sizeBytes)}</span>
                      {source.tableCount > 0 ? <span>{source.tableCount} tables</span> : null}
                      {source.entityCount > 0 ? <span>{source.entityCount} entities</span> : null}
                      {source.textSegmentCount > 0 ? <span>{source.textSegmentCount} segments</span> : null}
                    </div>
                  </div>
                  <div className="data-import-source__status">
                    <span className={`source-status source-status--${source.status}`}>{source.status}</span>
                    {source.status === "failed" && source.errorMessage ? (
                      <span className="source-status__error">{source.errorMessage}</span>
                    ) : null}
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Remove ${source.name}`}
                    onClick={(event) => {
                      event.preventDefault();
                      onRemoveSource(source.id);
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        next.delete(source.id);
                        return next;
                      });
                    }}
                  >
                    ×
                  </button>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
