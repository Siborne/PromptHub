import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { Skill, SkillVersion } from "@prompthub/shared/types";
import { afterEach, describe, expect, it } from "vitest";

import {
  materializeSkillResourceBundle,
  readSkillResourceBundle,
} from "../src/skill-resource-schema";

const roots: string[] = [];

function root(): string {
  const value = fs.mkdtempSync(
    path.join(os.tmpdir(), "prompthub-skill-bundle-"),
  );
  roots.push(value);
  return value;
}

function skill(repoPath: string): Skill {
  return {
    id: "skill-1",
    visibility: "private",
    name: "writer",
    description: "Writes clearly",
    content: "# Writer\n",
    instructions: "# Writer\n",
    protocol_type: "skill",
    version: "1.0.0",
    source_url: "https://example.com/writer.git",
    source_id: "example/writer",
    logical_name: "writer",
    variant_key: "main",
    local_repo_path: repoPath,
    tags: ["writing"],
    original_tags: ["writing"],
    is_favorite: true,
    currentVersion: 1,
    versionTrackingEnabled: true,
    created_at: Date.parse("2026-08-11T00:00:00.000Z"),
    updated_at: Date.parse("2026-08-11T01:00:00.000Z"),
  };
}

function version(): SkillVersion {
  return {
    id: "skill-version-1",
    skillId: "skill-1",
    version: 1,
    content: "# Writer\n",
    filesSnapshot: [{ relativePath: "SKILL.md", content: "# Writer\n" }],
    note: "initial",
    createdAt: "2026-08-11T00:00:00.000Z",
  };
}

afterEach(() => {
  for (const value of roots.splice(0))
    fs.rmSync(value, { recursive: true, force: true });
});

describe("skill resource schema", () => {
  it("replaces metadata-only edits with an independent resource revision", () => {
    const base = root();
    const bundle = path.join(base, "canonical", "skill-1");
    const initial = skill(path.join(base, "repo"));
    materializeSkillResourceBundle({
      bundlePath: bundle,
      skill: initial,
      versions: [version()],
      packageFiles: [],
    });
    const updated = {
      ...initial,
      description: "Writes with precision",
      updated_at: Date.parse("2026-08-11T02:00:00.000Z"),
    };

    const manifest = materializeSkillResourceBundle({
      bundlePath: bundle,
      skill: updated,
      versions: [version()],
      packageFiles: [],
      writePolicy: { mode: "replace" },
    });

    expect(manifest.revision).toBe(2);
    expect(readSkillResourceBundle(bundle).skill.description).toBe(
      "Writes with precision",
    );
  });

  it("publishes and reloads complete metadata, versions, and package files", () => {
    const base = root();
    const repo = path.join(base, "repo");
    fs.mkdirSync(path.join(repo, "references"), { recursive: true });
    fs.writeFileSync(path.join(repo, "SKILL.md"), "# Writer\n", "utf8");
    fs.writeFileSync(
      path.join(repo, "references", "guide.md"),
      "guide",
      "utf8",
    );
    const bundle = path.join(base, "canonical", "skill-1");

    materializeSkillResourceBundle({
      bundlePath: bundle,
      skill: skill(repo),
      versions: [version()],
      packageFiles: [
        { path: "SKILL.md", sourcePath: path.join(repo, "SKILL.md") },
        {
          path: "references/guide.md",
          sourcePath: path.join(repo, "references", "guide.md"),
        },
      ],
    });
    const restored = readSkillResourceBundle(bundle);

    expect(restored.skill).toMatchObject({
      id: "skill-1",
      logical_name: "writer",
      variant_key: "main",
      local_repo_path: path.join(bundle, "files"),
    });
    expect(restored.versions).toEqual([version()]);
    expect(restored.packageFiles.map((file) => file.path)).toEqual([
      "SKILL.md",
      "references/guide.md",
    ]);
    const storedDocument = JSON.parse(
      fs.readFileSync(path.join(bundle, "skill.json"), "utf8"),
    );
    expect(storedDocument.skill.local_repo_path).toBeUndefined();
  });

  it("strips machine-local URLs and rejects unsafe package/version identities", () => {
    const base = root();
    const local = skill(path.join(base, "repo"));
    local.source_url = path.join(base, "source");
    local.content_url = "file:///tmp/content";
    local.icon_url = "/tmp/icon.png";
    const bundle = path.join(base, "bundle");
    materializeSkillResourceBundle({
      bundlePath: bundle,
      skill: local,
      versions: [version()],
      packageFiles: [],
    });
    const restored = readSkillResourceBundle(bundle).skill;
    expect(restored).not.toHaveProperty("source_url");
    expect(restored).not.toHaveProperty("content_url");
    expect(restored).not.toHaveProperty("icon_url");

    const foreign = version();
    foreign.skillId = "other";
    expect(() =>
      materializeSkillResourceBundle({
        bundlePath: path.join(base, "invalid"),
        skill: local,
        versions: [foreign],
        packageFiles: [],
      }),
    ).toThrow(/does not belong/u);
    expect(() =>
      materializeSkillResourceBundle({
        bundlePath: path.join(base, "unsafe"),
        skill: local,
        versions: [version()],
        packageFiles: [{ path: "../escape", sourcePath: __filename }],
      }),
    ).toThrow(/package path/u);
  });

  it("fails closed on metadata tampering and undeclared bundle files", () => {
    const base = root();
    const bundle = path.join(base, "bundle");
    materializeSkillResourceBundle({
      bundlePath: bundle,
      skill: skill(path.join(base, "repo")),
      versions: [version()],
      packageFiles: [],
    });
    fs.appendFileSync(path.join(bundle, "skill.json"), " ");
    expect(() => readSkillResourceBundle(bundle)).toThrow(/size mismatch/u);
  });
});
