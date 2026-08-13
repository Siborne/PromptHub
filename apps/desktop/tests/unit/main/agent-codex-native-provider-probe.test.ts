/**
 * @vitest-environment node
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createCodexNativeProviderProbe } from "../../../src/main/services/agent-codex-native-provider-probe";
import type { NativeCommandRunner } from "../../../src/main/services/native-command";

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "codex-native-probe-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

function runner(
  run: NativeCommandRunner["run"] = vi.fn().mockResolvedValue({
    stdout: "Logged in using ChatGPT\n",
    stderr: "",
  }),
): NativeCommandRunner {
  return {
    resolve: vi.fn().mockResolvedValue("/opt/homebrew/bin/codex"),
    run,
  };
}

function commandFailure(stderr: string, overrides: object = {}): Error {
  return Object.assign(new Error("Codex command failed"), {
    stderr,
    ...overrides,
  });
}

describe("Codex official native provider probe", () => {
  it("checks the official login without sending a model request", async () => {
    const root = await temporaryRoot();
    const commandRunner = runner();
    const probe = createCodexNativeProviderProbe({
      commandRunner,
      now: vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(112),
    });

    await expect(
      probe.testConnection({ codexHome: root, model: "gpt-5.6-sol" }),
    ).resolves.toEqual({
      protocol: "platform-native",
      endpointOrigin: null,
      model: "gpt-5.6-sol",
      status: "ok",
      startedAt: 100,
      finishedAt: 112,
      totalMs: 12,
      retryCount: 0,
      modelCount: null,
      modelAvailable: null,
    });
    expect(commandRunner.run).toHaveBeenCalledWith(
      "/opt/homebrew/bin/codex",
      ["login", "status"],
      expect.objectContaining({
        timeout: 10_000,
        maxBuffer: 16_384,
        env: expect.objectContaining({ CODEX_HOME: root }),
      }),
    );
  });

  it("reports missing CLI, signed-out auth and bounded login timeouts", async () => {
    const root = await temporaryRoot();
    const missing = runner();
    vi.mocked(missing.resolve).mockResolvedValue(null);
    const signedOut = runner(
      vi.fn().mockRejectedValue(commandFailure("Not logged in")),
    );
    const timedOut = runner(
      vi
        .fn()
        .mockRejectedValue(
          commandFailure("", { killed: true, signal: "SIGTERM" }),
        ),
    );

    await expect(
      createCodexNativeProviderProbe({ commandRunner: missing }).testConnection(
        {
          codexHome: root,
          model: "gpt-5.6-sol",
        },
      ),
    ).resolves.toMatchObject({
      status: "unsupported",
      errorCode: "codex-cli-not-found",
    });
    await expect(
      createCodexNativeProviderProbe({
        commandRunner: signedOut,
      }).testConnection({
        codexHome: root,
        model: "gpt-5.6-sol",
      }),
    ).resolves.toMatchObject({
      status: "no-credentials",
      errorCode: "codex-login-required",
    });
    await expect(
      createCodexNativeProviderProbe({
        commandRunner: timedOut,
      }).testConnection({
        codexHome: root,
        model: "gpt-5.6-sol",
      }),
    ).resolves.toMatchObject({
      status: "timeout",
      errorCode: "codex-login-timeout",
    });
  });

  it("tests the selected official model in an isolated ephemeral run and cleans output", async () => {
    const root = await temporaryRoot();
    let workingDirectory = "";
    const run = vi.fn<NativeCommandRunner["run"]>(
      async (_command, args, options) => {
        workingDirectory = args[args.indexOf("--cd") + 1];
        const outputPath = args[args.indexOf("--output-last-message") + 1];
        await fs.writeFile(outputPath, "OK\n");
        expect(options.signal).toBeInstanceOf(AbortSignal);
        return { stdout: "", stderr: "" };
      },
    );
    const commandRunner = runner(run);
    const probe = createCodexNativeProviderProbe({
      commandRunner,
      now: vi.fn().mockReturnValueOnce(200).mockReturnValueOnce(245),
    });

    await expect(
      probe.testModel({
        codexHome: root,
        model: "gpt-5.6-sol",
        signal: new AbortController().signal,
      }),
    ).resolves.toMatchObject({
      protocol: "platform-native",
      model: "gpt-5.6-sol",
      status: "ok",
      totalMs: 45,
      outputPreview: "OK",
    });
    expect(run).toHaveBeenCalledWith(
      "/opt/homebrew/bin/codex",
      expect.not.arrayContaining(["--ask-for-approval"]),
      expect.anything(),
    );
    expect(run).toHaveBeenCalledWith(
      "/opt/homebrew/bin/codex",
      expect.arrayContaining([
        "exec",
        "--ephemeral",
        "--ignore-user-config",
        "--ignore-rules",
        "--skip-git-repo-check",
        "--sandbox",
        "read-only",
        "--model",
        "gpt-5.6-sol",
      ]),
      expect.objectContaining({
        timeout: 60_000,
        maxBuffer: 65_536,
        env: expect.objectContaining({ CODEX_HOME: root }),
      }),
    );
    await expect(fs.stat(workingDirectory)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it.each([
    ["Not logged in", "no-credentials", "codex-login-required"],
    ["401 unauthorized", "auth-error", "codex-auth-failed"],
    ["usage limit reached", "quota-error", "codex-quota-unavailable"],
    ["429 too many requests", "rate-limited", "codex-rate-limited"],
    ["model is not supported", "model-not-found", "codex-model-not-found"],
    ["ENOTFOUND api.openai.com", "network-error", "codex-network-failed"],
  ])("redacts model failures for %s", async (stderr, status, errorCode) => {
    const root = await temporaryRoot();
    const probe = createCodexNativeProviderProbe({
      commandRunner: runner(
        vi.fn().mockRejectedValue(commandFailure(stderr as string)),
      ),
    });

    const result = await probe.testModel({
      codexHome: root,
      model: "gpt-5.6-sol",
      signal: new AbortController().signal,
    });
    expect(result).toMatchObject({ status, errorCode, outputPreview: null });
    expect(JSON.stringify(result)).not.toContain(stderr);
  });

  it("keeps cancellation distinct from timeout", async () => {
    const root = await temporaryRoot();
    const controller = new AbortController();
    controller.abort();
    const probe = createCodexNativeProviderProbe({ commandRunner: runner() });

    await expect(
      probe.testModel({
        codexHome: root,
        model: "gpt-5.6-sol",
        signal: controller.signal,
      }),
    ).resolves.toMatchObject({
      status: "cancelled",
      errorCode: "codex-model-test-cancelled",
    });
  });
});
