import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  seedAgentDir,
  waitForWorkspaceByPath,
} from "../helpers/electron-app";

test("ontology workbench exposes Chinese VS Code style navigation and model configuration", async () => {
  test.setTimeout(60_000);
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspacePath = await makeWorkspace("ontology-workbench-navigation");
  await seedAgentDir(agentDir, {
    withOpenAiAuth: false,
    withDefaultModel: false,
    enabledModels: ["openai/gpt-5"],
  });

  const harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspacePath],
    scrubProviderEnv: true,
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await waitForWorkspaceByPath(window, workspacePath);

    const menu = window.getByTestId("app-menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("button", { name: "数据导入" })).toBeVisible();
    await expect(menu.getByRole("button", { name: "本体建模" })).toBeVisible();
    await expect(menu.getByRole("button", { name: "模型配置" })).toBeVisible();
    await expect(menu.getByRole("button", { name: "主题" })).toBeVisible();

    await menu.getByRole("button", { name: "本体建模" }).click();
    await expect(window.locator(".ontology-workbench-nav")).toBeVisible();
    await expect(window.locator(".ontology-workbench-nav").getByRole("button", { name: "数据导入" })).toBeVisible();
    await window.locator(".ontology-workbench-nav").getByRole("button", { name: "数据导入" }).click();
    await expect(window.locator(".data-import-view")).toBeVisible();

    await menu.getByRole("button", { name: "模型配置" }).click();
    await expect(window.getByTestId("settings-surface")).toBeVisible();
    await expect(window.locator(".view-header__title")).toHaveText("模型配置");
    await expect(window.getByLabel("搜索服务商")).toBeVisible();

    const allProviders = window.locator(".settings-section", {
      has: window.locator(".settings-section__title", { hasText: "全部服务商" }),
    });
    const openAiRow = allProviders.locator(".settings-row", {
      has: window.locator(".settings-row__title", { hasText: /^openai$/ }),
    });
    await openAiRow.getByRole("button", { name: "设置 API Key" }).click();
    const dialog = window.getByTestId("provider-api-key-dialog");
    await expect(dialog.getByLabel("openai API Key")).toBeVisible();
    await expect(dialog.getByLabel("openai Base URL")).toBeVisible();
  } finally {
    await harness.close();
  }
});
