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

function encryptedBackups(backupRoot: string): string[] {
  if (!fs.existsSync(backupRoot)) return [];
  return fs
    .readdirSync(backupRoot, { recursive: true })
    .map(String)
    .filter((entry) => entry.endsWith("settings.json.enc"));
}

test("manages discovered user-level Agent config files safely", async ({}, testInfo) => {
  const userDataDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "prompthub-agent-config-e2e-"),
  );
  const homeDir = path.join(userDataDir, "home");
  const claudeDir = path.join(homeDir, ".claude");
  const settingsPath = path.join(claudeDir, "settings.json");
  fs.mkdirSync(path.join(claudeDir, "agents"), { recursive: true });
  fs.mkdirSync(path.join(claudeDir, "commands"), { recursive: true });
  fs.mkdirSync(path.join(claudeDir, "sessions"), { recursive: true });
  fs.writeFileSync(
    settingsPath,
    JSON.stringify(
      {
        env: { ANTHROPIC_AUTH_TOKEN: "claude-e2e-secret-value" },
        language: "en",
        model: "claude-sonnet",
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(claudeDir, "CLAUDE.md"),
    "# User instructions\n\nKeep user-level configuration visible.\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(claudeDir, "agents", "reviewer.md"),
    "# Reviewer\n\nReview the current change.\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(claudeDir, "commands", "release.md"),
    "# Release\n\nPrepare release notes.\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(claudeDir, "auth.json"),
    JSON.stringify({ token: "excluded-auth-secret" }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(claudeDir, "sessions", "latest.json"),
    JSON.stringify({ transcript: "excluded runtime data" }),
    "utf8",
  );

  const { app, page } = await launchPromptHub(null, {
    userDataDir,
    env: { HOME: homeDir, USERPROFILE: homeDir },
  });

  try {
    await setAppLanguage(page, "en");
    await page.setViewportSize({ width: 1280, height: 800 });
    await sendAppCommand(app, { type: "agent:manage" });
    await selectAgent(page, "Claude Code");
    await page.getByRole("tab", { name: "Config Files" }).click();

    await expect(
      page.getByRole("heading", { name: "Native config files" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "settings.json", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "CLAUDE.md", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "reviewer.md", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "auth.json" })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: "sessions", exact: true }),
    ).toHaveCount(0);

    await expect(page.locator("body")).toContainText(
      "__PROMPTHUB_REDACTED_SECRET_1__",
    );
    await expect(page.locator("body")).not.toContainText(
      "claude-e2e-secret-value",
    );

    const encryptionAvailable = await app.evaluate(({ safeStorage }) =>
      safeStorage.isEncryptionAvailable(),
    );
    if (!encryptionAvailable) return;

    await page.getByRole("button", { name: "Edit" }).click();
    const editor = page.getByRole("textbox", { name: "Code editor" });
    await editor.fill(
      JSON.stringify(
        {
          env: {
            ANTHROPIC_AUTH_TOKEN: "__PROMPTHUB_REDACTED_SECRET_1__",
          },
          language: "en",
          model: "claude-haiku",
        },
        null,
        2,
      ),
    );
    await page.getByRole("button", { name: "Save" }).click();
    await expect
      .poll(() => JSON.parse(fs.readFileSync(settingsPath, "utf8")))
      .toMatchObject({
        env: { ANTHROPIC_AUTH_TOKEN: "claude-e2e-secret-value" },
        model: "claude-haiku",
      });
    await expect(page.locator("body")).not.toContainText(
      "claude-e2e-secret-value",
    );

    const backupRoot = path.join(
      userDataDir,
      "agent-config-backups",
      "claude",
    );
    await expect.poll(() => encryptedBackups(backupRoot)).not.toHaveLength(0);
    const backupPath = path.join(
      backupRoot,
      encryptedBackups(backupRoot)[0],
    );
    expect(fs.readFileSync(backupPath, "utf8")).not.toContain(
      "claude-e2e-secret-value",
    );
    await page.screenshot({
      path: testInfo.outputPath("agent-user-config-files.png"),
      animations: "disabled",
    });
  } finally {
    await closePromptHub(app, userDataDir);
  }
});
