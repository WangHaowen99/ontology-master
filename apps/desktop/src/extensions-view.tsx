import { useMemo, useState } from "react";
import type { RuntimeExtensionRecord, RuntimeSnapshot } from "@pi-gui/session-driver/runtime-types";
import type { ExtensionCommandCompatibilityRecord, WorkspaceRecord } from "./desktop-state";
import { RefreshIcon } from "./icons";

interface ExtensionsViewProps {
  readonly workspace?: WorkspaceRecord;
  readonly runtime?: RuntimeSnapshot;
  readonly commandCompatibility?: readonly ExtensionCommandCompatibilityRecord[];
  readonly onRefresh: () => void;
  readonly onOpenExtensionFolder: (filePath: string) => void;
  readonly onToggleExtension: (filePath: string, enabled: boolean) => void;
}

export function ExtensionsView({
  workspace,
  runtime,
  commandCompatibility = [],
  onRefresh,
  onOpenExtensionFolder,
  onToggleExtension,
}: ExtensionsViewProps) {
  const [query, setQuery] = useState("");
  const [selectedExtensionPath, setSelectedExtensionPath] = useState<string | undefined>();
  const extensions = runtime?.extensions ?? [];
  const filteredExtensions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return extensions;
    }

    return extensions.filter((extension) =>
      [
        extension.displayName,
        extension.path,
        extension.sourceInfo.source,
        extension.sourceInfo.scope,
        extension.sourceInfo.origin,
        ...extension.commands,
        ...extension.tools,
        ...extension.flags,
        ...extension.shortcuts,
        ...extension.diagnostics.map((diagnostic) => diagnostic.message),
      ].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [extensions, query]);
  const selectedExtension =
    filteredExtensions.find((extension) => extension.path === selectedExtensionPath) ?? filteredExtensions[0];
  const selectedCompatibilityRecords = useMemo(
    () =>
      selectedExtension
        ? commandCompatibility
            .filter((record) => record.extensionPath === selectedExtension.path)
            .sort((left, right) => left.commandName.localeCompare(right.commandName))
        : [],
    [commandCompatibility, selectedExtension],
  );

  if (!workspace) {
    return (
      <section className="canvas canvas--empty">
        <div className="empty-panel">
          <div className="session-header__eyebrow">扩展</div>
          <h1>选择工作区</h1>
          <p>扩展会从当前工作区和用户级扩展目录中发现。</p>
        </div>
      </section>
    );
  }

  return (
    <section className="canvas">
      <div className="conversation skills-view">
        <header className="view-header">
          <div>
            <div className="chat-header__eyebrow">扩展</div>
            <h1 className="view-header__title">扩展</h1>
            <p className="view-header__body">
              查看并管理当前工作区的运行时扩展。
            </p>
          </div>
          <div className="view-header__actions">
            <button className="button button--secondary" type="button" onClick={onRefresh}>
              <RefreshIcon />
              <span>刷新</span>
            </button>
          </div>
        </header>

        <div className="skills-toolbar">
          <input
            aria-label="搜索扩展"
            className="skills-search"
            placeholder="搜索扩展"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
        </div>

        <div className="skills-layout">
          <div className="skills-grid" data-testid="extensions-list">
            {filteredExtensions.length === 0 ? (
              <ExtensionsEmptyState message="刷新运行时发现结果，以加载工作区和用户级扩展。" />
            ) : (
              filteredExtensions.map((extension) => (
                <button
                  className={`skill-card ${selectedExtension?.path === extension.path ? "skill-card--active" : ""}`}
                  key={extension.path}
                  type="button"
                  onClick={() => {
                    setSelectedExtensionPath(extension.path);
                  }}
                >
                  <span className="skill-card__title-row">
                    <span className="skill-card__title">{extension.displayName}</span>
                    <span className={`skill-card__badge ${extension.enabled ? "skill-card__badge--enabled" : ""}`}>
                      {extension.enabled ? "已启用" : "已停用"}
                    </span>
                  </span>
                  <span className="skill-card__description">
                    {extension.sourceInfo.scope} · {extension.sourceInfo.origin}
                  </span>
                  <span className="skill-card__meta">
                    <span>{extension.sourceInfo.source}</span>
                    {extension.commands.length > 0 ? <span>{extension.commands.length} 个命令</span> : null}
                    {extension.tools.length > 0 ? <span>{extension.tools.length} 个工具</span> : null}
                    {extension.diagnostics.length > 0 ? <span>{extension.diagnostics.length} 个问题</span> : null}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="skill-detail">
            {selectedExtension ? (
              <>
                <div className="skill-detail__header">
                  <div>
                    <h2>{selectedExtension.displayName}</h2>
                    <div className="skill-detail__slash">{selectedExtension.sourceInfo.source}</div>
                  </div>
                  <span className={`skill-detail__status ${selectedExtension.enabled ? "skill-detail__status--enabled" : ""}`}>
                    {selectedExtension.enabled ? "已启用" : "已停用"}
                  </span>
                </div>
                <div className="skill-detail__meta-list">
                  <DetailItem label="范围" value={selectedExtension.sourceInfo.scope} />
                  <DetailItem label="来源" value={selectedExtension.sourceInfo.origin} />
                  <DetailItem label="路径" value={selectedExtension.path} mono />
                  {selectedExtension.sourceInfo.baseDir ? (
                    <DetailItem label="基础目录" value={selectedExtension.sourceInfo.baseDir} mono />
                  ) : null}
                </div>
                <div className="skill-detail__actions">
                  <button className="button button--secondary" type="button" onClick={() => onOpenExtensionFolder(selectedExtension.path)}>
                    打开文件夹
                  </button>
                  <button
                    className="button button--secondary"
                    type="button"
                    onClick={() => onToggleExtension(selectedExtension.path, !selectedExtension.enabled)}
                  >
                    {selectedExtension.enabled ? "停用" : "启用"}
                  </button>
                </div>

                <ExtensionContributionSection title="命令" items={selectedExtension.commands} emptyLabel="未贡献命令。" />
                <ExtensionCompatibilitySection
                  commands={selectedExtension.commands}
                  compatibilityRecords={selectedCompatibilityRecords}
                />
                <ExtensionContributionSection title="工具" items={selectedExtension.tools} emptyLabel="未贡献工具。" />
                <ExtensionContributionSection title="标志" items={selectedExtension.flags} emptyLabel="未贡献标志。" />
                <ExtensionContributionSection title="快捷方式" items={selectedExtension.shortcuts} emptyLabel="未贡献快捷方式。" />
                <ExtensionDiagnostics diagnostics={selectedExtension.diagnostics} />
              </>
            ) : (
              <ExtensionsEmptyState message="刷新运行时发现结果，以查看扩展元数据和诊断。" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function DetailItem({
  label,
  value,
  mono,
}: {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
}) {
  return (
    <div>
      <div className="skill-detail__meta-label">{label}</div>
      <div className={mono ? "skill-detail__path" : "skill-detail__description"}>{value}</div>
    </div>
  );
}

function ExtensionContributionSection({
  title,
  items,
  emptyLabel,
}: {
  readonly title: string;
  readonly items: readonly string[];
  readonly emptyLabel: string;
}) {
  return (
    <div className="skill-detail__meta-list">
      <div>
        <div className="skill-detail__meta-label">{title}</div>
        {items.length > 0 ? (
          <div className="extension-detail__tokens">
            {items.map((item) => (
              <span className="slash-menu__skill-badge" key={item}>
                {item}
              </span>
            ))}
          </div>
        ) : (
          <div className="skill-detail__description">{emptyLabel}</div>
        )}
      </div>
    </div>
  );
}

function ExtensionDiagnostics({
  diagnostics,
}: {
  readonly diagnostics: RuntimeExtensionRecord["diagnostics"];
}) {
  return (
    <div className="skill-detail__meta-list">
      <div>
        <div className="skill-detail__meta-label">诊断</div>
        {diagnostics.length > 0 ? (
          <div className="extension-detail__diagnostics">
            {diagnostics.map((diagnostic, index) => (
              <div className={`activity-item activity-item--${diagnostic.type === "error" ? "error" : "info"}`} key={`${diagnostic.message}:${index}`}>
                <div className="activity-item__text">{diagnostic.message}</div>
                {diagnostic.path ? <div className="activity-item__meta">{diagnostic.path}</div> : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="skill-detail__description">暂无诊断。</div>
        )}
      </div>
    </div>
  );
}

function ExtensionCompatibilitySection({
  commands,
  compatibilityRecords,
}: {
  readonly commands: readonly string[];
  readonly compatibilityRecords: readonly ExtensionCommandCompatibilityRecord[];
}) {
  const supported = compatibilityRecords.filter((record) => record.status === "supported");
  const terminalOnly = compatibilityRecords.filter((record) => record.status === "terminal-only");
  const unknown = commands.filter((commandName) =>
    compatibilityRecords.every(
      (record) => record.commandName !== commandName && !record.commandName.startsWith(`${commandName}:`),
    ),
  );

  return (
    <div className="skill-detail__meta-list">
      <div>
        <div className="skill-detail__meta-label">命令兼容性</div>
        <div className="skill-detail__description">
          根据真实 GUI 执行结果学习。未列出的命令在执行前保持未知状态。
        </div>
        <div className="extension-detail__tokens">
          {supported.map((record) => (
            <span className="slash-menu__skill-badge" key={`supported:${record.commandName}`}>
              {record.commandName} · GUI 兼容
            </span>
          ))}
          {terminalOnly.map((record) => (
            <span className="slash-menu__skill-badge slash-menu__skill-badge--warning" key={`terminal:${record.commandName}`}>
              {record.commandName} · 仅终端
            </span>
          ))}
          {unknown.map((commandName) => (
            <span className="slash-menu__skill-badge" key={`unknown:${commandName}`}>
              {commandName} · 未知
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExtensionsEmptyState({ message }: { readonly message: string }) {
  return (
    <div className="empty-state">
      <h2>未找到扩展</h2>
      <p>{message}</p>
    </div>
  );
}
