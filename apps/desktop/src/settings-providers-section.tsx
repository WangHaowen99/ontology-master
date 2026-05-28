import { useEffect, useState } from "react";
import type { RuntimeSnapshot } from "@pi-gui/session-driver/runtime-types";
import { filterProviders, ProviderRow, SettingsGroup } from "./settings-utils";

interface SettingsProvidersSectionProps {
  readonly runtime?: RuntimeSnapshot;
  readonly onLoginProvider: (providerId: string) => void;
  readonly onLogoutProvider: (providerId: string) => void;
  readonly onSetProviderApiKey: (providerId: string, apiKey: string) => Promise<string | undefined>;
  readonly onSetProviderBaseUrl: (providerId: string, baseUrl: string) => Promise<string | undefined>;
  readonly onRemoveProviderApiKey: (providerId: string) => Promise<string | undefined>;
}

export function SettingsProvidersSection({
  runtime,
  onLoginProvider,
  onLogoutProvider,
  onSetProviderApiKey,
  onSetProviderBaseUrl,
  onRemoveProviderApiKey,
}: SettingsProvidersSectionProps) {
  const [providerQuery, setProviderQuery] = useState("");
  const [apiKeyProviderId, setApiKeyProviderId] = useState<string | undefined>();
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [baseUrlDraft, setBaseUrlDraft] = useState("");
  const [apiKeyError, setApiKeyError] = useState<string | undefined>();
  const [apiKeyPending, setApiKeyPending] = useState(false);

  const providers = runtime?.providers ?? [];
  const connectedProviders = providers.filter((p) => p.hasAuth);
  const oauthProviders = providers.filter((p) => p.oauthSupported);
  const filteredProviders = filterProviders(providers, providerQuery);
  const apiKeyProvider = apiKeyProviderId ? providers.find((provider) => provider.id === apiKeyProviderId) : undefined;

  useEffect(() => {
    setApiKeyDraft("");
    setBaseUrlDraft(apiKeyProvider?.baseUrl ?? "");
    setApiKeyError(undefined);
    setApiKeyPending(false);
  }, [apiKeyProvider?.baseUrl, apiKeyProviderId]);

  const closeApiKeyDialog = () => {
    if (apiKeyPending) {
      return;
    }
    setApiKeyProviderId(undefined);
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyProvider) {
      return;
    }
    setApiKeyPending(true);
    setApiKeyError(undefined);
    const baseUrlError = await onSetProviderBaseUrl(apiKeyProvider.id, baseUrlDraft.trim());
    if (baseUrlError) {
      setApiKeyPending(false);
      setApiKeyError(baseUrlError);
      return;
    }
    const nextError = apiKeyDraft.trim()
      ? await onSetProviderApiKey(apiKeyProvider.id, apiKeyDraft.trim())
      : undefined;
    if (nextError) {
      setApiKeyPending(false);
      setApiKeyError(nextError);
      return;
    }
    setApiKeyProviderId(undefined);
  };

  const handleRemoveApiKey = async () => {
    if (!apiKeyProvider) {
      return;
    }
    setApiKeyPending(true);
    setApiKeyError(undefined);
    const nextError = await onRemoveProviderApiKey(apiKeyProvider.id);
    if (nextError) {
      setApiKeyPending(false);
      setApiKeyError(nextError);
      return;
    }
    setApiKeyProviderId(undefined);
  };

  return (
    <>
      <SettingsGroup title="已连接" description="已连接的服务商会优先用于模型选择。">
        {connectedProviders.length > 0 ? (
          connectedProviders.map((provider) => (
            <ProviderRow
              key={provider.id}
              provider={provider}
              onLoginProvider={onLoginProvider}
              onLogoutProvider={onLogoutProvider}
              onConfigureApiKey={(entry) => setApiKeyProviderId(entry.id)}
            />
          ))
        ) : (
          <div className="settings-row">
            <span className="settings-row__description">还没有连接模型服务商。</span>
          </div>
        )}
      </SettingsGroup>

      <SettingsGroup title="登录" description="支持 OAuth 的服务商可以直接在桌面端登录。">
        {oauthProviders.map((provider) => (
          <ProviderRow
            key={provider.id}
            provider={provider}
            onLoginProvider={onLoginProvider}
            onLogoutProvider={onLogoutProvider}
            onConfigureApiKey={(entry) => setApiKeyProviderId(entry.id)}
          />
        ))}
      </SettingsGroup>

      <SettingsGroup title="全部服务商" description="查看可用模型服务商，并配置 API Key 或 Base URL。">
        <details className="settings-disclosure" open>
          <summary className="settings-disclosure__summary">
            <span>浏览全部服务商</span>
            <span>{filteredProviders.length}</span>
          </summary>
          <div className="settings-disclosure__body">
            <input
              aria-label="搜索服务商"
              className="settings-search"
              placeholder="搜索服务商"
              value={providerQuery}
              onChange={(event) => setProviderQuery(event.target.value)}
            />
            <div className="settings-list">
              {filteredProviders.map((provider) => (
                <ProviderRow
                  key={provider.id}
                  provider={provider}
                  onLoginProvider={onLoginProvider}
                  onLogoutProvider={onLogoutProvider}
                  onConfigureApiKey={(entry) => setApiKeyProviderId(entry.id)}
                />
              ))}
            </div>
          </div>
        </details>
      </SettingsGroup>

      {apiKeyProvider ? (
        <ProviderApiKeyDialog
          provider={apiKeyProvider}
          draft={apiKeyDraft}
          baseUrlDraft={baseUrlDraft}
          error={apiKeyError}
          pending={apiKeyPending}
          onChangeDraft={setApiKeyDraft}
          onChangeBaseUrl={setBaseUrlDraft}
          onClose={closeApiKeyDialog}
          onRemove={apiKeyProvider.authSource === "auth_file" ? handleRemoveApiKey : undefined}
          onSave={handleSaveApiKey}
        />
      ) : null}
    </>
  );
}

function ProviderApiKeyDialog({
  provider,
  draft,
  baseUrlDraft,
  error,
  pending,
  onChangeDraft,
  onChangeBaseUrl,
  onClose,
  onRemove,
  onSave,
}: {
  readonly provider: RuntimeSnapshot["providers"][number];
  readonly draft: string;
  readonly baseUrlDraft: string;
  readonly error?: string;
  readonly pending: boolean;
  readonly onChangeDraft: (value: string) => void;
  readonly onChangeBaseUrl: (value: string) => void;
  readonly onClose: () => void;
  readonly onRemove?: () => Promise<void>;
  readonly onSave: () => Promise<void>;
}) {
  const title = provider.authSource === "auth_file" ? "管理模型服务商" : "设置模型服务商";
  const body =
    provider.authSource === "auth_file"
      ? `更新 ${provider.name} 的 API Key 或 Base URL。`
      : `为 ${provider.name} 本地保存 API Key，并可按需设置 Base URL。`;

  return (
    <div className="extension-dialog-backdrop">
      <div className="extension-dialog" data-testid="provider-api-key-dialog">
        <div className="extension-dialog__title">{title}</div>
        <p className="extension-dialog__body">{body}</p>
        <input
          aria-label={`${provider.name} API Key`}
          autoFocus
          className="settings-search"
          disabled={pending}
          placeholder="输入 API Key"
          type="password"
          value={draft}
          onChange={(event) => onChangeDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
              return;
            }
            if (event.key === "Enter" && (draft.trim() || baseUrlDraft.trim())) {
              event.preventDefault();
              void onSave();
            }
          }}
        />
        <input
          aria-label={`${provider.name} Base URL`}
          className="settings-search"
          disabled={pending}
          placeholder="Base URL，例如 https://api.openai.com/v1"
          type="url"
          value={baseUrlDraft}
          onChange={(event) => onChangeBaseUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
              return;
            }
            if (event.key === "Enter" && (draft.trim() || baseUrlDraft.trim())) {
              event.preventDefault();
              void onSave();
            }
          }}
        />
        {error ? <p className="extension-dialog__body settings-warning">{error}</p> : null}
        <div className="extension-dialog__actions">
          <button className="button button--secondary" disabled={pending} type="button" onClick={onClose}>
            取消
          </button>
          {onRemove ? (
            <button className="button button--secondary" disabled={pending} type="button" onClick={() => void onRemove()}>
              移除已保存 Key
            </button>
          ) : null}
          <button
            className="button"
            disabled={pending || (draft.trim().length === 0 && baseUrlDraft.trim().length === 0)}
            type="button"
            onClick={() => void onSave()}
          >
            保存配置
          </button>
        </div>
      </div>
    </div>
  );
}
