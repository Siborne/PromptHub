/**
 * @vitest-environment node
 */
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { unzipSync } from "fflate";

import { createPortableSnapshotZip } from "../../../src/main/services/portable-snapshot-archive";

describe("portable snapshot archive", () => {
  const roots: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("streams only selected scopes and cleans task-owned staging", async () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-portable-zip-"),
    );
    roots.push(root);
    const prompts = path.join(root, "data", "prompts");
    const skills = path.join(root, "data", "skills");
    const cache = path.join(root, "cache");
    fs.mkdirSync(prompts, { recursive: true });
    fs.mkdirSync(skills, { recursive: true });
    fs.writeFileSync(path.join(prompts, "prompt.json"), "prompt");
    fs.writeFileSync(path.join(skills, "SKILL.md"), "skill");
    const destination = path.join(root, "export.zip");

    const result = await createPortableSnapshotZip({
      destinationPath: destination,
      sourcePaths: {
        rootPath: root,
        cachePath: cache,
        promptsPath: prompts,
        versionsPath: path.join(root, "missing-versions"),
        skillsPath: skills,
        rulesPath: path.join(root, "missing-rules"),
        pluginsPath: path.join(root, "missing-plugins"),
        imagesPath: path.join(root, "missing-images"),
        videosPath: path.join(root, "missing-videos"),
      },
      scope: {
        prompts: true,
        versions: false,
        images: false,
        skills: false,
        config: false,
        settingsJson: '{"theme":"dark"}',
      },
    });

    const files = unzipSync(fs.readFileSync(destination));
    expect(Object.keys(files).sort()).toEqual([
      "config/app.json",
      "data/prompts/prompt.json",
      "portable-manifest.json",
    ]);
    expect(Buffer.from(files["data/prompts/prompt.json"]).toString()).toBe(
      "prompt",
    );
    expect(result.consistencyId).toMatch(/^[a-f0-9]{64}$/);
    expect(fs.existsSync(path.join(cache, "portable-snapshots"))).toBe(true);
    expect(fs.readdirSync(path.join(cache, "portable-snapshots"))).toEqual([]);
  });

  it("includes MCP, Agent, generation, and content-addressed object domains", async () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-portable-domains-"),
    );
    roots.push(root);
    const cache = path.join(root, "cache");
    const mcpPath = path.join(root, "data", "mcp");
    const agentsPath = path.join(root, "data", "agents");
    const generationsPath = path.join(root, "data", "generations");
    const objectsPath = path.join(root, "data", "assets", "objects");
    for (const directory of [
      mcpPath,
      agentsPath,
      generationsPath,
      objectsPath,
    ]) {
      fs.mkdirSync(directory, { recursive: true });
    }
    fs.writeFileSync(path.join(mcpPath, "server.json"), "mcp");
    fs.writeFileSync(path.join(agentsPath, "profile.json"), "agent");
    fs.writeFileSync(path.join(generationsPath, "batch.json"), "generation");
    fs.writeFileSync(path.join(objectsPath, "object.bin"), "object");
    const destination = path.join(root, "domains.zip");

    await createPortableSnapshotZip({
      destinationPath: destination,
      sourcePaths: {
        rootPath: root,
        cachePath: cache,
        promptsPath: path.join(root, "missing-prompts"),
        versionsPath: path.join(root, "missing-versions"),
        skillsPath: path.join(root, "missing-skills"),
        rulesPath: path.join(root, "missing-rules"),
        pluginsPath: path.join(root, "missing-plugins"),
        mcpPath,
        agentsPath,
        generationsPath,
        objectsPath,
        imagesPath: path.join(root, "missing-images"),
        videosPath: path.join(root, "missing-videos"),
      },
      scope: {
        prompts: false,
        versions: false,
        images: false,
        skills: false,
        mcp: true,
        agents: true,
        generations: true,
        config: false,
      },
    });

    const files = Object.keys(unzipSync(fs.readFileSync(destination))).sort();
    expect(files).toEqual([
      "data/agents/profile.json",
      "data/assets/objects/object.bin",
      "data/generations/batch.json",
      "data/mcp/server.json",
      "portable-manifest.json",
    ]);
  });

  it("embeds the verified canonical checkpoint without local catalog or device state", async () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-portable-canonical-"),
    );
    roots.push(root);
    const checkpointPath = path.join(root, "cache", "canonical-checkpoint");
    fs.mkdirSync(path.join(checkpointPath, "canonical", "prompts"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(checkpointPath, "catalog"), { recursive: true });
    fs.mkdirSync(path.join(checkpointPath, "device"), { recursive: true });
    fs.writeFileSync(
      path.join(checkpointPath, "canonical", "prompts", "resource.json"),
      "canonical-prompt",
    );
    fs.writeFileSync(
      path.join(checkpointPath, "catalog", "prompthub.db"),
      "derived",
    );
    fs.writeFileSync(
      path.join(checkpointPath, "device", "mcp-bindings.json"),
      "local",
    );
    fs.writeFileSync(
      path.join(checkpointPath, "checkpoint.json"),
      JSON.stringify({
        kind: "prompthub-canonical-storage-checkpoint",
        version: 1,
      }),
    );
    const destination = path.join(root, "canonical.zip");

    await createPortableSnapshotZip({
      destinationPath: destination,
      sourcePaths: {
        rootPath: root,
        cachePath: path.join(root, "cache"),
        canonicalCheckpointPath: checkpointPath,
        promptsPath: path.join(root, "missing-prompts"),
        versionsPath: path.join(root, "missing-versions"),
        skillsPath: path.join(root, "missing-skills"),
        rulesPath: path.join(root, "missing-rules"),
        pluginsPath: path.join(root, "missing-plugins"),
        imagesPath: path.join(root, "missing-images"),
        videosPath: path.join(root, "missing-videos"),
      },
      scope: {
        prompts: true,
        versions: true,
        images: true,
        videos: true,
        skills: true,
        rules: true,
        mcp: true,
        plugins: true,
        agents: true,
        generations: true,
        config: false,
      },
    });

    const files = Object.keys(unzipSync(fs.readFileSync(destination))).sort();
    expect(files).toContain("canonical/prompts/resource.json");
    expect(files).toContain("canonical-checkpoint.json");
    expect(files).not.toContain("catalog/prompthub.db");
    expect(files).not.toContain("device/mcp-bindings.json");
  });

  it("refuses to attach a full canonical checkpoint to a selective export", async () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-portable-canonical-scope-"),
    );
    roots.push(root);
    const checkpointPath = path.join(root, "cache", "canonical-checkpoint");
    fs.mkdirSync(path.join(checkpointPath, "canonical"), { recursive: true });
    fs.writeFileSync(path.join(checkpointPath, "checkpoint.json"), "{}");
    const destination = path.join(root, "selective.zip");

    await expect(
      createPortableSnapshotZip({
        destinationPath: destination,
        sourcePaths: {
          rootPath: root,
          cachePath: path.join(root, "cache"),
          canonicalCheckpointPath: checkpointPath,
          promptsPath: path.join(root, "missing-prompts"),
          versionsPath: path.join(root, "missing-versions"),
          skillsPath: path.join(root, "missing-skills"),
          rulesPath: path.join(root, "missing-rules"),
          pluginsPath: path.join(root, "missing-plugins"),
          imagesPath: path.join(root, "missing-images"),
          videosPath: path.join(root, "missing-videos"),
        },
        scope: {
          prompts: true,
          versions: false,
          images: false,
          skills: false,
          config: false,
        },
      }),
    ).rejects.toThrow("complete durable export");
    expect(fs.existsSync(destination)).toBe(false);
  });
});
