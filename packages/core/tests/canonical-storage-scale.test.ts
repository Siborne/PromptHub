import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { DatabaseAdapter, PromptDB, SCHEMA } from "@prompthub/db";
import { afterEach, describe, expect, it } from "vitest";

import {
  CanonicalPromptDB,
  publishCanonicalPromptGraph,
} from "../src/canonical-prompt-graph-db";
import { writeCanonicalStorageAuthority } from "../src/canonical-storage-authority";
import { readPromptCanonicalGraph } from "../src/prompt-canonical-import";
import {
  configureRuntimePaths,
  resetRuntimePaths,
  writeRuntimeLayoutState,
} from "../src/runtime-paths";

const PROMPT_COUNT = 1_000;
const MAX_ELAPSED_MS = 45_000;
const MAX_INCREMENTAL_ELAPSED_MS = 10_000;
const MAX_RSS_DELTA_KIB = 512 * 1024;

function directoryBytes(rootPath: string): number {
  let total = 0;
  const queue = [rootPath];
  while (queue.length > 0) {
    const directory = queue.shift() as string;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) queue.push(entryPath);
      else total += fs.statSync(entryPath).size;
    }
  }
  return total;
}

describe("canonical storage scale", () => {
  let root: string | null = null;
  let database: DatabaseAdapter.Database | null = null;

  afterEach(() => {
    database?.close();
    database = null;
    resetRuntimePaths();
    if (root) fs.rmSync(root, { recursive: true, force: true });
    root = null;
  });

  it("publishes and reloads a four-digit Prompt inventory within bounded resources", () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "prompthub-canonical-scale-"));
    configureRuntimePaths({ userDataPath: root });
    writeRuntimeLayoutState(root);
    writeCanonicalStorageAuthority(root, {
      consistencyId: "d".repeat(64),
      operationId: "canonical-scale-test",
    });
    database = new DatabaseAdapter(":memory:");
    database.exec(SCHEMA);
    const prompts = new PromptDB(database);
    for (let index = 0; index < PROMPT_COUNT; index += 1) {
      prompts.create({
        title: `Prompt ${index}`,
        userPrompt: `Bounded canonical payload ${index}`,
        tags: [`group-${index % 10}`],
      });
    }

    const rssBefore = process.resourceUsage().maxRSS;
    const startedAt = performance.now();
    expect(publishCanonicalPromptGraph(database)).toBe("published");
    const elapsedMs = performance.now() - startedAt;
    const rssDeltaKiB = Math.max(0, process.resourceUsage().maxRSS - rssBefore);
    const dataBytes = directoryBytes(path.join(root, "data"));
    const restored = readPromptCanonicalGraph(path.join(root, "data"));

    expect(restored.snapshot.prompts).toHaveLength(PROMPT_COUNT);
    expect(restored.snapshot.promptVersions).toHaveLength(PROMPT_COUNT);
    expect(elapsedMs).toBeLessThan(MAX_ELAPSED_MS);
    expect(rssDeltaKiB).toBeLessThan(MAX_RSS_DELTA_KIB);
    const incrementalStartedAt = performance.now();
    new CanonicalPromptDB(database).update(restored.snapshot.prompts[0].id, {
      userPrompt: "Incremental canonical update",
    });
    const incrementalElapsedMs = performance.now() - incrementalStartedAt;
    expect(incrementalElapsedMs).toBeLessThan(MAX_INCREMENTAL_ELAPSED_MS);
    console.info(
      `[storage-scale] prompts=${PROMPT_COUNT} elapsedMs=${elapsedMs.toFixed(1)} incrementalMs=${incrementalElapsedMs.toFixed(1)} maxRssDeltaKiB=${rssDeltaKiB} dataBytes=${dataBytes}`,
    );
  }, 60_000);
});
