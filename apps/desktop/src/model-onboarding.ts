import type { RuntimeSnapshot } from "@pi-gui/session-driver/runtime-types";
import { buildModelOptions } from "./composer-commands";

export type ModelOnboardingSettingsSection = "models" | "providers";

export interface ModelOnboardingNotice {
  readonly title: string;
  readonly description: string;
  readonly actionLabel: string;
  readonly actionSection: ModelOnboardingSettingsSection;
}

export interface ModelOnboardingState {
  readonly hasSelectableModels: boolean;
  readonly requiresModelSelection: boolean;
  readonly unselectedModelLabel: string;
  readonly emptyModelTitle: string;
  readonly emptyModelDescription: string;
  readonly notice?: ModelOnboardingNotice;
}

interface ModelSelectionInput {
  readonly provider: string | undefined;
  readonly modelId: string | undefined;
}

export function deriveModelOnboardingState(
  runtime: RuntimeSnapshot | undefined,
  currentSelection: ModelSelectionInput,
): ModelOnboardingState {
  const selectableModels = buildModelOptions(runtime);
  const selectableSet = new Set(selectableModels.map((model) => `${model.providerId}:${model.modelId}`));
  const hasSelectableModels = selectableModels.length > 0;
  const connectedProviderCount = runtime?.providers.filter((provider) => provider.hasAuth).length ?? 0;
  const settingsDefault = {
    provider: runtime?.settings.defaultProvider,
    modelId: runtime?.settings.defaultModelId,
  };
  const hasDefaultModel = Boolean(settingsDefault.provider && settingsDefault.modelId);
  const defaultModelUsable = isUsableSelection(settingsDefault, selectableSet);
  const hasCurrentSelection = Boolean(currentSelection.provider && currentSelection.modelId);
  const currentSelectionUsable = isUsableSelection(currentSelection, selectableSet);

  if (!hasSelectableModels) {
    return {
      hasSelectableModels: false,
      requiresModelSelection: true,
      unselectedModelLabel: "暂无可用模型",
      emptyModelTitle: "暂无可用模型",
      emptyModelDescription:
        connectedProviderCount > 0
          ? "打开设置 > 模型选择启用模型。"
          : "打开设置 > 模型配置连接服务商后才能使用模型。",
      notice: connectedProviderCount > 0
        ? {
            title: "暂无可用模型",
            description: "所有可用模型当前都被禁用。请打开设置 > 模型选择启用模型。",
            actionLabel: "打开设置 > 模型选择",
            actionSection: "models",
          }
        : {
            title: "暂无可用模型",
            description: "请先在设置 > 模型配置中连接服务商，再选择模型或设置默认模型。",
            actionLabel: "打开设置 > 模型配置",
            actionSection: "providers",
          },
    };
  }

  if (hasCurrentSelection && !currentSelectionUsable) {
    return {
      hasSelectableModels: true,
      requiresModelSelection: true,
      unselectedModelLabel: "选择模型",
      emptyModelTitle: "暂无可用模型",
      emptyModelDescription: "请选择模型。",
      notice: {
        title: "所选模型不可用",
        description: hasDefaultModel
          ? "此会话选择的模型已不可用。请选择另一个模型，然后打开设置 > 模型选择更新默认值。"
          : "此会话选择的模型已不可用。请选择另一个模型，然后打开设置 > 模型选择设置应用默认值。",
        actionLabel: "打开设置 > 模型选择",
        actionSection: "models",
      },
    };
  }

  if (!hasDefaultModel) {
    return {
      hasSelectableModels: true,
      requiresModelSelection: !currentSelectionUsable,
      unselectedModelLabel: "选择模型",
      emptyModelTitle: "未设置默认模型",
      emptyModelDescription: "请选择模型。",
      notice: currentSelectionUsable
        ? undefined
        : {
            title: "未设置默认模型",
            description: "请在设置 > 模型选择中设置默认模型。",
            actionLabel: "打开设置 > 模型选择",
            actionSection: "models",
          },
    };
  }

  if (!defaultModelUsable) {
    const defaultLabel = `${settingsDefault.provider}:${settingsDefault.modelId}`;
    return {
      hasSelectableModels: true,
      requiresModelSelection: !currentSelectionUsable,
      unselectedModelLabel: "选择模型",
      emptyModelTitle: "默认模型不可用",
      emptyModelDescription: "请选择模型。",
      notice: {
        title: "默认模型不可用",
        description: currentSelectionUsable
          ? `已保存的默认模型（${defaultLabel}）已不可用。请打开设置 > 模型选择更新。`
          : `已保存的默认模型（${defaultLabel}）已不可用。请先为此会话选择模型，再打开设置 > 模型选择更新。`,
        actionLabel: "打开设置 > 模型选择",
        actionSection: "models",
      },
    };
  }

  return {
    hasSelectableModels: true,
    requiresModelSelection: false,
    unselectedModelLabel: "选择模型",
    emptyModelTitle: "暂无可用模型",
    emptyModelDescription: "请选择模型。",
  };
}

function isUsableSelection(
  selection: ModelSelectionInput,
  selectableSet: ReadonlySet<string>,
): boolean {
  return Boolean(selection.provider && selection.modelId && selectableSet.has(`${selection.provider}:${selection.modelId}`));
}
