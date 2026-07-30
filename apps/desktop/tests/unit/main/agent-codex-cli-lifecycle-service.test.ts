import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPlatformById } from "@prompthub/shared/constants/platforms";
import {
  AgentCliLifecycleService,
  type AgentCliLifecycleDependencies,
} from "../../../src/main/services/agent-cli-lifecycle-service";
import { diagnoseAgentCli } from "../../../src/main/services/agent-cli-diagnostic-service";

const CODEX_NPM_PATH =
  "/Users/test/.nvm/versions/node/v22.0.0/lib/node_modules/@openai/codex/bin/codex.js";
const NPM_PATH =
  "/Users/test/.nvm/versions/node/v22.0.0/lib/node_modules/npm/bin/npm-cli.js";

function codexPlatform() {
  const platform = getPlatformById("codex");
  if (!platform) throw new Error("Codex platform is required");
  return platform;
}

function createHarness() {
  let now = 1_700_000_000_000;
  let version = "0.137.0";
  let codexPath: string | null = CODEX_NPM_PATH;
  let npmPath: string | null = NPM_PATH;
  const resolve = vi.fn(async (command: string) => {
    if (command === "codex") return codexPath;
    if (command === "npm") return npmPath;
    return null;
  });
  const run = vi.fn(
    async (
      command: string,
      args: string[],
    ): Promise<{ stdout: string; stderr: string }> => {
      if (command === codexPath && args[0] === "--version") {
        return { stdout: `codex-cli ${version}`, stderr: "" };
      }
      if (command === NPM_PATH && args.at(-1) === "@openai/codex@latest") {
        version = "0.138.0";
      }
      if (
        command === NPM_PATH &&
        args.at(-1)?.startsWith("@openai/codex@") &&
        args.at(-1) !== "@openai/codex@latest"
      ) {
        version = args.at(-1)!.slice("@openai/codex@".length);
        codexPath = CODEX_NPM_PATH;
      }
      return { stdout: "", stderr: "" };
    },
  );
  const dependencies: AgentCliLifecycleDependencies = {
    now: () => now,
    randomId: vi.fn(() => "codex-plan"),
    resolve,
    run,
  };
  return {
    dependencies,
    getVersion: () => version,
    resolve,
    run,
    service: new AgentCliLifecycleService(dependencies),
    setCodexPath: (value: string | null) => {
      codexPath = value;
    },
    setNpmPath: (value: string | null) => {
      npmPath = value;
    },
    setVersion: (value: string) => {
      version = value;
    },
  };
}

describe("npm-managed Codex CLI lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("declares one fixed npm update and exact-version rollback contract", () => {
    expect(codexPlatform().cli?.update).toEqual({
      args: ["install", "-g", "@openai/codex@latest"],
      command: {
        executableCandidates: ["npm"],
        supportedInstallSources: ["npm", "node-version-manager"],
      },
      rollbackArgsPrefix: ["install", "-g"],
      rollbackTargetPrefix: "@openai/codex@",
      evidence: "official-codex-npm-install",
    });
  });

  it("creates a detached review plan using npm rather than renderer command input", async () => {
    const harness = createHarness();

    const plan = await harness.service.planUpdate(codexPlatform(), 7);

    expect(plan).toEqual({
      id: "codex-plan",
      agentId: "codex",
      operation: "update",
      command: {
        executable: NPM_PATH,
        args: ["install", "-g", "@openai/codex@latest"],
      },
      currentVersion: "0.137.0",
      installSource: "node-version-manager",
      expiresAt: 1_700_000_300_000,
    });
    plan.command.executable = "/tmp/renderer-command";
    plan.command.args.splice(0, plan.command.args.length, "run", "payload");

    await expect(
      harness.service.applyUpdate(plan.id, 7),
    ).resolves.toMatchObject({
      status: "applied",
      previousVersion: "0.137.0",
      currentVersion: "0.138.0",
    });
    expect(harness.run).toHaveBeenCalledWith(
      NPM_PATH,
      ["install", "-g", "@openai/codex@latest"],
      expect.objectContaining({ timeout: 120_000, maxBuffer: 256 * 1024 }),
    );
  });

  it("keeps unsupported Codex installation sources diagnostic-only", async () => {
    for (const executablePath of [
      "/opt/homebrew/Caskroom/codex/0.137.0/codex",
      "/usr/local/bin/codex",
      "/Users/test/.local/bin/codex",
      "/Users/test/bin/codex",
    ]) {
      const harness = createHarness();
      harness.setCodexPath(executablePath);
      const diagnostic = await diagnoseAgentCli(
        codexPlatform(),
        harness.dependencies,
      );

      expect(diagnostic.canUpdate).toBe(false);
      await expect(
        harness.service.planUpdate(codexPlatform(), 7),
      ).rejects.toMatchObject({ code: "unsupported-install-source" });
      expect(
        harness.run.mock.calls.some(([command]) => command === NPM_PATH),
      ).toBe(false);
    }
  });

  it("does not advertise an update when Codex is not installed", async () => {
    const harness = createHarness();
    harness.setCodexPath(null);

    await expect(
      diagnoseAgentCli(codexPlatform(), harness.dependencies),
    ).resolves.toMatchObject({
      status: "not-installed",
      executablePath: null,
      installSource: null,
      canUpdate: false,
    });
    expect(harness.run).not.toHaveBeenCalled();
  });

  it("fails before mutation when the matching npm executable is unavailable", async () => {
    const harness = createHarness();
    harness.setNpmPath(null);

    await expect(
      harness.service.planUpdate(codexPlatform(), 7),
    ).rejects.toMatchObject({ code: "update-command-not-found" });
    expect(
      harness.run.mock.calls.some(([, args]) => args[0] === "install"),
    ).toBe(false);
  });

  it("rejects a changed active Codex executable or version before npm runs", async () => {
    const changedPath = createHarness();
    const pathPlan = await changedPath.service.planUpdate(codexPlatform(), 7);
    changedPath.setCodexPath(`${CODEX_NPM_PATH}.other`);
    await expect(
      changedPath.service.applyUpdate(pathPlan.id, 7),
    ).rejects.toMatchObject({ code: "precondition-changed" });

    const changedVersion = createHarness();
    const versionPlan = await changedVersion.service.planUpdate(
      codexPlatform(),
      7,
    );
    changedVersion.setVersion("0.137.1");
    await expect(
      changedVersion.service.applyUpdate(versionPlan.id, 7),
    ).rejects.toMatchObject({ code: "precondition-changed" });

    for (const harness of [changedPath, changedVersion]) {
      expect(
        harness.run.mock.calls.some(([, args]) => args[0] === "install"),
      ).toBe(false);
    }
  });

  it("rolls back with the captured exact npm version if verification changes the active path", async () => {
    const harness = createHarness();
    let updateRan = false;
    harness.run.mockImplementation(async (command, args) => {
      if (command === CODEX_NPM_PATH && args[0] === "--version") {
        return {
          stdout: `codex-cli ${harness.getVersion()}`,
          stderr: "",
        };
      }
      if (command === NPM_PATH && args.at(-1) === "@openai/codex@latest") {
        updateRan = true;
        harness.setVersion("0.138.0");
        harness.setCodexPath("/tmp/ambiguous-codex");
        return { stdout: "updated", stderr: "" };
      }
      if (command === NPM_PATH && args.at(-1) === "@openai/codex@0.137.0") {
        harness.setVersion("0.137.0");
        harness.setCodexPath(CODEX_NPM_PATH);
        return { stdout: "restored", stderr: "" };
      }
      if (
        command === "/tmp/ambiguous-codex" &&
        args[0] === "--version" &&
        updateRan
      ) {
        return { stdout: "codex-cli 0.138.0", stderr: "" };
      }
      throw new Error("Authorization: Bearer should-not-escape");
    });
    const plan = await harness.service.planUpdate(codexPlatform(), 7);

    await expect(harness.service.applyUpdate(plan.id, 7)).resolves.toEqual({
      agentId: "codex",
      operation: "update",
      status: "rolled-back",
      previousVersion: "0.137.0",
      currentVersion: "0.137.0",
      errorCode: "verification-failed",
    });
    expect(harness.run).toHaveBeenCalledWith(
      NPM_PATH,
      ["install", "-g", "@openai/codex@0.137.0"],
      expect.objectContaining({ timeout: 120_000 }),
    );
  });
});
