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

test.describe("E2E: Agent workspace", () => {
  test("shows the complete Agent registry in one capability-aware shell", async ({}, testInfo) => {
    const userDataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-agent-e2e-"),
    );
    const homeDir = path.join(userDataDir, "home");
    const claudeDir = path.join(homeDir, ".claude");
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, "settings.json"),
      JSON.stringify({ language: "en", model: "claude-sonnet" }, null, 2),
      "utf8",
    );
    const claudeProjectDir = path.join(
      claudeDir,
      "projects",
      "isolated-project",
    );
    fs.mkdirSync(claudeProjectDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeProjectDir, "session-1.jsonl"),
      [
        JSON.stringify({
          type: "user",
          timestamp: "2026-07-15T10:00:00.000Z",
          message: {
            role: "user",
            content: "Review the isolated Agent session",
          },
        }),
        JSON.stringify({
          type: "assistant",
          timestamp: "2026-07-15T10:01:00.000Z",
          message: {
            role: "assistant",
            content: "The isolated session is readable.",
          },
        }),
      ].join("\n"),
      "utf8",
    );

    const { app, page } = await launchPromptHub(null, {
      userDataDir,
      env: {
        HOME: homeDir,
        USERPROFILE: homeDir,
      },
    });

    try {
      await setAppLanguage(page, "en");
      await page.setViewportSize({ width: 1440, height: 900 });
      await sendAppCommand(app, { type: "agent:manage" });

      const supportedPlatforms = await page.evaluate(() =>
        window.api.skill.getSupportedPlatforms(),
      );
      await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible();
      await expect(
        page.getByText(`${supportedPlatforms.length} available`),
      ).toBeVisible();

      const cline = page.getByRole("button", { name: "Cline", exact: true });
      await cline.scrollIntoViewIfNeeded();
      await cline.click();
      await expect(page.getByRole("heading", { name: "Cline" })).toBeVisible();

      const claude = page.getByRole("button", {
        name: "Claude Code",
        exact: true,
      });
      await claude.scrollIntoViewIfNeeded();
      await claude.click();
      await expect(
        page.getByRole("heading", { name: "Claude Code" }),
      ).toBeVisible();

      await expect(
        page.getByRole("tab", { name: "Provider & Model" }),
      ).toBeEnabled();
      await expect(page.getByRole("tab", { name: "Usage" })).toBeDisabled();
      await page.screenshot({
        path: testInfo.outputPath("agent-workspace-overview.png"),
        animations: "disabled",
      });
      await expect(page.getByRole("tab", { name: "Assets" })).toHaveCount(0);
      await page.getByRole("tab", { name: "Skills" }).click();
      await expect(
        page.getByRole("tabpanel", { name: "Skills" }),
      ).toContainText("Skills installed");
      await page.screenshot({
        path: testInfo.outputPath("agent-workspace-skills.png"),
        animations: "disabled",
      });
      await page.getByRole("tab", { name: "MCP" }).click();
      await expect(page.getByRole("tabpanel", { name: "MCP" })).toContainText(
        "MCP servers",
      );
      await expect(page.getByRole("tab", { name: "Rules" })).toBeEnabled();
      await expect(page.getByRole("tab", { name: "Plugins" })).toBeEnabled();
      await page.getByRole("tab", { name: "Provider & Model" }).click();
      const modelInput = page.getByLabel("Default model");
      await expect(modelInput).toHaveValue("claude-sonnet");
      await modelInput.fill("claude-opus");
      await page.getByRole("button", { name: "Save model" }).click();
      await expect(page.getByText("Saved", { exact: true })).toBeVisible();
      await expect
        .poll(() =>
          fs.readFileSync(path.join(claudeDir, "settings.json"), "utf8"),
        )
        .toContain('"model": "claude-opus"');
      await page.screenshot({
        path: testInfo.outputPath("agent-workspace-provider.png"),
        animations: "disabled",
      });

      await page.getByRole("tab", { name: "Sessions" }).click();
      await expect(
        page.getByText("Review the isolated Agent session").first(),
      ).toBeVisible();
      await expect(
        page.getByText("The isolated session is readable."),
      ).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath("agent-workspace-sessions.png"),
        animations: "disabled",
      });

      await expect(
        page.getByRole("tab", { name: "Config Files" }),
      ).toBeEnabled();
      await page.getByRole("tab", { name: "Config Files" }).click();
      await expect(
        page.getByRole("heading", { name: "Native config files" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "settings.json", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Open Agent folder" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Edit" }).click();
      await page
        .getByRole("textbox", { name: "Code editor" })
        .fill(
          JSON.stringify({ language: "en", model: "claude-haiku" }, null, 2),
        );
      await page.getByRole("button", { name: "Save" }).click();
      await expect
        .poll(() =>
          fs.readFileSync(path.join(claudeDir, "settings.json"), "utf8"),
        )
        .toContain('"model": "claude-haiku"');
      await page.screenshot({
        path: testInfo.outputPath("agent-workspace-config-files.png"),
        animations: "disabled",
      });

      await page.screenshot({
        path: testInfo.outputPath("agent-workspace.png"),
        animations: "disabled",
      });

      await page.setViewportSize({ width: 920, height: 700 });
      await page
        .getByRole("tab", { name: "Config Files" })
        .scrollIntoViewIfNeeded();
      await expect(
        page.getByRole("tablist", { name: "Agent workspace" }),
      ).toBeVisible();
      await expect(
        page.getByRole("tabpanel", { name: "Config Files" }),
      ).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath("agent-workspace-narrow.png"),
        animations: "disabled",
      });
    } finally {
      await closePromptHub(app, userDataDir);
    }
  });
});
