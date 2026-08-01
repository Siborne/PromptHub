import fs from "node:fs/promises";
import { writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createAgentUserConfigFileService } from "../../../src/main/services/agent-user-config-files";

const encryption = {
  isEncryptionAvailable: () => true,
  encryptString: (value: string) => Buffer.from(`encrypted:${value}`, "utf8"),
  decryptString: (value: Buffer) =>
    value.toString("utf8").replace(/^encrypted:/, ""),
};

describe("Agent user config files", () => {
  let tempRoot: string;
  let agentRoot: string;
  let backupRoot: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-user-config-"));
    agentRoot = path.join(tempRoot, ".claude");
    backupRoot = path.join(tempRoot, "backups");
    await fs.mkdir(path.join(agentRoot, "agents"), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  function service() {
    return createAgentUserConfigFileService({ backupRoot, encryption });
  }

  function context(declaredPaths = ["settings.json", "keybindings.json"]) {
    return {
      agentId: "claude",
      rootPath: agentRoot,
      relativePaths: declaredPaths,
    };
  }

  it("discovers safe user files and declared missing files while excluding runtime state", async () => {
    await fs.writeFile(path.join(agentRoot, "settings.json"), "{}", "utf8");
    await fs.writeFile(path.join(agentRoot, "CLAUDE.md"), "# Rules", "utf8");
    await fs.writeFile(
      path.join(agentRoot, "agents", "reviewer.md"),
      "# Reviewer",
      "utf8",
    );
    await fs.writeFile(
      path.join(agentRoot, ".credentials.json"),
      "secret",
      "utf8",
    );
    await fs.mkdir(path.join(agentRoot, "transcripts"));
    await fs.writeFile(
      path.join(agentRoot, "transcripts", "session.json"),
      "{}",
      "utf8",
    );
    await fs.mkdir(path.join(agentRoot, "tasks"));
    await fs.writeFile(
      path.join(agentRoot, "tasks", "task.json"),
      "{}",
      "utf8",
    );
    await fs.mkdir(path.join(agentRoot, "third-party-package"));
    await fs.writeFile(
      path.join(agentRoot, "third-party-package", "package.json"),
      "{}",
      "utf8",
    );
    await fs.mkdir(path.join(agentRoot, "skills", "example"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(agentRoot, "skills", "example", "SKILL.md"),
      "# Skill",
      "utf8",
    );
    await fs.writeFile(
      path.join(agentRoot, "settings.json.backup-1"),
      "{}",
      "utf8",
    );

    await expect(service().list(context())).resolves.toEqual([
      { path: "agents", isDirectory: true },
      { path: "agents/reviewer.md", isDirectory: false, size: 10 },
      { path: "CLAUDE.md", isDirectory: false, size: 7 },
      { path: "keybindings.json", isDirectory: false, size: 0 },
      { path: "settings.json", isDirectory: false, size: 2 },
    ]);
  });

  it("redacts embedded secrets before IPC and preserves them on save", async () => {
    const source = JSON.stringify(
      {
        env: { ANTHROPIC_AUTH_TOKEN: "top-secret", SAFE_VALUE: "visible" },
        model: "opus",
      },
      null,
      2,
    );
    await fs.writeFile(path.join(agentRoot, "settings.json"), source, {
      encoding: "utf8",
      mode: 0o600,
    });

    const configService = service();
    const loaded = await configService.read(context(), "settings.json");
    expect(loaded?.content).not.toContain("top-secret");
    expect(loaded?.content).toContain("__PROMPTHUB_REDACTED_SECRET_1__");
    expect(loaded?.revision).toBeTruthy();
    expect(loaded?.redacted).toBe(true);

    const saved = await configService.write(
      context(),
      "settings.json",
      loaded!.content.replace('"opus"', '"sonnet"'),
      loaded!.revision,
    );
    const persisted = await fs.readFile(
      path.join(agentRoot, "settings.json"),
      "utf8",
    );
    expect(persisted).toContain("top-secret");
    expect(persisted).toContain('"sonnet"');
    expect(saved.content).not.toContain("top-secret");
    expect(saved.revision).not.toBe(loaded?.revision);

    const backupFiles = await fs.readdir(
      path.dirname(
        path.join(
          backupRoot,
          "claude",
          (await fs.readdir(path.join(backupRoot, "claude")))[0],
          "settings.json.enc",
        ),
      ),
    );
    expect(backupFiles).toContain("settings.json.enc");
    const backupPath = path.join(
      backupRoot,
      "claude",
      (await fs.readdir(path.join(backupRoot, "claude")))[0],
      "settings.json.enc",
    );
    expect(await fs.readFile(backupPath, "utf8")).not.toContain("top-secret");
  });

  it("rejects stale writes without overwriting external changes", async () => {
    const target = path.join(agentRoot, "settings.json");
    await fs.writeFile(target, '{"model":"opus"}', "utf8");
    const configService = service();
    const loaded = await configService.read(context(), "settings.json");
    await fs.writeFile(target, '{"model":"haiku"}', "utf8");

    await expect(
      configService.write(
        context(),
        "settings.json",
        '{"model":"sonnet"}',
        loaded!.revision,
      ),
    ).rejects.toThrow("AGENT_CONFIG_CONCURRENT_CHANGE");
    await expect(fs.readFile(target, "utf8")).resolves.toBe(
      '{"model":"haiku"}',
    );
  });

  it("rejects invalid structured content and raw secret mutations", async () => {
    const target = path.join(agentRoot, "settings.json");
    await fs.writeFile(
      target,
      '{"env":{"ANTHROPIC_AUTH_TOKEN":"top-secret"},"model":"opus"}',
      "utf8",
    );
    const configService = service();
    const loaded = await configService.read(context(), "settings.json");

    await expect(
      configService.write(context(), "settings.json", "{", loaded!.revision),
    ).rejects.toThrow("AGENT_CONFIG_FORMAT_INVALID");
    await expect(
      configService.write(
        context(),
        "settings.json",
        loaded!.content.replace(
          "__PROMPTHUB_REDACTED_SECRET_1__",
          "replacement-secret",
        ),
        loaded!.revision,
      ),
    ).rejects.toThrow("AGENT_CONFIG_SECRET_EDIT_UNSUPPORTED");
    await expect(fs.readFile(target, "utf8")).resolves.toContain("top-secret");
  });

  it("rejects unknown and duplicated redaction placeholders", async () => {
    const target = path.join(agentRoot, "config.conf");
    await fs.writeFile(
      target,
      [
        "token='top-secret'",
        "api_key=unquoted-secret",
        "authorization=Bearer bearer-secret-value",
        "model=one",
        "",
      ].join("\n"),
      "utf8",
    );
    const configService = service();
    const loaded = await configService.read(
      context(["config.conf"]),
      "config.conf",
    );
    expect(loaded?.content).not.toContain("top-secret");
    expect(loaded?.content).not.toContain("unquoted-secret");
    expect(loaded?.content).not.toContain("bearer-secret-value");

    await expect(
      configService.write(
        context(["config.conf"]),
        "config.conf",
        loaded!.content.replace("_1__", "_2__"),
        loaded!.revision,
      ),
    ).rejects.toThrow("AGENT_CONFIG_SECRET_EDIT_UNSUPPORTED");
    await expect(
      configService.write(
        context(["config.conf"]),
        "config.conf",
        `${loaded!.content}copy=__PROMPTHUB_REDACTED_SECRET_1__\n`,
        loaded!.revision,
      ),
    ).rejects.toThrow("AGENT_CONFIG_SECRET_EDIT_UNSUPPORTED");
    await expect(
      configService.write(
        context(["config.conf"]),
        "config.conf",
        `${loaded!.content}note=__PROMPTHUB_REDACTED_SECRET_bad__\n`,
        loaded!.revision,
      ),
    ).rejects.toThrow("AGENT_CONFIG_SECRET_EDIT_UNSUPPORTED");
  });

  it("validates TOML and YAML while preserving their redacted secrets", async () => {
    const tomlPath = path.join(agentRoot, "config.toml");
    const yamlPath = path.join(agentRoot, "profile.yaml");
    await fs.writeFile(
      tomlPath,
      'api_key = "toml-secret"\nmodel = "one"\n',
      "utf8",
    );
    await fs.writeFile(yamlPath, 'token: "yaml-secret"\nmodel: one\n', "utf8");
    const configService = service();
    const toml = await configService.read(
      context(["config.toml", "profile.yaml"]),
      "config.toml",
    );
    const yaml = await configService.read(
      context(["config.toml", "profile.yaml"]),
      "profile.yaml",
    );

    await configService.write(
      context(["config.toml", "profile.yaml"]),
      "config.toml",
      toml!.content.replace('model = "one"', 'model = "two"'),
      toml!.revision,
    );
    await configService.write(
      context(["config.toml", "profile.yaml"]),
      "profile.yaml",
      yaml!.content.replace("model: one", "model: two"),
      yaml!.revision,
    );
    await expect(fs.readFile(tomlPath, "utf8")).resolves.toContain(
      'api_key = "toml-secret"',
    );
    await expect(fs.readFile(yamlPath, "utf8")).resolves.toContain(
      'token: "yaml-secret"',
    );

    const nextToml = await configService.read(
      context(["config.toml", "profile.yaml"]),
      "config.toml",
    );
    const nextYaml = await configService.read(
      context(["config.toml", "profile.yaml"]),
      "profile.yaml",
    );
    await expect(
      configService.write(
        context(["config.toml", "profile.yaml"]),
        "config.toml",
        "broken = [",
        nextToml!.revision,
      ),
    ).rejects.toThrow("AGENT_CONFIG_FORMAT_INVALID");
    await expect(
      configService.write(
        context(["config.toml", "profile.yaml"]),
        "profile.yaml",
        "broken: [",
        nextYaml!.revision,
      ),
    ).rejects.toThrow("AGENT_CONFIG_FORMAT_INVALID");
  });

  it("rolls back exact bytes when post-write verification fails", async () => {
    const target = path.join(agentRoot, "settings.json");
    const original = '{"model":"opus"}';
    await fs.writeFile(target, original, "utf8");
    let writeCount = 0;
    const configService = createAgentUserConfigFileService({
      backupRoot,
      encryption,
      writeAtomically: async (targetPath, content) => {
        writeCount += 1;
        await fs.writeFile(
          targetPath,
          writeCount === 1 ? '{"model":"corrupt"}' : content,
          "utf8",
        );
      },
    });
    const loaded = await configService.read(context(), "settings.json");

    await expect(
      configService.write(
        context(),
        "settings.json",
        '{"model":"sonnet"}',
        loaded!.revision,
      ),
    ).rejects.toThrow("AGENT_CONFIG_VERIFY_FAILED");
    await expect(fs.readFile(target, "utf8")).resolves.toBe(original);
    expect(writeCount).toBe(2);
  });

  it("removes a newly-created file when verification fails", async () => {
    const target = path.join(agentRoot, "keybindings.json");
    const configService = createAgentUserConfigFileService({
      backupRoot,
      encryption,
      writeAtomically: async (targetPath) => {
        await fs.writeFile(targetPath, '{"corrupt":true}', "utf8");
      },
    });

    await expect(
      configService.write(
        context(),
        "keybindings.json",
        '{"ctrl+k":"command"}',
        undefined,
      ),
    ).rejects.toThrow("AGENT_CONFIG_VERIFY_FAILED");
    await expect(fs.access(target)).rejects.toThrow();
  });

  it("does not write when encrypted backup storage is unavailable", async () => {
    const target = path.join(agentRoot, "settings.json");
    const original = '{"model":"opus"}';
    await fs.writeFile(target, original, "utf8");
    const configService = createAgentUserConfigFileService({
      backupRoot,
      encryption: { ...encryption, isEncryptionAvailable: () => false },
    });
    const loaded = await configService.read(context(), "settings.json");

    await expect(
      configService.write(
        context(),
        "settings.json",
        '{"model":"sonnet"}',
        loaded!.revision,
      ),
    ).rejects.toThrow("AGENT_CONFIG_BACKUP_ENCRYPTION_UNAVAILABLE");
    await expect(fs.readFile(target, "utf8")).resolves.toBe(original);
  });

  it("rejects traversal, excluded files, symlinks, and arbitrary missing files", async () => {
    const outside = path.join(tempRoot, "outside.json");
    await fs.writeFile(outside, "{}", "utf8");
    await fs.symlink(outside, path.join(agentRoot, "linked.json"));
    await fs.writeFile(path.join(agentRoot, "auth.json"), "{}", "utf8");
    const configService = service();

    for (const relativePath of [
      "../outside.json",
      "auth.json",
      "linked.json",
      "undeclared.json",
    ]) {
      await expect(
        configService.read(context(), relativePath),
      ).rejects.toThrow();
    }
  });

  it("creates a declared missing file through the validated atomic path", async () => {
    await expect(
      service().read(context(), "keybindings.json"),
    ).resolves.toBeNull();
    const created = await service().write(
      context(),
      "keybindings.json",
      '{"ctrl+k":"command"}',
      undefined,
    );

    expect(created.content).toBe('{"ctrl+k":"command"}');
    await expect(
      fs.readFile(path.join(agentRoot, "keybindings.json"), "utf8"),
    ).resolves.toBe('{"ctrl+k":"command"}');
  });

  it("rejects unsafe content and revision state for a missing file", async () => {
    const configService = service();
    await expect(
      configService.write(
        context(),
        "keybindings.json",
        JSON.stringify({ token: "new-secret" }),
        undefined,
      ),
    ).rejects.toThrow("AGENT_CONFIG_SECRET_EDIT_UNSUPPORTED");
    await expect(
      configService.write(
        context(),
        "keybindings.json",
        "{}",
        "unexpected-revision",
      ),
    ).rejects.toThrow("AGENT_CONFIG_CONCURRENT_CHANGE");
    await expect(
      configService.write(
        context(),
        "keybindings.json",
        "x".repeat(1024 * 1024 + 1),
        undefined,
      ),
    ).rejects.toThrow("AGENT_CONFIG_FILE_INVALID");
  });

  it("serializes same-file writes and rejects the stale queued mutation", async () => {
    const target = path.join(agentRoot, "settings.json");
    await fs.writeFile(target, '{"model":"opus"}', "utf8");
    const configService = service();
    const loaded = await configService.read(context(), "settings.json");
    const results = await Promise.allSettled([
      configService.write(
        context(),
        "settings.json",
        '{"model":"sonnet"}',
        loaded!.revision,
      ),
      configService.write(
        context(),
        "settings.json",
        '{"model":"haiku"}',
        loaded!.revision,
      ),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    expect(
      results.find((result) => result.status === "rejected")?.reason,
    ).toEqual(expect.objectContaining({ message: "AGENT_CONFIG_CONCURRENT_CHANGE" }));
  });

  it("detects an external mutation between backup and atomic replacement", async () => {
    const target = path.join(agentRoot, "settings.json");
    await fs.writeFile(target, '{"model":"opus"}', "utf8");
    const configService = createAgentUserConfigFileService({
      backupRoot,
      encryption: {
        ...encryption,
        encryptString: (value) => {
          writeFileSync(target, '{"model":"external"}', "utf8");
          return encryption.encryptString(value);
        },
      },
    });
    const loaded = await configService.read(context(), "settings.json");

    await expect(
      configService.write(
        context(),
        "settings.json",
        '{"model":"sonnet"}',
        loaded!.revision,
      ),
    ).rejects.toThrow("AGENT_CONFIG_CONCURRENT_CHANGE");
    await expect(fs.readFile(target, "utf8")).resolves.toBe(
      '{"model":"external"}',
    );
  });

  it("bounds discovered files and ignores unsafe declared targets", async () => {
    const deepRelativePath = "config/a/b/c/d/e/f/g/deep.json";
    const deepTarget = path.join(agentRoot, deepRelativePath);
    await fs.mkdir(path.dirname(deepTarget), { recursive: true });
    await fs.writeFile(deepTarget, "{}", "utf8");
    await fs.symlink(
      path.join(tempRoot, "outside.json"),
      path.join(agentRoot, "linked.json"),
    );
    await fs.writeFile(path.join(tempRoot, "outside.json"), "{}", "utf8");
    const entries = await service().list(
      context([deepRelativePath, "linked.json"]),
    );

    expect(entries).toContainEqual({
      path: deepRelativePath,
      isDirectory: false,
      size: 2,
    });
    expect(entries).not.toContainEqual(
      expect.objectContaining({ path: "linked.json" }),
    );

    await fs.mkdir(path.join(agentRoot, "profile.json"));
    await expect(
      service().read(context(["profile.json"]), "profile.json"),
    ).rejects.toThrow("AGENT_CONFIG_FILE_INVALID");
    await expect(
      service().read(context(["skills/example.json"]), "skills/example.json"),
    ).rejects.toThrow("AGENT_CONFIG_PATH_EXCLUDED");
  });

  it("lists declared files when the user-level Agent root is missing", async () => {
    const missingRoot = path.join(tempRoot, "missing-agent");
    await expect(
      service().list({ ...context(), rootPath: missingRoot }),
    ).resolves.toEqual([
      { path: "keybindings.json", isDirectory: false, size: 0 },
      { path: "settings.json", isDirectory: false, size: 0 },
    ]);
  });

  it("rejects a symlinked Agent root", async () => {
    const realRoot = path.join(tempRoot, "real-agent");
    const linkedRoot = path.join(tempRoot, "linked-agent");
    await fs.mkdir(realRoot);
    await fs.writeFile(path.join(realRoot, "settings.json"), "{}", "utf8");
    await fs.symlink(realRoot, linkedRoot);

    await expect(
      service().list({ ...context(), rootPath: linkedRoot }),
    ).rejects.toThrow("AGENT_CONFIG_ROOT_INVALID");
    await expect(
      service().write(
        { ...context(), rootPath: linkedRoot },
        "settings.json",
        "{}",
        undefined,
      ),
    ).rejects.toThrow("AGENT_CONFIG_ROOT_INVALID");
  });
});
