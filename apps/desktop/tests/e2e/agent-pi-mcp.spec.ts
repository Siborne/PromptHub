import { expect, test, type Page } from "@playwright/test";
import fs from "fs";
import os from "os";
import path from "path";

import {
  closePromptHub,
  launchPromptHub,
  sendAppCommand,
  setAppLanguage,
} from "./helpers/electron";

async function selectAgent(page: Page, name: string): Promise<void> {
  await page.getByPlaceholder("Search Agents").fill(name);
  const agent = page.getByRole("button", { name, exact: true });
  await expect(agent).toBeVisible();
  await agent.click();
}

test("enables Pi's compatible MCP workspace without creating config eagerly", async ({}, testInfo) => {
  const userDataDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "prompthub-agent-pi-mcp-e2e-"),
  );
  const homeDir = path.join(userDataDir, "home");
  const piRoot = path.join(homeDir, ".pi", "agent");
  const mcpPath = path.join(piRoot, "mcp.json");
  fs.mkdirSync(piRoot, { recursive: true });
  fs.writeFileSync(
    path.join(piRoot, "settings.json"),
    JSON.stringify({ defaultProvider: "test", defaultModel: "test" }),
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
    await selectAgent(page, "Pi");

    const mcpTab = page.getByRole("tab", { name: "MCP" });
    await expect(mcpTab).toBeEnabled();
    await expect(page.getByText(mcpPath, { exact: true })).toBeVisible();
    expect(fs.existsSync(mcpPath)).toBe(false);

    await mcpTab.click();
    await expect(page.getByRole("button", { name: "Add MCP" })).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Search assets" }),
    ).toBeVisible();
    expect(fs.existsSync(mcpPath)).toBe(false);

    await page.screenshot({
      path: testInfo.outputPath("pi-mcp-workspace.png"),
      animations: "disabled",
    });
  } finally {
    await closePromptHub(app, userDataDir);
  }
});
