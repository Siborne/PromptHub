import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { testPiModel } from "../../../src/main/services/agent-pi-model-test";

const roots: string[] = [];

async function createRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "prompthub-pi-test-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("Pi model test", () => {
  it("resolves a managed Pi credential only in main and dispatches the selected model", async () => {
    const root = await createRoot();
    await fs.writeFile(
      path.join(root, "models.json"),
      JSON.stringify({
        providers: {
          foxcode: {
            baseUrl: "https://api.example.com/v1",
            api: "openai-responses",
            models: [{ id: "gpt-custom" }],
          },
        },
      }),
    );
    await fs.writeFile(
      path.join(root, "auth.json"),
      JSON.stringify({ foxcode: { type: "api_key", key: "secret-value" } }),
    );
    const probe = vi.fn().mockResolvedValue({
      platformId: "pi",
      profileId: "pi:foxcode",
      protocol: "responses",
      endpointOrigin: "https://api.example.com",
      model: "gpt-custom",
      status: "ok",
      startedAt: 1,
      finishedAt: 2,
      firstTokenMs: 1,
      totalMs: 1,
      retryCount: 0,
      outputPreview: "ok",
    });

    const result = await testPiModel(
      root,
      { providerId: "foxcode", modelId: "gpt-custom" },
      new AbortController().signal,
      { probe },
    );

    expect(probe).toHaveBeenCalledWith(
      {
        profileId: "pi:foxcode",
        protocol: "openai-responses",
        endpoint: "https://api.example.com/v1",
        credential: "secret-value",
        model: "gpt-custom",
      },
      expect.any(AbortSignal),
    );
    expect(JSON.stringify(result)).not.toContain("secret-value");
  });

  it("resolves an environment credential and rejects unknown targets", async () => {
    const root = await createRoot();
    await fs.writeFile(
      path.join(root, "models.json"),
      JSON.stringify({
        providers: {
          envcode: {
            baseUrl: "https://api.example.com/v1",
            api: "openai-completions",
            apiKey: "$ENV_CODE_KEY",
            models: [{ id: "m1" }],
          },
        },
      }),
    );
    const probe = vi.fn().mockResolvedValue({ status: "ok" });

    await testPiModel(
      root,
      { providerId: "envcode", modelId: "m1" },
      new AbortController().signal,
      { probe, environment: { ENV_CODE_KEY: "env-secret" } },
    );
    expect(probe.mock.calls[0][0]).toMatchObject({
      protocol: "openai-chat",
      credential: "env-secret",
    });
    await expect(
      testPiModel(
        root,
        { providerId: "missing", modelId: "m1" },
        new AbortController().signal,
        { probe },
      ),
    ).rejects.toThrow("AGENT_PI_PROVIDER_NOT_FOUND");
    await expect(
      testPiModel(
        root,
        { providerId: "envcode", modelId: "missing" },
        new AbortController().signal,
        { probe },
      ),
    ).rejects.toThrow("AGENT_PI_MODEL_NOT_FOUND");
  });
});
