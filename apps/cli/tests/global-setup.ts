import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  closeDatabase,
  configureRuntimePaths,
  initDatabase,
  resetRuntimePaths,
} from "@prompthub/core";

const DEFAULT_SUITE_BUDGET_MS = 75_000;

export default function setup() {
  const startedAt = performance.now();
  const originalTemplatePath =
    process.env.PROMPTHUB_CLI_TEST_DB_TEMPLATE;
  const templateRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "prompthub-cli-db-template-"),
  );
  const userDataPath = path.join(templateRoot, "user-data");
  const databasePath = path.join(userDataPath, "data", "prompthub.db");

  configureRuntimePaths({ userDataPath });
  try {
    initDatabase();
  } catch (error) {
    fs.rmSync(templateRoot, { recursive: true, force: true });
    throw error;
  } finally {
    closeDatabase();
    resetRuntimePaths();
  }

  process.env.PROMPTHUB_CLI_TEST_DB_TEMPLATE = databasePath;

  return function teardown() {
    if (originalTemplatePath === undefined) {
      delete process.env.PROMPTHUB_CLI_TEST_DB_TEMPLATE;
    } else {
      process.env.PROMPTHUB_CLI_TEST_DB_TEMPLATE = originalTemplatePath;
    }
    fs.rmSync(templateRoot, { recursive: true, force: true });

    const configuredBudget = Number(
      process.env.PROMPTHUB_CLI_TEST_MAX_MS ?? DEFAULT_SUITE_BUDGET_MS,
    );
    const budgetMs =
      Number.isFinite(configuredBudget) && configuredBudget > 0
        ? configuredBudget
        : DEFAULT_SUITE_BUDGET_MS;
    const elapsedMs = performance.now() - startedAt;
    if (elapsedMs > budgetMs) {
      throw new Error(
        `CLI test runtime ${Math.round(elapsedMs)}ms exceeded ${budgetMs}ms budget`,
      );
    }
  };
}
