import fs from "fs";
import path from "path";

import { afterEach, describe, expect, it } from "vitest";

import { closeDatabase, resetRuntimePaths } from "@prompthub/core";

import {
  execCli,
  makeTempRoot,
  withDataDir,
  withTempHome,
} from "./helpers/cli-harness";

describe("agent CLI", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    closeDatabase();
    resetRuntimePaths();
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("lists and resolves installed Agents with shared capability truth", async () => {
    const root = makeTempRoot(tempDirs);

    await withTempHome(root, async (homeDir) => {
      fs.mkdirSync(path.join(homeDir, ".claude"), { recursive: true });

      const list = await execCli([
        ...withDataDir(root),
        "agent",
        "list",
        "--filter",
        "installed",
      ]);

      expect(list.exitCode).toBe(0);
      expect(list.json).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "claude",
            name: "Claude Code",
            enabled: true,
            isDetected: true,
            status: "installed",
            paths: expect.objectContaining({
              root: path.join(homeDir, ".claude"),
            }),
            capabilities: expect.objectContaining({
              overview: { status: "supported" },
              provider: { status: "supported" },
              sessions: { status: "supported" },
            }),
          }),
        ]),
      );

      const get = await execCli([
        ...withDataDir(root),
        "agent",
        "get",
        "Claude Code",
      ]);
      expect(get.exitCode).toBe(0);
      expect(get.json.id).toBe("claude");

      const table = await execCli([
        ...withDataDir(root),
        "--output",
        "table",
        "agent",
        "list",
        "--search",
        "claude",
      ]);
      expect(table.exitCode).toBe(0);
      expect(table.joinedStdout).toContain("Claude Code");
      expect(table.joinedStdout).toContain("installed");
    });
  });

  it("persists built-in visibility, root overrides, and identity preferences", async () => {
    const root = makeTempRoot(tempDirs);

    await withTempHome(root, async (homeDir) => {
      fs.mkdirSync(path.join(homeDir, ".claude"), { recursive: true });
      const customRoot = path.join(homeDir, "tools", "claude-home");

      const disabled = await execCli([
        ...withDataDir(root),
        "agent",
        "disable",
        "claude",
      ]);
      expect(disabled.exitCode).toBe(0);
      expect(disabled.json).toMatchObject({ id: "claude", enabled: false });

      const hidden = await execCli([
        ...withDataDir(root),
        "agent",
        "list",
        "--search",
        "claude",
      ]);
      expect(hidden.json).toEqual([]);

      const visible = await execCli([
        ...withDataDir(root),
        "agent",
        "list",
        "--search",
        "claude",
        "--include-disabled",
      ]);
      expect(visible.json[0]).toMatchObject({ id: "claude", enabled: false });

      const configured = await execCli([
        ...withDataDir(root),
        "agent",
        "configure",
        "claude",
        "--root",
        customRoot,
        "--skills-path",
        "team/skills",
        "--config-paths",
        "settings.json,profiles/default.json",
      ]);
      expect(configured.exitCode).toBe(0);
      expect(configured.json.paths).toMatchObject({
        root: customRoot,
        skills: path.join(customRoot, "team", "skills"),
      });
      expect(configured.json.paths.configFiles).toEqual([
        path.join(customRoot, "settings.json"),
        path.join(customRoot, "profiles", "default.json"),
      ]);

      const identity = await execCli([
        ...withDataDir(root),
        "agent",
        "identity",
        "set",
        "--name",
        "chatgpt",
        "--icon",
        "codex",
      ]);
      expect(identity.exitCode).toBe(0);
      expect(identity.json).toEqual({ name: "chatgpt", icon: "codex" });

      const codex = await execCli([
        ...withDataDir(root),
        "agent",
        "get",
        "codex",
      ]);
      expect(codex.json).toMatchObject({
        id: "codex",
        name: "ChatGPT",
        displayIconId: "codex",
      });

      const reset = await execCli([
        ...withDataDir(root),
        "agent",
        "reset",
        "claude",
      ]);
      expect(reset.exitCode).toBe(0);
      expect(reset.json.paths.root).toBe(path.join(homeDir, ".claude"));

      const enabled = await execCli([
        ...withDataDir(root),
        "agent",
        "enable",
        "claude",
      ]);
      expect(enabled.exitCode).toBe(0);
      expect(enabled.json).toMatchObject({ id: "claude", enabled: true });
    });
  });

  it("lists and reads Agent-native config with redaction and path boundaries", async () => {
    const root = makeTempRoot(tempDirs);

    await withTempHome(root, async (homeDir) => {
      const agentRoot = path.join(homeDir, "config-agent");
      const configPath = path.join(agentRoot, "settings", "config.toml");
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(
        configPath,
        ['model = "gpt-5"', 'api_key = "sk-test-secret-value"', ""].join("\n"),
      );
      const outsideConfigDir = path.join(homeDir, "outside-config");
      fs.mkdirSync(outsideConfigDir, { recursive: true });
      fs.writeFileSync(
        path.join(outsideConfigDir, "config.toml"),
        'model = "must-not-be-readable"\n',
      );
      fs.symlinkSync(outsideConfigDir, path.join(agentRoot, "linked"), "dir");
      fs.mkdirSync(path.join(agentRoot, "broken.toml"));

      const added = await execCli([
        ...withDataDir(root),
        "agent",
        "add",
        "--id",
        "config-agent",
        "--name",
        "Config Agent",
        "--root",
        agentRoot,
        "--config-paths",
        "settings/config.toml,profiles/missing.json,linked/config.toml,broken.toml",
      ]);
      expect(added.exitCode).toBe(0);

      const list = await execCli([
        ...withDataDir(root),
        "agent",
        "config",
        "list",
        "config-agent",
      ]);
      expect(list.exitCode).toBe(0);
      expect(list.json).toEqual(
        expect.arrayContaining([
          { path: "profiles", isDirectory: true },
          { path: "profiles/missing.json", isDirectory: false, size: 0 },
          { path: "settings", isDirectory: true },
          expect.objectContaining({
            path: "settings/config.toml",
            isDirectory: false,
          }),
        ]),
      );

      const table = await execCli([
        ...withDataDir(root),
        "--output",
        "table",
        "agent",
        "config",
        "list",
        "config-agent",
      ]);
      expect(table.exitCode).toBe(0);
      expect(table.joinedStdout).toContain("settings/config.toml");
      expect(table.joinedStdout).toContain("file");

      const read = await execCli([
        ...withDataDir(root),
        "agent",
        "config",
        "read",
        "Config Agent",
        "settings/config.toml",
      ]);
      expect(read.exitCode).toBe(0);
      expect(read.json).toMatchObject({
        path: "settings/config.toml",
        encoding: "text",
        redacted: true,
      });
      expect(read.json.revision).toMatch(/^[a-f0-9]{64}$/);
      expect(read.json.content).toContain("__PROMPTHUB_REDACTED_SECRET_1__");
      expect(read.json.content).not.toContain("sk-test-secret-value");
      expect(fs.readFileSync(configPath, "utf8")).toContain(
        "sk-test-secret-value",
      );

      const missing = await execCli([
        ...withDataDir(root),
        "agent",
        "config",
        "read",
        "config-agent",
        "profiles/missing.json",
      ]);
      expect(missing.exitCode).toBe(3);
      expect(missing.errorJson.error.code).toBe("AGENT_CONFIG_FILE_NOT_FOUND");

      const traversal = await execCli([
        ...withDataDir(root),
        "agent",
        "config",
        "read",
        "config-agent",
        "../outside.toml",
      ]);
      expect(traversal.exitCode).toBe(2);
      expect(traversal.errorJson.error.code).toBe("AGENT_CONFIG_PATH_INVALID");

      const excluded = await execCli([
        ...withDataDir(root),
        "agent",
        "config",
        "read",
        "config-agent",
        "sessions/session.json",
      ]);
      expect(excluded.exitCode).toBe(2);
      expect(excluded.errorJson.error.code).toBe("AGENT_CONFIG_PATH_EXCLUDED");

      const symlink = await execCli([
        ...withDataDir(root),
        "agent",
        "config",
        "read",
        "config-agent",
        "linked/config.toml",
      ]);
      expect(symlink.exitCode).toBe(5);
      expect(symlink.errorJson.error.code).toBe(
        "AGENT_CONFIG_SYMLINK_REJECTED",
      );

      const invalidFile = await execCli([
        ...withDataDir(root),
        "agent",
        "config",
        "read",
        "config-agent",
        "broken.toml",
      ]);
      expect(invalidFile.exitCode).toBe(5);
      expect(invalidFile.errorJson.error.code).toBe(
        "AGENT_CONFIG_FILE_INVALID",
      );

      const unsupportedAction = await execCli([
        ...withDataDir(root),
        "agent",
        "config",
        "write",
        "config-agent",
      ]);
      expect(unsupportedAction.exitCode).toBe(2);
      expect(unsupportedAction.errorJson.error.code).toBe("USAGE_ERROR");

      const extraArgument = await execCli([
        ...withDataDir(root),
        "agent",
        "config",
        "list",
        "config-agent",
        "unexpected",
      ]);
      expect(extraArgument.exitCode).toBe(2);
      expect(extraArgument.errorJson.error.code).toBe("USAGE_ERROR");

      const invalidRoot = path.join(homeDir, "invalid-root");
      fs.writeFileSync(invalidRoot, "not a directory\n");
      const invalidRootAgent = await execCli([
        ...withDataDir(root),
        "agent",
        "add",
        "--id",
        "invalid-root-agent",
        "--name",
        "Invalid Root Agent",
        "--root",
        invalidRoot,
        "--config-paths",
        "config.toml",
      ]);
      expect(invalidRootAgent.exitCode).toBe(0);
      const invalidRootRead = await execCli([
        ...withDataDir(root),
        "agent",
        "config",
        "read",
        "invalid-root-agent",
        "config.toml",
      ]);
      expect(invalidRootRead.exitCode).toBe(5);
      expect(invalidRootRead.errorJson.error.code).toBe(
        "AGENT_CONFIG_ROOT_INVALID",
      );

      await execCli([...withDataDir(root), "agent", "disable", "config-agent"]);
      const hidden = await execCli([
        ...withDataDir(root),
        "agent",
        "config",
        "list",
        "config-agent",
      ]);
      expect(hidden.exitCode).toBe(3);

      const included = await execCli([
        ...withDataDir(root),
        "agent",
        "config",
        "list",
        "config-agent",
        "--include-disabled",
      ]);
      expect(included.exitCode).toBe(0);
      expect(included.json).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "settings/config.toml" }),
        ]),
      );
    });
  });

  it("adds, updates, disables, and deletes custom Agents without touching roots", async () => {
    const root = makeTempRoot(tempDirs);

    await withTempHome(root, async (homeDir) => {
      const customRoot = path.join(homeDir, "team-agent");
      fs.mkdirSync(customRoot, { recursive: true });

      const added = await execCli([
        ...withDataDir(root),
        "agent",
        "add",
        "--id",
        "team-agent",
        "--name",
        "Team Agent",
        "--root",
        customRoot,
        "--skills-path",
        ".agents/skills",
        "--mcp-path",
        "mcp.json",
        "--rules-path",
        "AGENTS.md",
      ]);
      expect(added.exitCode).toBe(0);
      expect(added.json).toMatchObject({
        id: "team-agent",
        name: "Team Agent",
        isCustom: true,
        enabled: true,
        isDetected: true,
      });

      const updated = await execCli([
        ...withDataDir(root),
        "agent",
        "update",
        "team-agent",
        "--name",
        "Team Coding Agent",
        "--plugins-path",
        "plugins",
        "--disabled",
      ]);
      expect(updated.exitCode).toBe(0);
      expect(updated.json).toMatchObject({
        id: "team-agent",
        name: "Team Coding Agent",
        enabled: false,
      });

      const included = await execCli([
        ...withDataDir(root),
        "agent",
        "get",
        "team-agent",
        "--include-disabled",
      ]);
      expect(included.exitCode).toBe(0);
      expect(included.json.paths.plugins).toBe(
        path.join(customRoot, "plugins"),
      );

      const deleted = await execCli([
        ...withDataDir(root),
        "agent",
        "delete",
        "team-agent",
      ]);
      expect(deleted.exitCode).toBe(0);
      expect(deleted.json).toEqual({
        deleted: true,
        id: "team-agent",
        rootPreserved: true,
      });
      expect(fs.existsSync(customRoot)).toBe(true);

      const missing = await execCli([
        ...withDataDir(root),
        "agent",
        "get",
        "team-agent",
        "--include-disabled",
      ]);
      expect(missing.exitCode).toBe(3);
      expect(missing.errorJson.error.code).toBe("NOT_FOUND");
    });
  });

  it("rejects unsafe, duplicate, ambiguous, and built-in destructive mutations atomically", async () => {
    const root = makeTempRoot(tempDirs);

    await withTempHome(root, async (homeDir) => {
      const firstRoot = path.join(homeDir, "first-agent");
      const secondRoot = path.join(homeDir, "second-agent");
      for (const [id, name, agentRoot] of [
        ["team-one", "Team One", firstRoot],
        ["team-two", "Team Two", secondRoot],
      ]) {
        const result = await execCli([
          ...withDataDir(root),
          "agent",
          "add",
          "--id",
          id,
          "--name",
          name,
          "--root",
          agentRoot,
        ]);
        expect(result.exitCode).toBe(0);
      }

      const duplicateId = await execCli([
        ...withDataDir(root),
        "agent",
        "add",
        "--id",
        "claude",
        "--name",
        "Duplicate",
        "--root",
        path.join(homeDir, "duplicate"),
      ]);
      expect(duplicateId.exitCode).toBe(4);
      expect(duplicateId.errorJson.error.code).toBe("AGENT_ID_CONFLICT");

      const duplicateRoot = await execCli([
        ...withDataDir(root),
        "agent",
        "add",
        "--id",
        "team-three",
        "--name",
        "Team Three",
        "--root",
        firstRoot,
      ]);
      expect(duplicateRoot.exitCode).toBe(4);
      expect(duplicateRoot.errorJson.error.code).toBe("AGENT_ROOT_CONFLICT");

      const ambiguous = await execCli([
        ...withDataDir(root),
        "agent",
        "get",
        "Team",
      ]);
      expect(ambiguous.exitCode).toBe(2);
      expect(ambiguous.errorJson.error.code).toBe("AMBIGUOUS_AGENT");

      const unsafe = await execCli([
        ...withDataDir(root),
        "agent",
        "configure",
        "claude",
        "--root",
        path.join(homeDir, "must-not-persist"),
        "--skills-path",
        "../escape",
      ]);
      expect(unsafe.exitCode).toBe(2);
      expect(unsafe.errorJson.error.code).toBe("INVALID_AGENT_PATH");

      for (const invalidRelativePath of [
        path.join(homeDir, "absolute-skills"),
        "safe/../escape",
        "bad\0path",
        "",
      ]) {
        const invalidPath = await execCli([
          ...withDataDir(root),
          "agent",
          "configure",
          "claude",
          "--skills-path",
          invalidRelativePath,
        ]);
        expect(invalidPath.exitCode).toBe(2);
        expect(invalidPath.errorJson.error.code).toBe("INVALID_AGENT_PATH");
      }

      const unchanged = await execCli([
        ...withDataDir(root),
        "agent",
        "get",
        "claude",
      ]);
      expect(unchanged.json.paths.root).toBe(path.join(homeDir, ".claude"));

      const builtinDelete = await execCli([
        ...withDataDir(root),
        "agent",
        "delete",
        "claude",
      ]);
      expect(builtinDelete.exitCode).toBe(4);
      expect(builtinDelete.errorJson.error.code).toBe(
        "BUILTIN_AGENT_DELETE_FORBIDDEN",
      );

      const duplicateUpdate = await execCli([
        ...withDataDir(root),
        "agent",
        "update",
        "team-two",
        "--root",
        firstRoot,
      ]);
      expect(duplicateUpdate.exitCode).toBe(4);
      expect(duplicateUpdate.errorJson.error.code).toBe("AGENT_ROOT_CONFLICT");
      const unchangedCustom = await execCli([
        ...withDataDir(root),
        "agent",
        "get",
        "team-two",
      ]);
      expect(unchangedCustom.json.paths.root).toBe(secondRoot);
    });
  });

  it("reports help and stable usage errors for unsupported command shapes", async () => {
    const root = makeTempRoot(tempDirs);

    const help = await execCli([...withDataDir(root), "agent", "--help"]);
    expect(help.exitCode).toBe(0);
    expect(help.joinedStdout).toContain("prompthub agent list");

    const invalidFilter = await execCli([
      ...withDataDir(root),
      "agent",
      "list",
      "--filter",
      "broken",
    ]);
    expect(invalidFilter.exitCode).toBe(2);
    expect(invalidFilter.errorJson.error.code).toBe("USAGE_ERROR");

    const missingAddFields = await execCli([
      ...withDataDir(root),
      "agent",
      "add",
      "--name",
      "Missing root",
    ]);
    expect(missingAddFields.exitCode).toBe(2);

    const emptyConfigure = await execCli([
      ...withDataDir(root),
      "agent",
      "configure",
      "claude",
    ]);
    expect(emptyConfigure.exitCode).toBe(2);

    const builtinUpdate = await execCli([
      ...withDataDir(root),
      "agent",
      "update",
      "claude",
      "--name",
      "Nope",
    ]);
    expect(builtinUpdate.exitCode).toBe(2);

    const invalidIdentity = await execCli([
      ...withDataDir(root),
      "agent",
      "identity",
      "set",
      "--name",
      "other",
    ]);
    expect(invalidIdentity.exitCode).toBe(2);
    expect(invalidIdentity.errorJson.error.message).toContain("codex");

    const emptyIdentity = await execCli([
      ...withDataDir(root),
      "agent",
      "identity",
      "set",
      "--icon",
      "",
    ]);
    expect(emptyIdentity.exitCode).toBe(2);

    const unknown = await execCli([...withDataDir(root), "agent", "unknown"]);
    expect(unknown.exitCode).toBe(2);
  });

  it("keeps a missing custom Agent configured and visible to attention filters", async () => {
    const root = makeTempRoot(tempDirs);
    const missingRoot = path.join(root, "missing-agent-root");

    const added = await execCli([
      ...withDataDir(root),
      "agent",
      "add",
      "--id",
      "missing-team-agent",
      "--name",
      "Missing Team Agent",
      "--root",
      missingRoot,
    ]);
    expect(added.exitCode).toBe(0);
    expect(added.json).toMatchObject({
      status: "configured",
      isConfigured: true,
      isDetected: false,
    });

    const attention = await execCli([
      ...withDataDir(root),
      "agent",
      "list",
      "--filter",
      "needs-attention",
    ]);
    expect(attention.json.map((agent: { id: string }) => agent.id)).toContain(
      "missing-team-agent",
    );

    const resetCustom = await execCli([
      ...withDataDir(root),
      "agent",
      "reset",
      "missing-team-agent",
    ]);
    expect(resetCustom.exitCode).toBe(2);

    const emptyUpdate = await execCli([
      ...withDataDir(root),
      "agent",
      "update",
      "missing-team-agent",
    ]);
    expect(emptyUpdate.exitCode).toBe(2);

    const identity = await execCli([
      ...withDataDir(root),
      "agent",
      "identity",
      "get",
    ]);
    expect(identity.json).toEqual({ name: "codex", icon: "codex" });
  });
});
