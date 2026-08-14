import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createAgentDeepSeekHarnessService } from "../../../src/main/services/agent-deepseek-harness-service";

const roots: string[] = [];

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "prompthub-dsh-"));
  roots.push(root);
  return root;
}

async function putJson(
  root: string,
  relativePath: string,
  value: unknown,
): Promise<void> {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(value), "utf8");
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("DeepSeek Harness profile plugin service", () => {
  it("projects bounded profile and plugin metadata without script bodies", async () => {
    const root = await makeRoot();
    await putJson(root, "profiles/web/package.json", {
      name: "dsh-profile-web",
      dependencies: { "@demo/search": "1.2.3" },
      dsh: {
        profile: {
          bundles: ["@deepseek-ai/dsh-base", "@demo/search"],
        },
      },
    });
    await putJson(root, "profiles/web/node_modules/@demo/search/package.json", {
      name: "@demo/search",
      version: "1.2.3",
      description: "Search tools",
      license: "MIT",
      repository: { url: "https://github.com/demo/search.git" },
      scripts: { prepare: "echo secret-value", test: "vitest" },
      dsh: {
        bundle: { patch: "./cordis.patch.yml" },
        client: { platform: "web" },
      },
    });

    const service = createAgentDeepSeekHarnessService({
      rootPath: root,
      commandRunner: {
        resolve: vi.fn().mockResolvedValue("/usr/local/bin/dsh"),
        run: vi.fn(),
      },
    });

    await expect(service.listProfiles()).resolves.toMatchObject({
      agentId: "deepseek-harness",
      cliAvailable: true,
      profiles: [
        {
          name: "web",
          status: "valid",
          bundleCount: 2,
          dependencyCount: 1,
        },
      ],
    });
    const profile = await service.readProfile("web");

    expect(profile.plugins).toEqual([
      expect.objectContaining({
        name: "@deepseek-ai/dsh-base",
        enabled: true,
        directDependency: false,
        status: "missing",
      }),
      expect.objectContaining({
        name: "@demo/search",
        version: "1.2.3",
        enabled: true,
        directDependency: true,
        status: "installed",
        bundlePatch: "./cordis.patch.yml",
        clientPlatform: "web",
        lifecycleScripts: ["prepare"],
      }),
    ]);
    expect(JSON.stringify(profile)).not.toContain("secret-value");
  });

  it("keeps unsafe profiles, oversized manifests, and escaping packages out of the readable inventory", async () => {
    const root = await makeRoot();
    const outside = await makeRoot();
    await putJson(root, "profiles/good/package.json", {
      dependencies: { escaped: "1.0.0" },
      dsh: { profile: { bundles: ["escaped"] } },
    });
    await putJson(outside, "escaped/package.json", {
      name: "escaped",
      version: "1.0.0",
    });
    await mkdir(path.join(root, "profiles/good/node_modules"), {
      recursive: true,
    });
    await symlink(
      path.join(outside, "escaped"),
      path.join(root, "profiles/good/node_modules/escaped"),
      "dir",
    );
    await mkdir(path.join(root, "profiles/large"), { recursive: true });
    await writeFile(
      path.join(root, "profiles/large/package.json"),
      `{"padding":"${"x".repeat(1_100_000)}"}`,
      "utf8",
    );
    await symlink(outside, path.join(root, "profiles/linked"), "dir");

    const service = createAgentDeepSeekHarnessService({
      rootPath: root,
      commandRunner: {
        resolve: vi.fn().mockResolvedValue(null),
        run: vi.fn(),
      },
    });
    const overview = await service.listProfiles();

    expect(overview.profiles.map((profile) => profile.name)).toEqual([
      "good",
      "large",
    ]);
    expect(overview.profiles[1].status).toBe("oversized");
    await expect(service.readProfile("good")).resolves.toMatchObject({
      plugins: [
        expect.objectContaining({ name: "escaped", status: "missing" }),
      ],
    });
    await expect(service.readProfile("../outside")).rejects.toThrow(
      "DSH_PROFILE_NAME_INVALID",
    );
  });

  it("delegates acknowledged mutations to exact shell-free dsh plugin commands and serializes one profile", async () => {
    const root = await makeRoot();
    await putJson(root, "profiles/web/package.json", {
      dependencies: { "@demo/search": "1.2.3" },
      dsh: { profile: { bundles: ["@demo/search"] } },
    });
    await putJson(root, "profiles/web/node_modules/@demo/search/package.json", {
      name: "@demo/search",
      version: "1.2.3",
      dsh: { bundle: {} },
    });
    let active = 0;
    let maxActive = 0;
    const run = vi.fn(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return { stdout: "ignored secret", stderr: "ignored path" };
    });
    const service = createAgentDeepSeekHarnessService({
      rootPath: root,
      commandRunner: {
        resolve: vi.fn().mockResolvedValue("/usr/local/bin/dsh"),
        run,
      },
    });

    await expect(
      service.mutatePlugin({
        agentId: "deepseek-harness",
        operation: "install",
        profileName: "new-profile",
        packageSpec: "github:demo/plugin",
        acknowledgeLifecycleScripts: false,
      }),
    ).resolves.toEqual({
      success: false,
      errorCode: "risk-acknowledgement-required",
    });

    await expect(
      service.mutatePlugin({
        agentId: "deepseek-harness",
        operation: "install",
        profileName: "web",
        packageSpec: "github:demo/plugin",
        acknowledgeLifecycleScripts: true,
      }),
    ).resolves.toMatchObject({ success: true });

    const mutations = await Promise.all([
      service.mutatePlugin({
        agentId: "deepseek-harness",
        operation: "update",
        profileName: "web",
        packageName: "@demo/search",
        acknowledgeLifecycleScripts: true,
      }),
      service.mutatePlugin({
        agentId: "deepseek-harness",
        operation: "remove",
        profileName: "web",
        packageName: "@demo/search",
        acknowledgeLifecycleScripts: true,
      }),
    ]);

    expect(mutations.every((result) => result.success)).toBe(true);
    expect(maxActive).toBe(1);
    expect(run).toHaveBeenNthCalledWith(
      1,
      "/usr/local/bin/dsh",
      ["plugin", "--profile", "web", "add", "github:demo/plugin"],
      expect.objectContaining({
        timeout: 120_000,
        maxBuffer: 131_072,
        env: expect.objectContaining({ DSH_HOME: root }),
      }),
    );
    expect(run).toHaveBeenNthCalledWith(
      2,
      "/usr/local/bin/dsh",
      ["plugin", "--profile", "web", "update", "@demo/search"],
      expect.objectContaining({
        timeout: 120_000,
        maxBuffer: 131_072,
        env: expect.objectContaining({ DSH_HOME: root }),
      }),
    );
    expect(run).toHaveBeenNthCalledWith(
      3,
      "/usr/local/bin/dsh",
      ["plugin", "--profile", "web", "remove", "@demo/search"],
      expect.any(Object),
    );
  });

  it("rejects unsafe sources and built-in bundle removal, then redacts command failures", async () => {
    const root = await makeRoot();
    await putJson(root, "profiles/web/package.json", {
      dependencies: {},
      dsh: { profile: { bundles: ["@deepseek-ai/dsh-base"] } },
    });
    const run = vi
      .fn()
      .mockRejectedValueOnce({ killed: true })
      .mockRejectedValueOnce({ code: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER" })
      .mockRejectedValueOnce(new Error("token=/secret/path"));
    const service = createAgentDeepSeekHarnessService({
      rootPath: root,
      commandRunner: {
        resolve: vi.fn().mockResolvedValue("/usr/local/bin/dsh"),
        run,
      },
    });

    await expect(
      service.mutatePlugin({
        agentId: "deepseek-harness",
        operation: "install",
        profileName: "web",
        packageSpec: "file:../../private",
        acknowledgeLifecycleScripts: true,
      }),
    ).resolves.toEqual({ success: false, errorCode: "package-spec-invalid" });
    await expect(
      service.mutatePlugin({
        agentId: "deepseek-harness",
        operation: "install",
        profileName: "web",
        packageSpec: "@demo/search@file:../../private",
        acknowledgeLifecycleScripts: true,
      }),
    ).resolves.toEqual({ success: false, errorCode: "package-spec-invalid" });
    await expect(
      service.mutatePlugin({
        agentId: "deepseek-harness",
        operation: "remove",
        profileName: "web",
        packageName: "@deepseek-ai/dsh-base",
        acknowledgeLifecycleScripts: true,
      }),
    ).resolves.toEqual({ success: false, errorCode: "plugin-not-managed" });
    await expect(
      service.mutatePlugin({
        agentId: "deepseek-harness",
        operation: "install",
        profileName: "web",
        packageSpec: "@demo/timeout@latest",
        acknowledgeLifecycleScripts: true,
      }),
    ).resolves.toEqual({ success: false, errorCode: "timeout" });
    await expect(
      service.mutatePlugin({
        agentId: "deepseek-harness",
        operation: "install",
        profileName: "web",
        packageSpec: "@demo/noisy@latest",
        acknowledgeLifecycleScripts: true,
      }),
    ).resolves.toEqual({ success: false, errorCode: "output-limit" });
    await expect(
      service.mutatePlugin({
        agentId: "deepseek-harness",
        operation: "install",
        profileName: "web",
        packageSpec: "@demo/failing@latest",
        acknowledgeLifecycleScripts: true,
      }),
    ).resolves.toEqual({ success: false, errorCode: "command-failed" });
    expect(JSON.stringify(await service.listProfiles())).not.toContain(
      "/secret/path",
    );
  });
});
