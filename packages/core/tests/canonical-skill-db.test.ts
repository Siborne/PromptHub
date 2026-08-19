import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { DatabaseAdapter, SCHEMA } from "@prompthub/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CanonicalSkillDB } from "../src/canonical-skill-db";
import {
  getCanonicalSkillWorkspacePath,
  publishCanonicalSkill,
} from "../src/canonical-skill-library";
import { readSkillResourceBundle } from "../src/skill-resource-schema";
import { configureRuntimePaths, resetRuntimePaths } from "../src/runtime-paths";
import {
  writeCanonicalStorageAuthority,
  writeRuntimeLayoutState,
} from "../src";

describe("canonical Skill database adapter", () => {
  let root: string;
  let database: DatabaseAdapter.Database;
  let skillDb: CanonicalSkillDB;
  let sourcePath: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "prompthub-canonical-skill-"));
    configureRuntimePaths({ userDataPath: root });
    writeRuntimeLayoutState(root);
    writeCanonicalStorageAuthority(root, {
      consistencyId: "d".repeat(64),
      operationId: "canonical-skill-test",
    });
    database = new DatabaseAdapter(":memory:");
    database.exec(SCHEMA);
    skillDb = new CanonicalSkillDB(database);
    sourcePath = path.join(root, "incoming-skill");
    fs.mkdirSync(sourcePath);
    fs.writeFileSync(path.join(sourcePath, "SKILL.md"), "# Initial\n");
  });

  afterEach(() => {
    database.close();
    resetRuntimePaths();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("publishes DB mutations and keeps the writable workspace disposable", () => {
    const created = skillDb.create({
      name: "canonical-skill",
      protocol_type: "skill",
      content: "Initial",
      is_favorite: false,
      local_repo_path: sourcePath,
    });
    const bundlePath = path.join(root, "data", "skills", created.id);
    const workspacePath = getCanonicalSkillWorkspacePath(created.id);

    expect(skillDb.getById(created.id)?.local_repo_path).toBe(workspacePath);
    expect(fs.readFileSync(path.join(workspacePath, "SKILL.md"), "utf8")).toBe(
      "# Initial\n",
    );
    expect(readSkillResourceBundle(bundlePath).bundleManifest.revision).toBe(1);

    fs.writeFileSync(path.join(workspacePath, "SKILL.md"), "# Updated\n");
    skillDb.update(created.id, {
      content: "Updated",
      directory_fingerprint: "f".repeat(64),
    });
    expect(
      fs.readFileSync(path.join(bundlePath, "files", "SKILL.md"), "utf8"),
    ).toBe("# Updated\n");
    expect(readSkillResourceBundle(bundlePath).bundleManifest.revision).toBe(2);

    skillDb.createVersion(created.id, "snapshot", [
      { relativePath: "SKILL.md", content: "# Updated\n" },
    ]);
    expect(readSkillResourceBundle(bundlePath).versions).toHaveLength(1);
    expect(skillDb.delete(created.id)).toBe(true);
    expect(fs.existsSync(bundlePath)).toBe(false);
    expect(fs.existsSync(workspacePath)).toBe(false);
  });

  it("rolls back a failed bundle replacement without touching the prior bundle", () => {
    const created = skillDb.create({
      name: "canonical-skill",
      protocol_type: "skill",
      content: "Initial",
      is_favorite: false,
      local_repo_path: sourcePath,
    });
    const before = readSkillResourceBundle(
      path.join(root, "data", "skills", created.id),
    );

    expect(() =>
      publishCanonicalSkill({
        skill: { ...created, content: "Broken", updated_at: Date.now() },
        versions: [],
        packageSourcePath: sourcePath,
        injectPublicationFailure() {
          throw new Error("disk full");
        },
      }),
    ).toThrow("disk full");

    const restored = readSkillResourceBundle(
      path.join(root, "data", "skills", created.id),
    );
    expect(restored.skill.content).toBe(before.skill.content);
    expect(restored.bundleManifest.revision).toBe(
      before.bundleManifest.revision,
    );
  });

  it("hydrates canonical Skill workspaces only once per database connection", () => {
    const created = skillDb.create({
      name: "one-shot-hydration",
      protocol_type: "skill",
      content: "Initial",
      is_favorite: false,
      local_repo_path: sourcePath,
    });
    const workspacePath = getCanonicalSkillWorkspacePath(created.id);

    skillDb.reconcileCanonicalWorkspaces();
    fs.rmSync(workspacePath, { recursive: true, force: true });
    new CanonicalSkillDB(database).reconcileCanonicalWorkspaces();

    expect(fs.existsSync(workspacePath)).toBe(false);
  });
});
