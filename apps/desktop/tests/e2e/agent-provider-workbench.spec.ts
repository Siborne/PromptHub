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

test("uses one Provider workbench shell for Claude Code and Pi", async ({}, testInfo) => {
  const userDataDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "prompthub-provider-workbench-e2e-"),
  );
  const homeDir = path.join(userDataDir, "home");
  const claudeDir = path.join(homeDir, ".claude");
  const piDir = path.join(homeDir, ".pi", "agent");
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.mkdirSync(piDir, { recursive: true });
  fs.writeFileSync(
    path.join(claudeDir, "settings.json"),
    JSON.stringify({ model: "claude-sonnet" }),
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
      page
        .getByTestId("agent-provider-workbench-toolbar")
        .getByText("Import current configuration"),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("agent-provider-workbench-toolbar")
        .getByText("Import from PromptHub"),
    ).toBeVisible();
    expect(
      await page
        .getByTestId("agent-provider-workbench-sidebar")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);

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
    const importCurrent = page.getByRole("button", {
      name: "Import current configuration",
    });
    await expect(importCurrent).toBeEnabled();
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

    await importCurrent.click();
    await page.getByRole("button", { name: "Create override" }).click();
    await expect(importCurrent).toBeDisabled();
    await expect
      .poll(() => {
        const models = JSON.parse(
          fs.readFileSync(path.join(piDir, "models.json"), "utf8"),
        );
        return models.providers["kimi-coding"]?.modelOverrides?.k3;
      })
      .toEqual({});

    await page.screenshot({
      path: testInfo.outputPath("pi-provider-workbench.png"),
      animations: "disabled",
    });
  } finally {
    await closePromptHub(app, userDataDir);
  }
});
