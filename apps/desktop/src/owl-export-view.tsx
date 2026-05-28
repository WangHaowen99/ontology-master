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
  readonly onGoToModeler: () => void;
}

const FORMAT_OPTIONS: { readonly id: OwlExportFormat; readonly label: string; readonly extension: string; readonly description: string }[] = [
  { id: "turtle", label: "Turtle (.ttl)", extension: ".ttl", description: "紧凑、便于人工阅读的 RDF 序列化，推荐作为默认导出格式。" },
  { id: "rdfxml", label: "RDF/XML (.rdf)", extension: ".rdf", description: "W3C 标准 RDF XML 序列化，兼容传统语义网工具。" },
  { id: "owlxml", label: "OWL/XML (.owl)", extension: ".owl", description: "面向 OWL 的 XML 序列化，适合 Java/XML 工具链。" },
  { id: "jsonld", label: "JSON-LD (.jsonld)", extension: ".jsonld", description: "基于 JSON 的链接数据格式，适合 Web 应用集成。" },
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
    onGoToModeler,
  } = props;

  const [selectedFormat, setSelectedFormat] = useState<OwlExportFormat>("turtle");
  const [showPreview, setShowPreview] = useState(false);

  if (!summary) {
    return (
      <section className="canvas">
        <div className="conversation owl-export-view">
          <section className="canvas canvas--empty">
            <div className="empty-panel">
              <div className="session-header__eyebrow">OWL 导出</div>
              <h1>暂无可导出的本体</h1>
              <p>请先通过 pi agent 完成本体建模，再回到这里导出 OWL 文件。</p>
              <div className="empty-panel__actions">
                <button className="button button--primary" type="button" onClick={onGoToModeler}>
                  去本体建模
                </button>
              </div>
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
            <div className="chat-header__eyebrow">OWL 导出</div>
            <h1 className="view-header__title">导出本体文件</h1>
            <p className="view-header__body">
              将 pi agent 生成的本体导出为标准 OWL 2 相关格式。
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
              <div className="owl-export-stat__label">类</div>
            </div>
            <div className="owl-export-stat">
              <div className="owl-export-stat__value">{summary.objectPropertyCount}</div>
              <div className="owl-export-stat__label">对象属性</div>
            </div>
            <div className="owl-export-stat">
              <div className="owl-export-stat__value">{summary.dataPropertyCount}</div>
              <div className="owl-export-stat__label">数据属性</div>
            </div>
            <div className="owl-export-stat">
              <div className="owl-export-stat__value">{summary.individualCount}</div>
              <div className="owl-export-stat__label">个体</div>
            </div>
            <div className="owl-export-stat">
              <div className="owl-export-stat__value">{summary.axiomCount}</div>
              <div className="owl-export-stat__label">公理</div>
            </div>
          </div>
          <div className="owl-export-summary__modified">最后修改：{summary.lastModified}</div>
        </div>

        {/* Validation status */}
        <div className="owl-export-validation">
          <div className="owl-export-validation__header">
            <h3>验证</h3>
            <div className="owl-export-validation__actions">
              <button
                className="button button--secondary"
                type="button"
                disabled={isValidating}
                onClick={onValidate}
              >
                {isValidating ? "验证中..." : "运行 SHACL 验证"}
              </button>
              <button
                className="button button--secondary"
                type="button"
                disabled={isReasoning}
                onClick={onRunReasoner}
              >
                {isReasoning ? "推理中..." : "运行推理"}
              </button>
            </div>
          </div>

          {hasValidationErrors ? (
            <div className="owl-export-validation__errors">
              <div className="owl-export-validation__badge owl-export-validation__badge--error">
                发现 {summary.validationErrors.length} 个问题
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
                {validationResult.ok ? "验证通过" : "发现验证问题"}
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
              <p>运行验证以检查本体一致性和 SHACL 约束。</p>
            </div>
          )}
        </div>

        {/* Format selection and export */}
        <div className="owl-export-format">
          <h3>导出格式</h3>
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
              {showPreview ? "隐藏预览" : "预览输出"}
            </button>
            <button
              className="button button--primary"
              type="button"
              disabled={isExporting || hasValidationErrors}
              onClick={() => onExport(selectedFormat)}
            >
              {isExporting ? "导出中..." : `导出为 ${FORMAT_OPTIONS.find((f) => f.id === selectedFormat)?.label}`}
            </button>
          </div>
        </div>

        {/* Export preview */}
        {showPreview && exportPreview ? (
          <div className="owl-export-preview">
            <h3>预览</h3>
            <pre className="owl-export-preview__code">{exportPreview}</pre>
          </div>
        ) : null}
      </div>
    </section>
  );
}
