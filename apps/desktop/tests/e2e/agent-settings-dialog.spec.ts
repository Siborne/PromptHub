import { expect, test } from "@playwright/test";
import fs from "fs";
import os from "os";
import path from "path";

import {
  closePromptHub,
  launchPromptHub,
  sendAppCommand,
  setAppLanguage,
} from "./helpers/electron";

test.describe("E2E: Agent settings dialog", () => {
  test("edits the selected Agent without navigating away", async ({}, testInfo) => {
    const userDataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-agent-settings-e2e-"),
    );
    const homeDir = path.join(userDataDir, "home");
    const claudeDir = path.join(homeDir, ".claude");
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, "settings.json"),
      JSON.stringify({ model: "claude-sonnet" }, null, 2),
      "utf8",
    );

    const { app, page } = await launchPromptHub(null, {
      userDataDir,
      env: { HOME: homeDir, USERPROFILE: homeDir },
    });

    try {
      await setAppLanguage(page, "en");
      await page.setViewportSize({ width: 1280, height: 820 });
      await sendAppCommand(app, { type: "agent:manage" });
      await page
        .getByRole("button", { name: "Claude Code", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Manage skills" }),
      ).toHaveCount(0);
      await page.getByRole("button", { name: "More actions" }).click();
      await page.getByRole("button", { name: "Edit Agent" }).click();

      const dialog = page.getByRole("dialog", { name: "Edit Claude Code" });
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole("textbox", { name: "Root directory" }),
      ).toHaveValue(claudeDir);
      await expect(
        page.getByRole("heading", { name: "Claude Code", exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath("agent-settings-dialog.png"),
        animations: "disabled",
      });

      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).toBeHidden();
      await expect(
        page.getByRole("heading", { name: "Claude Code", exact: true }),
      ).toBeVisible();
    } finally {
      await closePromptHub(app, userDataDir);
    }
  });
});
