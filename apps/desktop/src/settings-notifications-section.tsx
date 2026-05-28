import type { DesktopNotificationPermissionStatus } from "./ipc";
import type { NotificationPreferences } from "./desktop-state";
import { SettingsGroup, SettingsRow } from "./settings-utils";

interface SettingsNotificationsSectionProps {
  readonly notificationPreferences: NotificationPreferences;
  readonly notificationPermissionStatus: DesktopNotificationPermissionStatus;
  readonly notificationPermissionPending: boolean;
  readonly onSetNotificationPreferences: (preferences: Partial<NotificationPreferences>) => void;
  readonly onRequestNotificationPermission: () => void;
  readonly onOpenSystemNotificationSettings: () => void;
}

export function SettingsNotificationsSection({
  notificationPreferences,
  notificationPermissionStatus,
  notificationPermissionPending,
  onSetNotificationPreferences,
  onRequestNotificationPermission,
  onOpenSystemNotificationSettings,
}: SettingsNotificationsSectionProps) {
  const statusLabel = labelForPermissionStatus(notificationPermissionStatus);
  const statusDescription = descriptionForPermissionStatus(notificationPermissionStatus);
  const showAskMacOs = notificationPermissionStatus === "default";
  const showOpenSystemSettings = notificationPermissionStatus === "denied";
  const showRecoveryActions = showAskMacOs || showOpenSystemSettings;

  return (
    <>
      <SettingsGroup title="系统" description="macOS 决定 pi-gui 是否可以显示桌面通知。">
        <SettingsRow title="macOS 通知权限" description={statusDescription}>
          <span className="settings-row__value">{statusLabel}</span>
        </SettingsRow>
        {showRecoveryActions ? (
          <SettingsRow
            title="开启通知"
            description={
              showAskMacOs
                ? "当活跃任务第一次进入后台时，pi-gui 会向 macOS 请求通知权限。你也可以现在请求。"
                : "macOS 已关闭 pi-gui 的通知权限。打开系统设置可以重新启用。"
            }
          >
            <div className="settings-row__actions">
              {showAskMacOs ? (
                <button
                  className="button button--secondary"
                  disabled={notificationPermissionPending}
                  type="button"
                  onClick={onRequestNotificationPermission}
                >
                  请求 macOS 授权
                </button>
              ) : null}
              {showOpenSystemSettings ? (
                <button
                  className="button button--secondary"
                  disabled={notificationPermissionPending}
                  type="button"
                  onClick={onOpenSystemNotificationSettings}
                >
                  打开系统设置
                </button>
              ) : null}
            </div>
          </SettingsRow>
        ) : null}
      </SettingsGroup>

      <SettingsGroup title="应用内提醒" description="系统权限开启后，选择哪些后台事件需要提醒。">
        <SettingsRow title="后台完成" description="后台会话完成时发送通知。">
          <input
            aria-label="后台完成"
            checked={notificationPreferences.backgroundCompletion}
            type="checkbox"
            onChange={(event) => onSetNotificationPreferences({ backgroundCompletion: event.target.checked })}
          />
        </SettingsRow>
        <SettingsRow title="后台失败" description="后台会话失败时发送通知。">
          <input
            aria-label="后台失败"
            checked={notificationPreferences.backgroundFailure}
            type="checkbox"
            onChange={(event) => onSetNotificationPreferences({ backgroundFailure: event.target.checked })}
          />
        </SettingsRow>
        <SettingsRow title="需要输入或确认" description="需要输入才能继续时发送通知。">
          <input
            aria-label="需要输入或确认"
            checked={notificationPreferences.attentionNeeded}
            type="checkbox"
            onChange={(event) => onSetNotificationPreferences({ attentionNeeded: event.target.checked })}
          />
        </SettingsRow>
      </SettingsGroup>
    </>
  );
}

function labelForPermissionStatus(status: DesktopNotificationPermissionStatus): string {
  switch (status) {
    case "granted":
      return "已开启";
    case "denied":
      return "已关闭";
    case "default":
      return "尚未开启";
    case "unsupported":
      return "不可用";
    default:
      return "检查中...";
  }
}

function descriptionForPermissionStatus(status: DesktopNotificationPermissionStatus): string {
  switch (status) {
    case "granted":
      return "macOS 允许 pi-gui 为后台会话更新显示桌面通知。";
    case "denied":
      return "macOS 已关闭 pi-gui 的通知权限。请在系统设置中开启，以接收后台完成提醒。";
    case "default":
      return "pi-gui 还没有向 macOS 请求桌面通知权限。";
    case "unsupported":
      return "当前系统不可用桌面通知。";
    default:
      return "正在检查 pi-gui 是否可以使用 macOS 通知。";
  }
}
