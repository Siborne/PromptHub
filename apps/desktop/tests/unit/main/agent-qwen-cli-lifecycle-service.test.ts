import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPlatformById } from "@prompthub/shared/constants/platforms";
import {
  AgentCliLifecycleService,
  type AgentCliLifecycleDependencies,
} from "../../../src/main/services/agent-cli-lifecycle-service";
import { diagnoseAgentCli } from "../../../src/main/services/agent-cli-diagnostic-service";

const QWEN_PATH =
  "/Users/test/.nvm/versions/node/v22.0.0/lib/node_modules/@qwen-code/qwen-code/dist/index.js";
const NPM_PATH =
  "/Users/test/.nvm/versions/node/v22.0.0/lib/node_modules/npm/bin/npm-cli.js";
const PACKAGE_PREFIX = "@qwen-code/qwen-code@";

function qwenPlatform() {
  const platform = getPlatformById("qwen");
  if (!platform) throw new Error("Qwen Code platform is required");
  return platform;
}

function createHarness() {
  let now = 1_700_000_000_000;
  let version = "0.8.2";
  let qwenPath: string | null = QWEN_PATH;
  let npmPath: string | null = NPM_PATH;
  const resolve = vi.fn(async (command: string) => {
    if (command === "qwen") return qwenPath;
    if (command === "npm") return npmPath;
    return null;
  });
  const run = vi.fn(
    async (
      command: string,
      args: string[],
    ): Promise<{ stdout: string; stderr: string }> => {
      if (command === qwenPath && args[0] === "--version") {
        return { stdout: `qwen ${version}`, stderr: "" };
      }
      if (command === NPM_PATH && args.at(-1) === `${PACKAGE_PREFIX}latest`) {
        version = "0.8.3";
      } else if (
        command === NPM_PATH &&
        args.at(-1)?.startsWith(PACKAGE_PREFIX)
      ) {
        version = args.at(-1)!.slice(PACKAGE_PREFIX.length);
        qwenPath = QWEN_PATH;
      }
      return { stdout: "", stderr: "" };
    },
  );
  const dependencies: AgentCliLifecycleDependencies = {
    now: () => now,
    randomId: vi.fn(() => "qwen-plan"),
    resolve,
    run,
  };
  return {
    dependencies,
    getVersion: () => version,
    run,
    service: new AgentCliLifecycleService(dependencies),
    setNpmPath: (value: string | null) => {
      npmPath = value;
    },
    setQwenPath: (value: string | null) => {
      qwenPath = value;
    },
    setVersion: (value: string) => {
      version = value;
    },
  };
}

describe("npm-managed Qwen Code CLI lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("declares one fixed npm update and exact-version rollback contract", () => {
    expect(qwenPlatform().cli?.update).toEqual({
      args: ["install", "-g", "@qwen-code/qwen-code@latest"],
      command: {
        executableCandidates: ["npm"],
        supportedInstallSources: ["npm", "node-version-manager"],
      },
      rollbackArgsPrefix: ["install", "-g"],
      rollbackTargetPrefix: PACKAGE_PREFIX,
      evidence: "official-qwen-code-npm-install",
    });
  });

  it("creates an immutable review plan and verifies the same executable", async () => {
    const harness = createHarness();
    const plan = await harness.service.planUpdate(qwenPlatform(), 7);

    expect(plan).toEqual({
      id: "qwen-plan",
      agentId: "qwen",
      operation: "update",
      command: {
        executable: NPM_PATH,
        args: ["install", "-g", "@qwen-code/qwen-code@latest"],
      },
      currentVersion: "0.8.2",
      installSource: "node-version-manager",
      expiresAt: 1_700_000_300_000,
    });
    plan.command.executable = "/tmp/renderer-command";
    plan.command.args.splice(0, plan.command.args.length, "run", "payload");

    await expect(
      harness.service.applyUpdate(plan.id, 7),
    ).resolves.toMatchObject({
      status: "applied",
      previousVersion: "0.8.2",
      currentVersion: "0.8.3",
    });
    expect(harness.run).toHaveBeenCalledWith(
      NPM_PATH,
      ["install", "-g", "@qwen-code/qwen-code@latest"],
      expect.objectContaining({ timeout: 120_000, maxBuffer: 256 * 1024 }),
    );
  });

  it("advertises updates for npm and Node version-manager paths only", async () => {
    for (const executablePath of [
      QWEN_PATH,
      "/Users/test/.npm/bin/node_modules/@qwen-code/qwen-code/dist/index.js",
    ]) {
      const harness = createHarness();
      harness.setQwenPath(executablePath);

      await expect(
        diagnoseAgentCli(qwenPlatform(), harness.dependencies),
      ).resolves.toMatchObject({
        status: "installed",
        canUpdate: true,
      });
    }
  });

  it("keeps unsupported installation sources diagnostic-only", async () => {
    for (const executablePath of [
      "/opt/homebrew/bin/qwen",
      "/usr/local/bin/qwen",
      "/Users/test/.local/bin/qwen",
      "/Users/test/source/qwen",
    ]) {
      const harness = createHarness();
      harness.setQwenPath(executablePath);
      const diagnostic = await diagnoseAgentCli(
        qwenPlatform(),
        harness.dependencies,
      );

      expect(diagnostic.canUpdate).toBe(false);
      await expect(
        harness.service.planUpdate(qwenPlatform(), 7),
      ).rejects.toMatchObject({ code: "unsupported-install-source" });
      expect(
        harness.run.mock.calls.some(([command]) => command === NPM_PATH),
      ).toBe(false);
    }
  });

  it("fails before mutation when npm is unavailable", async () => {
    const harness = createHarness();
    harness.setNpmPath(null);

    await expect(
      harness.service.planUpdate(qwenPlatform(), 7),
    ).rejects.toMatchObject({ code: "update-command-not-found" });
    expect(
      harness.run.mock.calls.some(([, args]) => args[0] === "install"),
    ).toBe(false);
  });

  it("rejects a changed active executable or version before npm runs", async () => {
    const changedPath = createHarness();
    const pathPlan = await changedPath.service.planUpdate(qwenPlatform(), 7);
    changedPath.setQwenPath(`${QWEN_PATH}.other`);
    await expect(
      changedPath.service.applyUpdate(pathPlan.id, 7),
    ).rejects.toMatchObject({ code: "precondition-changed" });

    const changedVersion = createHarness();
    const versionPlan = await changedVersion.service.planUpdate(
      qwenPlatform(),
      7,
    );
    changedVersion.setVersion("0.8.2-patched");
    await expect(
      changedVersion.service.applyUpdate(versionPlan.id, 7),
    ).rejects.toMatchObject({ code: "precondition-changed" });

    for (const harness of [changedPath, changedVersion]) {
      expect(
        harness.run.mock.calls.some(([, args]) => args[0] === "install"),
      ).toBe(false);
    }
  });

  it("returns a bounded failure when the original installation is intact", async () => {
    const harness = createHarness();
    const plan = await harness.service.planUpdate(qwenPlatform(), 7);
    harness.run.mockImplementation(async (command, args) => {
      if (command === QWEN_PATH && args[0] === "--version") {
        return { stdout: "qwen 0.8.2", stderr: "" };
      }
      throw new Error("Authorization: Bearer must not cross IPC");
    });

    await expect(harness.service.applyUpdate(plan.id, 7)).resolves.toEqual({
      agentId: "qwen",
      operation: "update",
      status: "failed",
      previousVersion: "0.8.2",
      currentVersion: "0.8.2",
      errorCode: "update-failed",
    });
  });

  it("rolls back with the captured exact version after a changed post-state", async () => {
    const harness = createHarness();
    let updateRan = false;
    harness.run.mockImplementation(async (command, args) => {
      if (command === QWEN_PATH && args[0] === "--version") {
        return { stdout: `qwen ${harness.getVersion()}`, stderr: "" };
      }
      if (command === NPM_PATH && args.at(-1) === `${PACKAGE_PREFIX}latest`) {
        updateRan = true;
        harness.setVersion("0.8.3");
        harness.setQwenPath("/tmp/ambiguous-qwen");
        return { stdout: "updated", stderr: "" };
      }
      if (command === NPM_PATH && args.at(-1) === `${PACKAGE_PREFIX}0.8.2`) {
        harness.setVersion("0.8.2");
        harness.setQwenPath(QWEN_PATH);
        return { stdout: "restored", stderr: "" };
      }
      if (
        command === "/tmp/ambiguous-qwen" &&
        args[0] === "--version" &&
        updateRan
      ) {
        return { stdout: "qwen 0.8.3", stderr: "" };
      }
      throw new Error("unexpected command");
    });
    const plan = await harness.service.planUpdate(qwenPlatform(), 7);

    await expect(harness.service.applyUpdate(plan.id, 7)).resolves.toEqual({
      agentId: "qwen",
      operation: "update",
      status: "rolled-back",
      previousVersion: "0.8.2",
      currentVersion: "0.8.2",
      errorCode: "verification-failed",
    });
    expect(harness.run).toHaveBeenCalledWith(
      NPM_PATH,
      ["install", "-g", "@qwen-code/qwen-code@0.8.2"],
      expect.objectContaining({ timeout: 120_000 }),
    );
  });
});
