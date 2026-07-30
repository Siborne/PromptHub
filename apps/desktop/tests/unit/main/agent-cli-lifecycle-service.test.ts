import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SkillPlatform } from "@prompthub/shared/constants/platforms";
import { AgentCliLifecycleService } from "../../../src/main/services/agent-cli-lifecycle-service";

const platform: SkillPlatform = {
  id: "opencode",
  name: "OpenCode",
  icon: "Terminal",
  rootDir: {
    darwin: "~/.config/opencode",
    win32: "%USERPROFILE%\\.config\\opencode",
    linux: "~/.config/opencode",
  },
  skillsRelativePath: "skills",
  cli: {
    executableCandidates: ["opencode"],
    versionArgs: ["--version"],
    evidence: "official-opencode-cli",
    update: {
      args: ["upgrade"],
      rollbackTargetPrefix: "v",
      evidence: "official-opencode-cli-upgrade",
    },
  },
};

function createHarness(randomId: () => string = () => "plan-1") {
  let now = 1_700_000_000_000;
  let version = "1.0.0";
  let resolvedPath: string | null = "/opt/homebrew/bin/opencode";
  const resolve = vi.fn(async () => resolvedPath);
  const run = vi.fn(
    async (
      _command: string,
      args: string[],
    ): Promise<{ stdout: string; stderr: string }> => {
      if (args[0] === "--version") {
        return { stdout: version, stderr: "" };
      }
      if (args[0] === "upgrade" && args.length === 1) {
        version = "1.1.0";
      }
      if (args[0] === "upgrade" && args[1]) {
        version = args[1].replace(/^v/, "");
      }
      return { stdout: "", stderr: "" };
    },
  );
  const service = new AgentCliLifecycleService({
    now: () => now,
    randomId: vi.fn(randomId),
    resolve,
    run,
  });
  return {
    advance: (milliseconds: number) => {
      now += milliseconds;
    },
    getVersion: () => version,
    resolve,
    run,
    service,
    setResolvedPath: (value: string | null) => {
      resolvedPath = value;
    },
    setVersion: (value: string) => {
      version = value;
    },
  };
}

describe("Agent CLI lifecycle service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a bounded main-owned OpenCode update plan without mutating", async () => {
    const harness = createHarness();

    const plan = await harness.service.planUpdate(platform, 7);

    expect(plan).toEqual({
      id: "plan-1",
      agentId: "opencode",
      operation: "update",
      command: {
        executable: "/opt/homebrew/bin/opencode",
        args: ["upgrade"],
      },
      currentVersion: "1.0.0",
      installSource: "homebrew",
      expiresAt: 1_700_000_300_000,
    });
    expect(harness.run).toHaveBeenCalledTimes(1);
    expect(harness.run).toHaveBeenCalledWith(
      "/opt/homebrew/bin/opencode",
      ["--version"],
      expect.any(Object),
    );
  });

  it("rejects platforms without an evidence-backed update contract", async () => {
    const harness = createHarness();

    await expect(
      harness.service.planUpdate(
        {
          ...platform,
          id: "claude",
          cli: {
            executableCandidates: ["claude"],
            versionArgs: ["--version"],
            evidence: "official-claude-cli",
          },
        },
        7,
      ),
    ).rejects.toMatchObject({ code: "unsupported" });
  });

  it("rejects missing or unhealthy CLIs before creating a plan", async () => {
    const missing = createHarness();
    missing.setResolvedPath(null);
    await expect(missing.service.planUpdate(platform, 7)).rejects.toMatchObject(
      {
        code: "not-installed",
      },
    );

    const unhealthy = createHarness();
    unhealthy.run.mockRejectedValueOnce(new Error("version failed"));
    await expect(
      unhealthy.service.planUpdate(platform, 7),
    ).rejects.toMatchObject({
      code: "diagnostic-failed",
    });

    const invalidVersion = createHarness();
    invalidVersion.setVersion("development-build");
    await expect(
      invalidVersion.service.planUpdate(platform, 7),
    ).rejects.toMatchObject({ code: "invalid-version" });
  });

  it("applies the immutable plan and verifies the resulting version", async () => {
    const harness = createHarness();
    const plan = await harness.service.planUpdate(platform, 7);
    plan.command.executable = "/tmp/renderer-controlled-opencode";
    plan.command.args[0] = "renderer-controlled-command";

    await expect(harness.service.applyUpdate(plan.id, 7)).resolves.toEqual({
      agentId: "opencode",
      operation: "update",
      status: "applied",
      previousVersion: "1.0.0",
      currentVersion: "1.1.0",
      errorCode: null,
    });
    expect(harness.run).toHaveBeenCalledWith(
      "/opt/homebrew/bin/opencode",
      ["upgrade"],
      expect.objectContaining({
        timeout: 120_000,
        maxBuffer: 256 * 1024,
      }),
    );
  });

  it("reports a successful no-change update without inventing a new version", async () => {
    const harness = createHarness();
    harness.run.mockImplementation(
      async (
        _command: string,
        args: string[],
      ): Promise<{ stdout: string; stderr: string }> => {
        if (args[0] === "--version") {
          return { stdout: "1.0.0", stderr: "" };
        }
        return { stdout: "already up to date", stderr: "" };
      },
    );
    const plan = await harness.service.planUpdate(platform, 7);

    await expect(
      harness.service.applyUpdate(plan.id, 7),
    ).resolves.toMatchObject({
      status: "no-change",
      previousVersion: "1.0.0",
      currentVersion: "1.0.0",
    });
  });

  it("invalidates expired, replayed and precondition-mismatched plans", async () => {
    const expired = createHarness();
    const expiredPlan = await expired.service.planUpdate(platform, 7);
    expired.advance(300_001);
    await expect(
      expired.service.applyUpdate(expiredPlan.id, 7),
    ).rejects.toMatchObject({ code: "plan-expired" });

    const replayed = createHarness();
    const replayedPlan = await replayed.service.planUpdate(platform, 7);
    await replayed.service.applyUpdate(replayedPlan.id, 7);
    await expect(
      replayed.service.applyUpdate(replayedPlan.id, 7),
    ).rejects.toMatchObject({ code: "plan-not-found" });

    const changed = createHarness();
    const changedPlan = await changed.service.planUpdate(platform, 7);
    changed.setVersion("1.0.1");
    await expect(
      changed.service.applyUpdate(changedPlan.id, 7),
    ).rejects.toMatchObject({ code: "precondition-changed" });
    expect(
      changed.run.mock.calls.some(([, args]) => args[0] === "upgrade"),
    ).toBe(false);
  });

  it("rolls back to the exact prior version when verification fails", async () => {
    const harness = createHarness();
    let versionChecks = 0;
    harness.run.mockImplementation(
      async (
        _command: string,
        args: string[],
      ): Promise<{ stdout: string; stderr: string }> => {
        if (args[0] === "--version") {
          versionChecks += 1;
          if (versionChecks === 3) {
            throw new Error("new binary is unhealthy");
          }
          return {
            stdout: versionChecks < 3 ? "1.0.0" : "1.0.0",
            stderr: "",
          };
        }
        return { stdout: "", stderr: "" };
      },
    );
    const plan = await harness.service.planUpdate(platform, 7);

    await expect(harness.service.applyUpdate(plan.id, 7)).resolves.toEqual({
      agentId: "opencode",
      operation: "update",
      status: "rolled-back",
      previousVersion: "1.0.0",
      currentVersion: "1.0.0",
      errorCode: "verification-failed",
    });
    expect(harness.run).toHaveBeenCalledWith(
      "/opt/homebrew/bin/opencode",
      ["upgrade", "v1.0.0"],
      expect.objectContaining({ timeout: 120_000 }),
    );
  });

  it("reports bounded recovery failure without returning command output", async () => {
    const harness = createHarness();
    let updateStarted = false;
    harness.run.mockImplementation(
      async (
        _command: string,
        args: string[],
      ): Promise<{ stdout: string; stderr: string }> => {
        if (args[0] === "--version") {
          if (updateStarted) throw new Error("Authorization: Bearer secret");
          return { stdout: "1.0.0", stderr: "" };
        }
        updateStarted = true;
        if (args[1]) throw new Error("rollback failed with secret");
        return { stdout: "api_key=secret", stderr: "" };
      },
    );
    const plan = await harness.service.planUpdate(platform, 7);

    const result = await harness.service.applyUpdate(plan.id, 7);

    expect(result).toEqual({
      agentId: "opencode",
      operation: "update",
      status: "failed",
      previousVersion: "1.0.0",
      currentVersion: null,
      errorCode: "rollback-failed",
    });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("reports an update command failure when the original version remains healthy", async () => {
    const harness = createHarness();
    harness.run.mockImplementation(
      async (
        _command: string,
        args: string[],
      ): Promise<{ stdout: string; stderr: string }> => {
        if (args[0] === "--version") {
          return { stdout: "1.0.0", stderr: "" };
        }
        throw new Error("update failed");
      },
    );
    const plan = await harness.service.planUpdate(platform, 7);

    await expect(harness.service.applyUpdate(plan.id, 7)).resolves.toEqual({
      agentId: "opencode",
      operation: "update",
      status: "failed",
      previousVersion: "1.0.0",
      currentVersion: "1.0.0",
      errorCode: "update-failed",
    });
  });

  it("rolls back when a failed update changed the executable version", async () => {
    const harness = createHarness();
    let version = "1.0.0";
    harness.run.mockImplementation(
      async (
        _command: string,
        args: string[],
      ): Promise<{ stdout: string; stderr: string }> => {
        if (args[0] === "--version") {
          return { stdout: version, stderr: "" };
        }
        if (args[1]) {
          version = "1.0.0";
          return { stdout: "", stderr: "" };
        }
        version = "1.1.0";
        throw new Error("failed after mutation");
      },
    );
    const plan = await harness.service.planUpdate(platform, 7);

    await expect(
      harness.service.applyUpdate(plan.id, 7),
    ).resolves.toMatchObject({
      status: "rolled-back",
      errorCode: "update-failed",
      currentVersion: "1.0.0",
    });
  });

  it("fails closed when a rollback command cannot restore the prior version", async () => {
    const harness = createHarness();
    let versionChecks = 0;
    harness.run.mockImplementation(
      async (
        _command: string,
        args: string[],
      ): Promise<{ stdout: string; stderr: string }> => {
        if (args[0] === "--version") {
          versionChecks += 1;
          if (versionChecks === 3) throw new Error("verify failed");
          return {
            stdout: versionChecks > 3 ? "1.1.0" : "1.0.0",
            stderr: "",
          };
        }
        return { stdout: "", stderr: "" };
      },
    );
    const plan = await harness.service.planUpdate(platform, 7);

    await expect(
      harness.service.applyUpdate(plan.id, 7),
    ).resolves.toMatchObject({
      status: "failed",
      errorCode: "rollback-failed",
      currentVersion: null,
    });
  });

  it("recovers when post-update executable resolution throws", async () => {
    const harness = createHarness();
    harness.resolve
      .mockResolvedValueOnce("/opt/homebrew/bin/opencode")
      .mockResolvedValueOnce("/opt/homebrew/bin/opencode")
      .mockRejectedValueOnce(new Error("resolver unavailable"))
      .mockResolvedValue("/opt/homebrew/bin/opencode");
    const plan = await harness.service.planUpdate(platform, 7);

    await expect(
      harness.service.applyUpdate(plan.id, 7),
    ).resolves.toMatchObject({
      status: "rolled-back",
      errorCode: "verification-failed",
    });
  });

  it("rolls back when update failure diagnostics cannot resolve the executable", async () => {
    const harness = createHarness();
    harness.resolve
      .mockResolvedValueOnce("/opt/homebrew/bin/opencode")
      .mockResolvedValueOnce("/opt/homebrew/bin/opencode")
      .mockRejectedValueOnce(new Error("resolver unavailable"))
      .mockResolvedValue("/opt/homebrew/bin/opencode");
    harness.run.mockImplementation(
      async (
        _command: string,
        args: string[],
      ): Promise<{ stdout: string; stderr: string }> => {
        if (args[0] === "--version") {
          return { stdout: "1.0.0", stderr: "" };
        }
        if (args.length === 1) throw new Error("update failed");
        return { stdout: "", stderr: "" };
      },
    );
    const plan = await harness.service.planUpdate(platform, 7);

    await expect(
      harness.service.applyUpdate(plan.id, 7),
    ).resolves.toMatchObject({
      status: "rolled-back",
      errorCode: "update-failed",
    });
  });

  it("fails closed when rollback verification cannot resolve the executable", async () => {
    const harness = createHarness();
    harness.resolve
      .mockResolvedValueOnce("/opt/homebrew/bin/opencode")
      .mockResolvedValueOnce("/opt/homebrew/bin/opencode")
      .mockRejectedValueOnce(new Error("post-update resolver unavailable"))
      .mockRejectedValueOnce(new Error("rollback resolver unavailable"));
    const plan = await harness.service.planUpdate(platform, 7);

    await expect(
      harness.service.applyUpdate(plan.id, 7),
    ).resolves.toMatchObject({
      status: "failed",
      errorCode: "rollback-failed",
    });
  });

  it("uses the captured rollback contract if the registry object changes after planning", async () => {
    const mutablePlatform: SkillPlatform = structuredClone(platform);
    const harness = createHarness();
    let versionChecks = 0;
    harness.run.mockImplementation(
      async (
        _command: string,
        args: string[],
      ): Promise<{ stdout: string; stderr: string }> => {
        if (args[0] === "--version") {
          versionChecks += 1;
          if (versionChecks === 3) throw new Error("verify failed");
          return { stdout: "1.0.0", stderr: "" };
        }
        return { stdout: "", stderr: "" };
      },
    );
    const plan = await harness.service.planUpdate(mutablePlatform, 7);
    if (mutablePlatform.cli) mutablePlatform.cli.update = undefined;

    await expect(
      harness.service.applyUpdate(plan.id, 7),
    ).resolves.toMatchObject({
      status: "rolled-back",
      errorCode: "verification-failed",
    });
  });

  it("allows only one application of a plan under concurrent calls", async () => {
    const harness = createHarness();
    const plan = await harness.service.planUpdate(platform, 7);

    const results = await Promise.allSettled([
      harness.service.applyUpdate(plan.id, 7),
      harness.service.applyUpdate(plan.id, 7),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(
      harness.run.mock.calls.filter(([, args]) => args[0] === "upgrade"),
    ).toHaveLength(1);
  });

  it("binds a pending plan to the renderer that created it", async () => {
    const harness = createHarness();
    const plan = await harness.service.planUpdate(platform, 7);

    await expect(harness.service.applyUpdate(plan.id, 8)).rejects.toMatchObject(
      {
        code: "plan-owner-mismatch",
      },
    );
    await expect(
      harness.service.applyUpdate(plan.id, 7),
    ).resolves.toMatchObject({
      status: "applied",
    });
  });

  it("bounds pending plans and rejects exhausted id generation", async () => {
    let sequence = 0;
    const bounded = createHarness(() => `plan-${sequence++}`);
    const plans = [];
    for (let index = 0; index < 33; index += 1) {
      plans.push(await bounded.service.planUpdate(platform, 7));
    }
    await expect(
      bounded.service.applyUpdate(plans[0].id, 7),
    ).rejects.toMatchObject({ code: "plan-not-found" });

    const collision = createHarness(() => "same-plan");
    await collision.service.planUpdate(platform, 7);
    await expect(
      collision.service.planUpdate(platform, 7),
    ).rejects.toMatchObject({ code: "plan-not-found" });
  });

  it("prunes expired plans before admitting a new plan", async () => {
    let sequence = 0;
    const harness = createHarness(() => `plan-${sequence++}`);
    const expired = await harness.service.planUpdate(platform, 7);
    harness.advance(300_001);
    await harness.service.planUpdate(platform, 7);

    await expect(
      harness.service.applyUpdate(expired.id, 7),
    ).rejects.toMatchObject({ code: "plan-not-found" });
  });
});
