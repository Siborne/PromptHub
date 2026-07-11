#!/usr/bin/env -S node --experimental-strip-types
/**
 * Capture refreshed README screenshots from a seeded PromptHub electron app.
 *
 * The script boots the Electron main process from `out/main/index.js`, loads
 * the seed in `tests/e2e/fixtures/screenshots.seed.json`, and walks the
 * surfaces we want to feature on the README. Each surface is captured into
 * `docs/imgs/<file>.png` (relative to the repository root).
 *
 * Usage:
 *   pnpm build              # compile the renderer + main first
 *   pnpm --filter @prompthub/desktop screenshots
 *
 * The capture set intentionally lives outside the e2e suite so a screenshot
 * regression doesn't break CI; it is a docs tool. We reuse the e2e helpers
 * (`launchPromptHub`, `setAppLanguage`, `setAppSettings`) so the boot path
 * matches the rest of the smoke tests.
 *
 * Exit codes:
 *   0 — every screenshot captured successfully
 *   1 — a surface failed to render, or a step timed out
 *   2 — required output directories are missing or the build is stale
 */

import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { _electron as electron, type ElectronApplication, type Page } from "@playwright/test";
import { getScreenshotPlanMismatch } from "./readme-screenshot-plan.mts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const desktopRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(desktopRoot, "..", "..");
const seedPath = path.join(
  desktopRoot,
  "tests/e2e/fixtures/screenshots.seed.json",
);
const mainEntry = path.join(desktopRoot, "out/main/index.js");
const docsImgsDir = path.join(repoRoot, "docs/imgs");
const pluginFixtureDir = path.join(
  desktopRoot,
  "out",
  "screenshots-plugin-fixture",
);

const VIEWPORT = { width: 1440, height: 900 } as const;

interface Surface {
  /** Output filename relative to docs/imgs/ */
  filename: string;
  /** Description of the surface, printed in the log */
  description: string;
  /** Sets up the surface. Throws if the surface can't be reached. */
  prepare(page: Page): Promise<void>;
}

async function ensureBuilt(): Promise<void> {
  try {
    await stat(mainEntry);
  } catch {
    console.error(
      `[screenshots] cannot find ${mainEntry}. Run 'pnpm build' (or 'pnpm --filter @prompthub/desktop build') first.`,
    );
    process.exit(2);
  }
  try {
    await stat(seedPath);
  } catch {
    console.error(`[screenshots] cannot find seed at ${seedPath}.`);
    process.exit(2);
  }
}

async function ensureDocsDir(): Promise<void> {
  await mkdir(docsImgsDir, { recursive: true });
}

async function createPluginFixture(): Promise<string> {
  await rm(pluginFixtureDir, { recursive: true, force: true });
  await mkdir(path.join(pluginFixtureDir, ".codex-plugin"), {
    recursive: true,
  });
  await mkdir(path.join(pluginFixtureDir, "skills", "release-check"), {
    recursive: true,
  });
  await mkdir(path.join(pluginFixtureDir, "commands"), { recursive: true });

  await writeFile(
    path.join(pluginFixtureDir, ".codex-plugin", "plugin.json"),
    `${JSON.stringify(
      {
        name: "release-companion",
        version: "1.0.0",
        description: "Release readiness helpers for PromptHub teams.",
        skills: "./skills",
        commands: ["./commands/release-check.md"],
        interface: {
          displayName: "Release Companion",
          longDescription:
            "Reusable release checks, handoffs, and changelog prompts.",
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(
    path.join(pluginFixtureDir, "skills", "release-check", "SKILL.md"),
    "---\nname: release-check\n---\nValidate release readiness.\n",
    "utf8",
  );
  await writeFile(
    path.join(pluginFixtureDir, "commands", "release-check.md"),
    "Review the release candidate.\n",
    "utf8",
  );

  return pluginFixtureDir;
}

async function setLanguageAndTheme(page: Page): Promise<void> {
  await page.evaluate(() => {
    const raw = localStorage.getItem("prompthub-settings");
    const parsed = raw ? JSON.parse(raw) : { state: {} };
    parsed.state = {
      ...(parsed.state ?? {}),
      language: "en",
      theme: "dark",
      motionPreference: "standard",
    };
    localStorage.setItem("prompthub-settings", JSON.stringify(parsed));
  });
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
}

async function seedIntegrationLibraries(
  page: Page,
  sourcePath: string,
): Promise<void> {
  await page.evaluate(async (pluginSourcePath) => {
    await window.api.mcp.createServer({
      name: "release-tracker",
      displayName: "Release Tracker",
      description: "Tracks release readiness across PromptHub workspaces.",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@prompthub/release-tracker"],
      enabled: true,
      tags: ["release", "engineering"],
      source: { type: "manual", label: "README fixture" },
    });
    await window.api.plugin.importLocalPluginPackage({
      sourcePath: pluginSourcePath,
      sourceTargetId: "codex",
      sourceTargetName: "Codex",
    });
  }, sourcePath);
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
  await settle(page, 500);
}

async function settle(page: Page, ms: number = 350): Promise<void> {
  await page.waitForTimeout(ms);
}

async function capture(page: Page, filename: string): Promise<void> {
  const out = path.join(docsImgsDir, filename);
  await page.screenshot({ path: out, animations: "disabled" });
  console.log(`  -> ${path.relative(repoRoot, out)}`);
}

function assertSurfacePlan(): void {
  const capturedFilenames = SURFACES.map((surface) => surface.filename);
  const { missing, unlisted } = getScreenshotPlanMismatch(capturedFilenames);

  if (missing.length > 0 || unlisted.length > 0) {
    throw new Error(
      `README screenshot plan mismatch: missing [${missing.join(", ")}], unlisted [${unlisted.join(", ")}].`,
    );
  }
}

const SURFACES: Surface[] = [
  {
    filename: "1-index.png",
    description: "Main two-column home view",
    async prepare(page) {
      // Default landing surface; just settle.
      await settle(page);
    },
  },
  {
    filename: "10-skill-store.png",
    description: "Skill store",
    async prepare(page) {
      // Sidebar nav items use title attributes for accessibility.
      const skillsNav = page.locator('button[title="Skills"], button[title*="技能"]').first();
      await skillsNav.waitFor({ state: "visible", timeout: 5000 });
      await skillsNav.click();
      await settle(page);
      // Try to enter a Store sub-tab — typically labeled "Skill Store".
      const storeTab = page
        .locator('button:has-text("Skill Store"), button:has-text("Store")')
        .first();
      if (await storeTab.isVisible().catch(() => false)) {
        await storeTab.click();
      }
      await settle(page, 600);
    },
  },
  {
    filename: "11-skill-platform-install.png",
    description: "Skill detail with platform install panel",
    async prepare(page) {
      const mySkillsTab = page
        .locator('button:has-text("My Skills"), button:has-text("我的")')
        .first();
      if (await mySkillsTab.isVisible().catch(() => false)) {
        await mySkillsTab.click();
        await settle(page);
      }
      // Click the first skill row.
      const firstSkill = page
        .locator("h3, h4")
        .filter({ hasText: /write|code-review|release-notes/i })
        .first();
      if (await firstSkill.isVisible().catch(() => false)) {
        await firstSkill.click();
      }
      await settle(page, 600);
    },
  },
  {
    filename: "13-rules-workspace.png",
    description: "Rules workspace",
    async prepare(page) {
      const rulesNav = page.locator('button[title="Rules"], button[title*="规则"]').first();
      await rulesNav.waitFor({ state: "visible", timeout: 5000 });
      await rulesNav.click();
      await settle(page, 600);
    },
  },
  {
    filename: "14-skill-projects.png",
    description: "Project Skill workspace",
    async prepare(page) {
      const skillsNav = page.locator('button[title="Skills"], button[title*="技能"]').first();
      await skillsNav.click();
      await settle(page);
      const projectsTab = page
        .locator('button:has-text("Project"), button:has-text("项目")')
        .first();
      if (await projectsTab.isVisible().catch(() => false)) {
        await projectsTab.click();
        await settle(page, 600);
      }
    },
  },
  {
    filename: "15-quick-add-ai.png",
    description: "Quick Add modal in AI generation mode",
    async prepare(page) {
      // Trigger Quick Add via shortcut; its three-tier menu may need a click.
      await page.keyboard.press("Alt+Shift+N");
      await settle(page, 800);
    },
  },
  {
    filename: "17-appearance-motion.png",
    description: "Settings → Appearance with the motion section",
    async prepare(page) {
      const settingsNav = page
        .locator('button[title="Settings"], button[title*="设置"]')
        .first();
      if (await settingsNav.isVisible().catch(() => false)) {
        await settingsNav.click();
        await settle(page);
        const appearanceTab = page
          .locator('button:has-text("Appearance"), button:has-text("外观")')
          .first();
        if (await appearanceTab.isVisible().catch(() => false)) {
          await appearanceTab.click();
          await settle(page, 500);
        }
      }
    },
  },
  {
    filename: "18-mcp-workspace.png",
    description: "MCP workspace",
    async prepare(page) {
      const mcpNav = page.locator('button[title="MCP"]').first();
      await mcpNav.waitFor({ state: "visible", timeout: 5000 });
      await mcpNav.click();
      const myMcpNav = page.locator('button[title="My MCP"]').first();
      await myMcpNav.waitFor({ state: "visible", timeout: 5000 });
      await myMcpNav.click();
      await page.getByText("Release Tracker", { exact: true }).waitFor({
        state: "visible",
        timeout: 5000,
      });
      await settle(page, 500);
    },
  },
  {
    filename: "19-plugin-workspace.png",
    description: "Plugin workspace",
    async prepare(page) {
      const pluginNav = page.locator('button[title="Plugins"]').first();
      await pluginNav.waitFor({ state: "visible", timeout: 5000 });
      await pluginNav.click();
      const myPluginsNav = page.locator('button[title="My Plugins"]').first();
      await myPluginsNav.waitFor({ state: "visible", timeout: 5000 });
      await myPluginsNav.click();
      await page
        .getByText("Release Companion", { exact: true })
        .waitFor({ state: "visible", timeout: 5000 });
      await settle(page, 500);
    },
  },
];

async function captureAll(): Promise<void> {
  await ensureBuilt();
  await ensureDocsDir();
  assertSurfacePlan();

  let app: ElectronApplication | null = null;
  let exitCode = 0;
  try {
    const userDataDir = path.join(
      desktopRoot,
      "out",
      "screenshots-userdata",
    );
    // Wipe stale state from previous runs so the seed always lands on an
    // empty profile.
    await rm(userDataDir, { recursive: true, force: true });
    await mkdir(userDataDir, { recursive: true });
    const pluginSourcePath = await createPluginFixture();

    app = await electron.launch({
      args: [mainEntry],
      env: {
        ...process.env,
        NODE_ENV: "test",
        PROMPTHUB_E2E: "1",
        PROMPTHUB_E2E_USER_DATA_DIR: userDataDir,
        PROMPTHUB_E2E_SEED_PATH: seedPath,
      },
    });
    const page = await app.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    await page.setViewportSize(VIEWPORT);
    await setLanguageAndTheme(page);
    await seedIntegrationLibraries(page, pluginSourcePath);

    for (const surface of SURFACES) {
      console.log(`[screenshots] ${surface.description} (${surface.filename})`);
      try {
        // Always dismiss any open modal before navigating to the next surface.
        await page.keyboard.press("Escape").catch(() => undefined);
        await settle(page, 200);
        await surface.prepare(page);
        await capture(page, surface.filename);
      } catch (err) {
        console.error(
          `  !! failed to capture ${surface.filename}: ${(err as Error).message}`,
        );
        exitCode = 1;
      }
    }
  } catch (err) {
    console.error(
      `[screenshots] fatal: ${(err as Error).message ?? String(err)}`,
    );
    exitCode = 1;
  } finally {
    if (app) {
      await app.close().catch(() => undefined);
    }
    await rm(pluginFixtureDir, { recursive: true, force: true });
  }

  process.exit(exitCode);
}

captureAll();
