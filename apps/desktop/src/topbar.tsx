import type { MouseEvent as ReactMouseEvent, Dispatch, SetStateAction } from "react";
import type { AppView, DesktopAppState, SessionRecord, WorkspaceRecord, WorktreeRecord } from "./desktop-state";
import {
  DataImportIcon,
  DiffIcon,
  FolderIcon,
  OntologyModelerIcon,
  OwlExportIcon,
  PiLogoMark,
  SettingsIcon,
  TerminalIcon,
} from "./icons";
import { getDesktopShortcutLabel, type PiDesktopApi } from "./ipc";
import type { WorkspaceMenuState } from "./hooks/use-workspace-menu";

interface TopbarProps {
  readonly activeView: AppView;
  readonly rootWorkspace: WorkspaceRecord | undefined;
  readonly selectedWorkspace: WorkspaceRecord | undefined;
  readonly selectedSession: SessionRecord | undefined;
  readonly selectedSessionTitle: string | undefined;
  readonly selectedWorktree: WorktreeRecord | undefined;
  readonly activeWorktrees: readonly WorktreeRecord[];
  readonly workspaces: readonly WorkspaceRecord[];
  readonly wsMenu: WorkspaceMenuState;
  readonly api: PiDesktopApi;
  readonly setSnapshot: Dispatch<SetStateAction<DesktopAppState | null>>;
  readonly updateSnapshot: (
    api: PiDesktopApi,
    setSnapshot: Dispatch<SetStateAction<DesktopAppState | null>>,
    action: () => Promise<DesktopAppState>,
  ) => Promise<DesktopAppState>;
  readonly terminalAvailable: boolean;
  readonly terminalVisible: boolean;
  readonly onToggleTerminal: () => void;
  readonly showDiffPanel: boolean;
  readonly onToggleDiffPanel: () => void;
  readonly themeMode: "system" | "light" | "dark";
  readonly onOpenThreads: () => void;
  readonly onOpenDataImport: () => void;
  readonly onOpenOntologyModeler: () => void;
  readonly onOpenOwlExport: () => void;
  readonly onOpenModelSettings: () => void;
  readonly onCycleTheme: () => void;
}

export function Topbar(props: TopbarProps) {
  const {
    activeView,
    rootWorkspace,
    selectedWorkspace,
    selectedSession,
    selectedSessionTitle,
    selectedWorktree,
    activeWorktrees,
    workspaces,
    wsMenu,
    api,
    setSnapshot,
    updateSnapshot,
    terminalAvailable,
    terminalVisible,
    onToggleTerminal,
    showDiffPanel,
    onToggleDiffPanel,
    themeMode,
    onOpenThreads,
    onOpenDataImport,
    onOpenOntologyModeler,
    onOpenOwlExport,
    onOpenModelSettings,
    onCycleTheme,
  } = props;
  const terminalShortcut = getDesktopShortcutLabel(api.platform, "J");
  const diffShortcut = getDesktopShortcutLabel(api.platform, "D");
  const themeLabel = themeMode === "dark" ? "深色" : themeMode === "light" ? "浅色" : "跟随系统";

  const handleDoubleClick = (event: ReactMouseEvent<HTMLElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.closest(".topbar__actions")) {
      return;
    }

    void api.toggleWindowMaximize();
  };

  return (
    <header className="topbar" data-testid="topbar" onDoubleClick={handleDoubleClick}>
      <div className="topbar__left">
        <div className="topbar__brand" aria-label="本体大师">
          <PiLogoMark />
        </div>
        <nav className="topbar__menu" data-testid="app-menu" aria-label="主菜单">
          <button
            className={`topbar__menu-item ${activeView === "threads" || activeView === "new-thread" ? "topbar__menu-item--active" : ""}`}
            type="button"
            onClick={onOpenThreads}
          >
            <FolderIcon />
            <span>会话</span>
          </button>
          <button
            className={`topbar__menu-item ${activeView === "data-import" ? "topbar__menu-item--active" : ""}`}
            type="button"
            onClick={onOpenDataImport}
          >
            <DataImportIcon />
            <span>数据导入</span>
          </button>
          <button
            className={`topbar__menu-item ${activeView === "ontology-modeler" ? "topbar__menu-item--active" : ""}`}
            type="button"
            onClick={onOpenOntologyModeler}
          >
            <OntologyModelerIcon />
            <span>本体建模</span>
          </button>
          <button
            className={`topbar__menu-item ${activeView === "owl-export" ? "topbar__menu-item--active" : ""}`}
            type="button"
            onClick={onOpenOwlExport}
          >
            <OwlExportIcon />
            <span>OWL 导出</span>
          </button>
          <button className="topbar__menu-item" type="button" onClick={onOpenModelSettings}>
            <SettingsIcon />
            <span>模型配置</span>
          </button>
          <button className="topbar__menu-item" type="button" title={`当前主题：${themeLabel}`} onClick={onCycleTheme}>
            <span className="topbar__menu-dot" aria-hidden="true" />
            <span>主题</span>
          </button>
        </nav>
      </div>

      <div className="topbar__title">
        <span className="topbar__workspace">
          {rootWorkspace ? rootWorkspace.name : "打开文件夹开始"}
        </span>
        {selectedWorkspace && activeView === "threads" ? (
          <>
            <span className="topbar__separator">/</span>
            <div className="environment-picker" ref={wsMenu.environmentMenuRef}>
              <button
                aria-expanded={wsMenu.environmentMenuOpen}
                aria-haspopup="menu"
                className="environment-picker__button"
                type="button"
                onClick={() => wsMenu.setEnvironmentMenuOpen((current) => !current)}
              >
                {selectedWorkspace.kind === "worktree" ? selectedWorktree?.name ?? selectedWorkspace.name : "本地"}
              </button>
              {wsMenu.environmentMenuOpen && rootWorkspace ? (
                <div className="workspace-menu environment-picker__menu">
                  <button
                    className="workspace-menu__item"
                    type="button"
                    onClick={() => wsMenu.selectWorkspace(rootWorkspace.id)}
                  >
                    本地
                  </button>
                  {activeWorktrees.map((worktree) => {
                    const linkedWorkspace = workspaces.find(
                      (workspace) => workspace.id === worktree.linkedWorkspaceId,
                    );
                    const worktreeSelectable = Boolean(linkedWorkspace) && worktree.status === "ready";
                    return (
                      <button
                        className="workspace-menu__item"
                        key={worktree.id}
                        type="button"
                        disabled={!worktreeSelectable}
                        onClick={() => {
                          if (worktreeSelectable && linkedWorkspace) {
                            wsMenu.selectWorkspace(linkedWorkspace.id);
                          }
                        }}
                      >
                        {worktree.name}
                        {!worktreeSelectable ? `（${worktree.status !== "ready" ? worktree.status : "不可用"}）` : ""}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </>
        ) : null}
        {selectedWorkspace && activeView === "threads" && selectedSession ? (
          <>
            <span className="topbar__separator">/</span>
            <span className="topbar__session">{selectedSessionTitle ?? selectedSession.title}</span>
          </>
        ) : activeView === "new-thread" && rootWorkspace ? (
          <>
            <span className="topbar__separator">/</span>
            <span className="topbar__session">新建会话</span>
          </>
        ) : null}
      </div>

      <div className="topbar__actions">
        <div className="shortcut-tooltip-wrap topbar__tooltip-wrap">
          <button
            aria-label="切换终端"
            className={`icon-button topbar__icon ${terminalVisible ? "icon-button--active" : ""}`}
            type="button"
            disabled={!terminalAvailable}
            onClick={onToggleTerminal}
          >
            <TerminalIcon />
          </button>
          <span className="shortcut-tooltip topbar__tooltip" role="tooltip">
            <span>切换终端</span>
            <kbd>{terminalShortcut}</kbd>
          </span>
        </div>
        <div className="shortcut-tooltip-wrap topbar__tooltip-wrap">
          <button
            aria-label="切换变更"
            className={`icon-button topbar__icon ${showDiffPanel ? "icon-button--active" : ""}`}
            type="button"
            onClick={onToggleDiffPanel}
          >
            <DiffIcon />
          </button>
          <span className="shortcut-tooltip topbar__tooltip" role="tooltip">
            <span>切换变更</span>
            <kbd>{diffShortcut}</kbd>
          </span>
        </div>
        <button
          aria-label="添加文件夹"
          className="icon-button topbar__icon"
          type="button"
          onClick={() => {
            void updateSnapshot(api, setSnapshot, () => api.pickWorkspace());
          }}
        >
          <FolderIcon />
        </button>
      </div>
    </header>
  );
}
