import { useState } from "react";

export type OwlExportFormat = "turtle" | "rdfxml" | "owlxml" | "jsonld";

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

interface OwlExportViewProps {
  readonly summary: OntologyExportSummary | null;
  readonly onExport: (format: OwlExportFormat) => void;
  readonly onValidate: () => void;
  readonly onRunReasoner: () => void;
  readonly validationResult: { ok: boolean; messages: readonly string[] } | null;
  readonly isExporting: boolean;
  readonly isValidating: boolean;
  readonly isReasoning: boolean;
  readonly exportPreview: string | null;
}

const FORMAT_OPTIONS: { readonly id: OwlExportFormat; readonly label: string; readonly extension: string; readonly description: string }[] = [
  { id: "turtle", label: "Turtle (.ttl)", extension: ".ttl", description: "Compact, human-readable RDF serialization. Recommended for most use cases." },
  { id: "rdfxml", label: "RDF/XML (.rdf)", extension: ".rdf", description: "Standard W3C RDF serialization. Widely supported by legacy tools." },
  { id: "owlxml", label: "OWL/XML (.owl)", extension: ".owl", description: "XML-based OWL serialization. Good for Java/XML tooling." },
  { id: "jsonld", label: "JSON-LD (.jsonld)", extension: ".jsonld", description: "JSON-based linked data format. Best for web applications." },
];

export function OwlExportView(props: OwlExportViewProps) {
  const {
    summary,
    onExport,
    onValidate,
    onRunReasoner,
    validationResult,
    isExporting,
    isValidating,
    isReasoning,
    exportPreview,
  } = props;

  const [selectedFormat, setSelectedFormat] = useState<OwlExportFormat>("turtle");
  const [showPreview, setShowPreview] = useState(false);

  if (!summary) {
    return (
      <section className="canvas">
        <div className="conversation owl-export-view">
          <section className="canvas canvas--empty">
            <div className="empty-panel">
              <div className="session-header__eyebrow">Export</div>
              <h1>No ontology to export</h1>
              <p>Create or load an ontology using the Modeler first, then come back to export it.</p>
            </div>
          </section>
        </div>
      </section>
    );
  }

  const hasValidationErrors = summary.validationErrors.length > 0;

  return (
    <section className="canvas">
      <div className="conversation owl-export-view">
        <header className="view-header">
          <div>
            <div className="chat-header__eyebrow">Export</div>
            <h1 className="view-header__title">OWL Export</h1>
            <p className="view-header__body">
              Export your ontology model in standard OWL 2 formats.
            </p>
          </div>
        </header>

        {/* Ontology summary card */}
        <div className="owl-export-summary">
          <h2 className="owl-export-summary__title">{summary.title}</h2>
          <div className="owl-export-summary__iri">{summary.iri}</div>
          <div className="owl-export-summary__stats">
            <div className="owl-export-stat">
              <div className="owl-export-stat__value">{summary.classCount}</div>
              <div className="owl-export-stat__label">Classes</div>
            </div>
            <div className="owl-export-stat">
              <div className="owl-export-stat__value">{summary.objectPropertyCount}</div>
              <div className="owl-export-stat__label">Object Properties</div>
            </div>
            <div className="owl-export-stat">
              <div className="owl-export-stat__value">{summary.dataPropertyCount}</div>
              <div className="owl-export-stat__label">Data Properties</div>
            </div>
            <div className="owl-export-stat">
              <div className="owl-export-stat__value">{summary.individualCount}</div>
              <div className="owl-export-stat__label">Individuals</div>
            </div>
            <div className="owl-export-stat">
              <div className="owl-export-stat__value">{summary.axiomCount}</div>
              <div className="owl-export-stat__label">Axioms</div>
            </div>
          </div>
          <div className="owl-export-summary__modified">Last modified: {summary.lastModified}</div>
        </div>

        {/* Validation status */}
        <div className="owl-export-validation">
          <div className="owl-export-validation__header">
            <h3>Validation</h3>
            <div className="owl-export-validation__actions">
              <button
                className="button button--secondary"
                type="button"
                disabled={isValidating}
                onClick={onValidate}
              >
                {isValidating ? "Validating..." : "Run SHACL Validation"}
              </button>
              <button
                className="button button--secondary"
                type="button"
                disabled={isReasoning}
                onClick={onRunReasoner}
              >
                {isReasoning ? "Reasoning..." : "Run Reasoner"}
              </button>
            </div>
          </div>

          {hasValidationErrors ? (
            <div className="owl-export-validation__errors">
              <div className="owl-export-validation__badge owl-export-validation__badge--error">
                {summary.validationErrors.length} issue(s) found
              </div>
              <ul className="owl-export-validation__list">
                {summary.validationErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          ) : validationResult ? (
            <div className={`owl-export-validation__result ${validationResult.ok ? "owl-export-validation__result--ok" : "owl-export-validation__result--error"}`}>
              <div className="owl-export-validation__badge">
                {validationResult.ok ? "Validation passed" : "Validation issues found"}
              </div>
              {validationResult.messages.length > 0 ? (
                <ul className="owl-export-validation__list">
                  {validationResult.messages.map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <div className="owl-export-validation__pending">
              <p>Run validation to check ontology consistency and SHACL shapes.</p>
            </div>
          )}
        </div>

        {/* Format selection and export */}
        <div className="owl-export-format">
          <h3>Export format</h3>
          <div className="owl-export-format__options">
            {FORMAT_OPTIONS.map((fmt) => (
              <label
                key={fmt.id}
                className={`owl-export-format__option ${selectedFormat === fmt.id ? "owl-export-format__option--selected" : ""}`}
              >
                <input
                  type="radio"
                  name="export-format"
                  value={fmt.id}
                  checked={selectedFormat === fmt.id}
                  onChange={() => setSelectedFormat(fmt.id)}
                />
                <div>
                  <div className="owl-export-format__label">{fmt.label}</div>
                  <div className="owl-export-format__description">{fmt.description}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="owl-export-format__actions">
            <button
              className="button button--secondary"
              type="button"
              disabled={isExporting}
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? "Hide preview" : "Preview output"}
            </button>
            <button
              className="button button--primary"
              type="button"
              disabled={isExporting || hasValidationErrors}
              onClick={() => onExport(selectedFormat)}
            >
              {isExporting ? "Exporting..." : `Export as ${FORMAT_OPTIONS.find((f) => f.id === selectedFormat)?.label}`}
            </button>
          </div>
        </div>

        {/* Export preview */}
        {showPreview && exportPreview ? (
          <div className="owl-export-preview">
            <h3>Preview</h3>
            <pre className="owl-export-preview__code">{exportPreview}</pre>
          </div>
        ) : null}
      </div>
    </section>
  );
}
