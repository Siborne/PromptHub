import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentSessionIndexDB } from "@prompthub/db";
import type { AgentInventoryItem } from "@prompthub/shared/types";
import {
  inspectDeclaredConfigFiles,
  listDefinitions,
  listIndexedSessions,
  listManagedDirectories,
} from "./agent-services.dependencies.js";

let root = "";

function createAgent(id = "qwen"): AgentInventoryItem {
  return {
    id,
    isDetected: true,
    paths: {
      root,
      configFiles: [
        path.join(root, "config.json"),
        path.join(root, "missing.json"),
        path.join(root, "linked.json"),
      ],
      configFileRelativePaths: ["config.json", "missing.json", "linked.json"],
    },
  } as AgentInventoryItem;
}

describe("Web Agent service filesystem adapters", () => {
  beforeEach(async () => {
    root = await fs.mkdtemp(
      path.join(os.tmpdir(), "prompthub-agent-services-"),
    );
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("classifies declared config files without following symlinks", async () => {
    await fs.writeFile(path.join(root, "config.json"), "{}");
    await fs.symlink(
      path.join(root, "config.json"),
      path.join(root, "linked.json"),
    );

    await expect(inspectDeclaredConfigFiles(createAgent())).resolves.toEqual([
      { id: "config.json", label: "config.json", state: "available" },
      { id: "missing.json", label: "missing.json", state: "missing" },
      { id: "linked.json", label: "linked.json", state: "blocked" },
    ]);
  });

  it("caps parallel config probes before touching oversized declarations", async () => {
    const agent = createAgent();
    agent.paths.configFiles = Array.from({ length: 500 }, (_, index) =>
      path.join(root, `missing-${index}.json`),
    );
    agent.paths.configFileRelativePaths = agent.paths.configFiles.map((file) =>
      path.basename(file),
    );

    const result = await inspectDeclaredConfigFiles(agent);

    expect(result).toHaveLength(200);
    expect(result.every((entry) => entry.state === "missing")).toBe(true);
  });

  it("bounds definition scans, keeps Unicode names, and skips symlinks", async () => {
    const agentsRoot = path.join(root, "agents");
    const commandsRoot = path.join(root, "commands", "nested");
    await fs.mkdir(agentsRoot, { recursive: true });
    await fs.mkdir(commandsRoot, { recursive: true });
    await fs.writeFile(
      path.join(agentsRoot, "中文.md"),
      "---\nname: test\n---\nbody",
    );
    await fs.writeFile(path.join(commandsRoot, "review.md"), "review");
    await fs.symlink(root, path.join(root, "commands", "escape"));
    const initial = await listDefinitions(createAgent());
    expect(initial).toContainEqual(
      expect.objectContaining({ label: "中文", description: "subagent" }),
    );
    expect(initial).toContainEqual(
      expect.objectContaining({
        label: "nested/review",
        description: "command",
      }),
    );
    await Promise.all(
      Array.from({ length: 240 }, (_, index) =>
        fs.writeFile(path.join(agentsRoot, `agent-${index}.md`), "body"),
      ),
    );

    const result = await listDefinitions(createAgent());

    expect(result).toHaveLength(200);
    expect(result.some((entry) => entry.id.includes("escape"))).toBe(false);
  });

  it("returns only safe immediate managed directories", async () => {
    await fs.mkdir(path.join(root, "theme-one"));
    await fs.mkdir(path.join(root, "unsafe name"));
    await fs.writeFile(path.join(root, "file"), "x");
    await fs.symlink(path.join(root, "theme-one"), path.join(root, "linked"));

    await expect(listManagedDirectories(root, "theme")).resolves.toEqual([
      { id: "theme-one", label: "theme-one", state: "theme" },
    ]);
  });

  it("reads only bounded redacted session-index summaries", () => {
    const listSessions = vi.fn(({ limit }: { limit: number }) => ({
      items: Array.from({ length: limit }, (_, index) => ({
        id: `session-${index}`,
        title: `Session ${index}`,
        redactedPreview: "safe preview",
        sourceStatus: "present",
      })),
      total: 500,
      hasMore: true,
    }));
    const sessions = {
      listSources: () => [{ id: "source-1" }, { id: "source-2" }],
      listSessions,
    } as unknown as AgentSessionIndexDB;

    const result = listIndexedSessions(sessions, createAgent());

    expect(result).toHaveLength(200);
    expect(result[0]).toMatchObject({
      id: "session-0",
      description: "safe preview",
      state: "present",
    });
    expect(listSessions).toHaveBeenCalledTimes(1);
  });
});
