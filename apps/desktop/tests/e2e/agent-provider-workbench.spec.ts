import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  closePromptHub,
  launchPromptHub,
  sendAppCommand,
  setAppLanguage,
} from "./helpers/electron";

async function selectAgent(page: Page, name: string): Promise<void> {
  const search = page.getByPlaceholder("Search Agents");
  await search.fill(name);
  await page.getByRole("button", { name, exact: true }).click();
  await search.fill("");
}

test("uses one Provider workbench shell for Claude Code, Codex and Pi", async ({}, testInfo) => {
  const userDataDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "prompthub-provider-workbench-e2e-"),
  );
  const homeDir = path.join(userDataDir, "home");
  const claudeDir = path.join(homeDir, ".claude");
  const codexDir = path.join(homeDir, ".codex");
  const piDir = path.join(homeDir, ".pi", "agent");
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.mkdirSync(codexDir, { recursive: true });
  fs.mkdirSync(piDir, { recursive: true });
  fs.writeFileSync(
    path.join(claudeDir, "settings.json"),
    JSON.stringify({ model: "claude-sonnet" }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(codexDir, "config.toml"),
    'model = "gpt-5.6-sol"\n',
    "utf8",
  );
  fs.writeFileSync(
    path.join(piDir, "settings.json"),
    JSON.stringify({ defaultProvider: "kimi-coding", defaultModel: "k3" }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(piDir, "models-store.json"),
    JSON.stringify({
      "kimi-coding": {
        models: [
          {
            id: "k3",
            name: "Kimi K3",
            api: "anthropic-messages",
            baseUrl: "https://api.kimi.com/coding",
          },
        ],
      },
    }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(piDir, "models.json"),
    JSON.stringify({
      providers: {
        foxcode: {
          baseUrl: "https://gateway.example.com/v1",
          api: "openai-responses",
          models: [
            {
              id: "gpt-work",
              name: "GPT Work",
              contextWindow: 256000,
              reasoning: true,
            },
          ],
        },
      },
    }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(piDir, "auth.json"),
    JSON.stringify({ foxcode: { type: "api_key", key: "pi-e2e-secret" } }),
    "utf8",
  );
  const configDir = path.join(userDataDir, "config");
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, "ai-models.json"),
    JSON.stringify({
      kind: "prompthub-ai-config",
      version: 1,
      updatedAt: "2026-08-11T00:00:00.000Z",
      providers: [
        {
          id: "deepseek-work",
          name: "DeepSeek Work",
          provider: "deepseek",
          apiProtocol: "openai",
          apiKey: "",
          apiUrl: "https://api.deepseek.com/v1",
        },
      ],
      models: [
        {
          id: "gpt-work",
          providerId: "deepseek-work",
          provider: "deepseek",
          apiProtocol: "openai",
          apiKey: "",
          apiUrl: "https://api.deepseek.com/v1",
          model: "gpt-5.6-sol",
          name: "GPT 5.6 Sol",
          type: "chat",
          isDefault: true,
        },
      ],
      modelRouteDefaults: {},
    }),
    "utf8",
  );

  const { app, page } = await launchPromptHub(null, {
    userDataDir,
    env: { HOME: homeDir, USERPROFILE: homeDir },
  });

  try {
    await setAppLanguage(page, "en");
    await page.setViewportSize({ width: 1440, height: 900 });
    await sendAppCommand(app, { type: "agent:manage" });

    await selectAgent(page, "Claude Code");
    await page.getByRole("tab", { name: "Provider & Model" }).click();
    const claudeShellClass = await page
      .getByTestId("agent-provider-workbench")
      .getAttribute("class");
    const claudeToolbarBox = await page
      .getByTestId("agent-provider-workbench-toolbar")
      .boundingBox();
    await expect(
      page.getByRole("button", { name: "Import current configuration" }),
    ).toHaveCount(0);
    await expect(
      page
        .getByTestId("agent-provider-workbench-toolbar")
        .getByText("Import from PromptHub"),
    ).toBeVisible();
    const currentProviderSwitch = page
      .getByTestId("agent-provider-workbench-sidebar")
      .getByRole("switch");
    await expect(currentProviderSwitch).toHaveCount(1);
    await expect(currentProviderSwitch).toHaveAttribute("aria-checked", "true");
    await expect(currentProviderSwitch).toBeDisabled();
    const switchTrackBox = await currentProviderSwitch.boundingBox();
    const switchThumbBox = await currentProviderSwitch
      .getByTestId("provider-activation-switch-thumb")
      .boundingBox();
    expect(switchTrackBox).not.toBeNull();
    expect(switchThumbBox).not.toBeNull();
    expect(switchThumbBox!.x).toBeGreaterThan(switchTrackBox!.x);
    expect(switchThumbBox!.x + switchThumbBox!.width).toBeLessThanOrEqual(
      switchTrackBox!.x + switchTrackBox!.width,
    );
    expect(switchThumbBox!.x).toBeGreaterThan(
      switchTrackBox!.x + switchTrackBox!.width / 2 - 2,
    );
    await expect(
      page.getByRole("button", { name: "Test connection" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Test model" }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("provider-native-test-and-switch.png"),
      animations: "disabled",
    });
    expect(
      await page
        .getByTestId("agent-provider-workbench-sidebar")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    await page
      .getByTestId("agent-provider-workbench-toolbar")
      .getByRole("button", { name: "Add custom provider" })
      .click();
    const providerEditor = page.getByRole("region", { name: "Add provider" });
    await expect(providerEditor).toBeVisible();
    await expect(
      providerEditor.getByTestId("agent-provider-form-surface"),
    ).toBeVisible();
    await expect(
      providerEditor.getByTestId("agent-provider-form-section"),
    ).toHaveCount(4);
    await expect(providerEditor.locator("select")).toHaveCount(0);
    await expect(
      providerEditor.getByLabel("Sonnet model (optional)"),
    ).toBeVisible();
    await expect(
      providerEditor.getByLabel("Opus model (optional)"),
    ).toBeVisible();
    await expect(
      providerEditor.getByLabel("Haiku model (optional)"),
    ).toBeVisible();
    await expect(
      providerEditor.getByLabel("Subagent model (optional)"),
    ).toBeVisible();
    await providerEditor.getByRole("button", { name: "Protocol" }).click();
    await expect(page.getByRole("listbox", { name: "Protocol" })).toBeVisible();
    await expect(
      page.getByRole("option", { name: "Anthropic Messages" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      await providerEditor.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("provider-inline-editor.png"),
      animations: "disabled",
    });
    await page.getByRole("option", { name: "Anthropic Messages" }).click();
    await providerEditor.getByRole("button", { name: "Cancel" }).click();

    await selectAgent(page, "Codex");
    await page.getByRole("tab", { name: "Provider & Model" }).click();
    await page
      .getByTestId("agent-provider-workbench-toolbar")
      .getByRole("button", { name: "Add custom provider" })
      .click();
    const codexEditor = page.getByRole("region", { name: "Add provider" });
    await expect(codexEditor).toBeVisible();
    await expect(
      codexEditor.getByRole("button", { name: "Reasoning effort (optional)" }),
    ).toBeVisible();
    await expect(
      codexEditor.getByLabel("Context window (optional)"),
    ).toBeVisible();
    const formSurface = codexEditor.getByTestId("agent-provider-form-surface");
    const formSurfaceBox = await formSurface.boundingBox();
    const fullWidthControls = formSurface.locator(
      '[data-testid="agent-provider-form-fields"] input, [data-testid="agent-provider-form-fields"] button[aria-haspopup="listbox"]',
    );
    const controlCount = await fullWidthControls.count();
    expect(controlCount).toBeGreaterThan(6);
    for (let index = 0; index < controlCount; index += 1) {
      const controlBox = await fullWidthControls.nth(index).boundingBox();
      expect(controlBox?.width ?? 0).toBeGreaterThan(
        (formSurfaceBox?.width ?? 0) * 0.9,
      );
    }
    await codexEditor
      .getByRole("button", { name: "Authentication source" })
      .click();
    const authenticationListbox = page.getByRole("listbox", {
      name: "Authentication source",
    });
    await expect(authenticationListbox).toBeVisible();
    await expect(authenticationListbox).toHaveClass(/rounded-md/);
    await expect(authenticationListbox).not.toHaveClass(/rounded-xl/);
    expect(
      await codexEditor.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("codex-provider-full-width-form.png"),
      animations: "disabled",
    });
    await page
      .getByRole("option", { name: "PromptHub-managed credential" })
      .click();
    await codexEditor.getByRole("button", { name: "Cancel" }).click();

    await selectAgent(page, "Pi");
    await page.getByRole("tab", { name: "Provider & Model" }).click();
    const piShell = page.getByTestId("agent-provider-workbench");
    await expect(piShell).toBeVisible();
    expect(await piShell.getAttribute("class")).toBe(claudeShellClass);
    await expect(
      page.getByRole("navigation", { name: "Pi providers" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Import from PromptHub" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add custom provider" }),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("agent-provider-workbench-toolbar")
        .locator("svg.lucide-plus"),
    ).toHaveCount(2);
    await expect(
      page.getByRole("button", { name: "Import current configuration" }),
    ).toHaveCount(0);
    await expect(page.getByText("foxcode").first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText("pi-e2e-secret");
    const piToolbarBox = await page
      .getByTestId("agent-provider-workbench-toolbar")
      .boundingBox();
    expect(piToolbarBox?.height).toBe(claudeToolbarBox?.height);
    expect(
      await page
        .getByTestId("agent-provider-workbench-sidebar")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);

    await page
      .getByRole("navigation", { name: "Pi providers" })
      .click({ button: "right" });
    await page
      .getByRole("button", { name: "Import from PromptHub" })
      .last()
      .click();
    await expect(
      page.getByRole("dialog", { name: "Import PromptHub provider" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();

    const models = JSON.parse(
      fs.readFileSync(path.join(piDir, "models.json"), "utf8"),
    );
    expect(models.providers["kimi-coding"]?.modelOverrides?.k3).toBeUndefined();

    await page.screenshot({
      path: testInfo.outputPath("pi-provider-workbench.png"),
      animations: "disabled",
    });

    await page.getByRole("button", { name: "Toggle theme" }).click();
    await page
      .getByTestId("agent-provider-workbench-toolbar")
      .getByRole("button", { name: "Import from PromptHub" })
      .click();
    const sourceDialog = page.getByRole("dialog", {
      name: "Import PromptHub provider",
    });
    await expect(sourceDialog).toBeVisible();
    await expect(
      sourceDialog.getByRole("img", { name: "DeepSeek" }),
    ).toBeVisible();
    await expect(sourceDialog.getByRole("img", { name: "GPT" })).toBeVisible();
    await sourceDialog.getByRole("button", { name: "Protocol" }).click();
    await expect(
      page.getByRole("option", { name: "OpenAI Responses" }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("provider-source-import-dark.png"),
      animations: "disabled",
    });
    await page.getByRole("option", { name: "OpenAI Responses" }).click();
    await expect(
      sourceDialog.getByRole("button", { name: "Protocol" }),
    ).toContainText("OpenAI Responses");
    await expect(
      sourceDialog.getByRole("button", { name: "Import", exact: true }),
    ).toBeEnabled();
    await page.screenshot({
      path: testInfo.outputPath("provider-source-import-selected-dark.png"),
      animations: "disabled",
    });
  } finally {
    await closePromptHub(app, userDataDir);
  }
});
