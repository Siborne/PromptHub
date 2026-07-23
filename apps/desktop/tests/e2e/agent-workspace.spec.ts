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

    const kimiDir = path.join(homeDir, ".kimi-code");
    const kimiSessionId = "session_e2e_kimi_1";
    const kimiSessionDir = path.join(
      kimiDir,
      "sessions",
      "wd_isolated-project",
      kimiSessionId,
    );
    fs.mkdirSync(path.join(kimiSessionDir, "agents", "main"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(kimiDir, "config.toml"),
      [
        'default_model = "kimi-code/kimi-for-coding"',
        "",
        '[models."kimi-code/kimi-for-coding"]',
        'provider = "managed:kimi-code"',
        'model = "kimi-for-coding"',
        "",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(kimiDir, "session_index.jsonl"),
      `${JSON.stringify({
        sessionId: kimiSessionId,
        sessionDir: kimiSessionDir,
        workDir: path.join(homeDir, "isolated-project"),
      })}\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(kimiSessionDir, "state.json"),
      JSON.stringify({
        title: "Review isolated Kimi session",
        createdAt: "2026-07-17T08:00:00.000Z",
        updatedAt: "2026-07-17T08:01:00.000Z",
        workDir: path.join(homeDir, "isolated-project"),
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(kimiSessionDir, "agents", "main", "wire.jsonl"),
      [
        JSON.stringify({
          type: "metadata",
          protocol_version: "1.1",
          created_at: 1784275200000,
        }),
        JSON.stringify({
          type: "turn.prompt",
          input: [{ type: "text", text: "Inspect the Kimi session adapter" }],
          origin: { kind: "user" },
          time: 1784275201000,
        }),
        JSON.stringify({
          type: "context.append_loop_event",
          event: {
            type: "content.part",
            part: { type: "text", text: "The Kimi transcript is isolated." },
          },
          time: 1784275202000,
        }),
      ].join("\n"),
      "utf8",
    );

    const codexPetDir = path.join(homeDir, ".codex", "pets", "orbit");
    fs.mkdirSync(codexPetDir, { recursive: true });
    fs.writeFileSync(
      path.join(codexPetDir, "pet.json"),
      JSON.stringify({
        id: "orbit",
        displayName: "Orbit",
        description: "A local Codex Pet managed from the shared Agent UI.",
        spritesheetPath: "spritesheet.png",
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(codexPetDir, "spritesheet.png"),
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    );
    const themeDir = path.join(
      userDataDir,
      "data",
      "agent-appearance",
      "themes",
      "codex",
    );
    fs.mkdirSync(themeDir, { recursive: true });
    const midnightThemeDir = path.join(themeDir, "midnight");
    fs.mkdirSync(midnightThemeDir, { recursive: true });
    fs.writeFileSync(
      path.join(midnightThemeDir, "theme.json"),
      JSON.stringify({
        schemaVersion: 1,
        id: "midnight",
        name: "Midnight",
        image: "background.png",
        appearance: "dark",
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(midnightThemeDir, "background.png"),
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
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
      await expect(page.getByRole("tab", { name: "Usage" })).toHaveCount(0);
      await page.screenshot({
        path: testInfo.outputPath("agent-workspace-overview.png"),
        animations: "disabled",
      });
      await expect(page.getByRole("tab", { name: "Assets" })).toHaveCount(0);
      await page.getByRole("tab", { name: "Skills" }).click();
      await expect(
        page.getByRole("tabpanel", { name: "Skills" }),
      ).toContainText(path.join(claudeDir, "skills"));
      await expect(
        page.getByRole("button", { name: "Install My Skill" }),
      ).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath("agent-workspace-skills.png"),
        animations: "disabled",
      });
      await page.getByRole("tab", { name: "MCP" }).click();
      await expect(page.getByRole("tabpanel", { name: "MCP" })).toContainText(
        path.join(homeDir, ".claude.json"),
      );
      await expect(
        page.getByRole("textbox", { name: "Search assets" }),
      ).toBeVisible();
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

      const codex = page.getByRole("button", {
        name: "Codex",
        exact: true,
      });
      await codex.scrollIntoViewIfNeeded();
      await codex.click();
      await expect(page.getByRole("tab", { name: "Appearance" })).toBeEnabled();
      await page.getByRole("tab", { name: "Appearance" }).click();
      await expect(
        page.getByRole("heading", { name: "Codex appearance" }),
      ).toBeVisible();
      await expect(page.getByText("Midnight")).toBeVisible();
      await expect(page.getByText("Orbit")).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath("agent-workspace-appearance.png"),
        animations: "disabled",
      });
      await page
        .getByRole("heading", { name: "Pets" })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: testInfo.outputPath("agent-workspace-appearance-pets.png"),
        animations: "disabled",
      });

      const kimi = page.getByRole("button", {
        name: "Kimi Code",
        exact: true,
      });
      await kimi.scrollIntoViewIfNeeded();
      await kimi.click();
      await expect(
        page.getByRole("heading", { name: "Kimi Code" }),
      ).toBeVisible();
      await page.getByRole("tab", { name: "Provider & Model" }).click();
      await expect(page.getByLabel("Default model")).toHaveValue(
        "kimi-code/kimi-for-coding",
      );
      await page.getByRole("tab", { name: "Sessions" }).click();
      await expect(
        page.getByText("Review isolated Kimi session").first(),
      ).toBeVisible();
      await expect(
        page.getByText("The Kimi transcript is isolated."),
      ).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath("agent-workspace-kimi.png"),
        animations: "disabled",
      });

      await claude.click();

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
