import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  inspectAgentModelConfig,
  updateAgentModelConfig,
} from "../../../src/main/services/agent-model-config";

const temporaryRoots: string[] = [];

async function createRoot(): Promise<string> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "prompthub-agent-model-"),
  );
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

describe("Agent model configuration adapters", () => {
  it("reports Qwen's verified adapter even before settings.json exists", async () => {
    const root = await createRoot();

    await expect(
      inspectAgentModelConfig({ agentId: "qwen", rootPath: root }),
    ).resolves.toMatchObject({
      adapter: "qwen-settings-v1",
      status: "missing",
      sourceRelativePath: "settings.json",
      canSetModel: true,
    });
  });

  it("inspects and updates Qwen settings without exposing provider secrets", async () => {
    const root = await createRoot();
    const backupRoot = path.join(root, "backups");
    await fs.writeFile(
      path.join(root, "settings.json"),
      JSON.stringify({
        model: { name: "qwen3-coder-plus", maxSessionTurns: 50 },
        security: { auth: { selectedType: "openai" } },
        modelProviders: {
          openai: [
            {
              id: "qwen3-coder-plus",
              name: "Qwen Coder",
              baseUrl:
                "https://account:password@dashscope.example/v1?token=secret",
              envKey: "DASHSCOPE_API_KEY",
            },
          ],
        },
        env: { DASHSCOPE_API_KEY: "qwen-secret" },
        mcpServers: {
          internal: { headers: { Authorization: "Bearer mcp-secret" } },
        },
        ui: { theme: "GitHub" },
      }),
    );

    const before = await inspectAgentModelConfig({
      agentId: "qwen",
      rootPath: root,
    });
    expect(before).toMatchObject({
      adapter: "qwen-settings-v1",
      status: "configured",
      model: "qwen3-coder-plus",
      provider: "openai",
      endpoint: "https://dashscope.example/v1",
      availableModels: ["qwen3-coder-plus"],
      credentialStatus: "configured",
      sourceRelativePath: "settings.json",
      canSetModel: true,
    });
    expect(JSON.stringify(before)).not.toMatch(
      /qwen-secret|mcp-secret|password|token=secret/,
    );

    const result = await updateAgentModelConfig(
      { agentId: "qwen", rootPath: root, model: "qwen3-coder-next" },
      { backupRoot },
    );
    const saved = JSON.parse(
      await fs.readFile(path.join(root, "settings.json"), "utf8"),
    );
    expect(result.model).toBe("qwen3-coder-next");
    expect(result.backupPath).toMatch(/settings\.json$/);
    expect(saved).toMatchObject({
      model: { name: "qwen3-coder-next", maxSessionTurns: 50 },
      env: { DASHSCOPE_API_KEY: "qwen-secret" },
      mcpServers: {
        internal: { headers: { Authorization: "Bearer mcp-secret" } },
      },
      ui: { theme: "GitHub" },
    });
  });

  it("inspects and updates Claude without exposing or overwriting credentials", async () => {
    const root = await createRoot();
    const backupRoot = path.join(root, "backups");
    await fs.writeFile(
      path.join(root, "settings.json"),
      JSON.stringify({
        model: "sonnet",
        availableModels: ["sonnet", "haiku"],
        env: {
          ANTHROPIC_BASE_URL:
            "https://account:password@gateway.example.com/v1?token=query-secret",
          ANTHROPIC_AUTH_TOKEN: "claude-secret",
        },
        permissions: { allow: ["Read"] },
      }),
    );

    const before = await inspectAgentModelConfig({
      agentId: "claude",
      rootPath: root,
    });
    expect(before).toMatchObject({
      status: "configured",
      model: "sonnet",
      provider: "custom-gateway",
      endpoint: "https://gateway.example.com/v1",
      availableModels: ["sonnet", "haiku"],
      credentialStatus: "configured",
      canSetModel: true,
    });
    expect(JSON.stringify(before)).not.toContain("claude-secret");
    expect(JSON.stringify(before)).not.toContain("query-secret");
    expect(JSON.stringify(before)).not.toContain("password");

    const result = await updateAgentModelConfig(
      { agentId: "claude", rootPath: root, model: "haiku" },
      { backupRoot },
    );
    const saved = JSON.parse(
      await fs.readFile(path.join(root, "settings.json"), "utf8"),
    );

    expect(result.model).toBe("haiku");
    expect(result.backupPath).toMatch(/settings\.json$/);
    expect(saved).toMatchObject({
      model: "haiku",
      env: { ANTHROPIC_AUTH_TOKEN: "claude-secret" },
      permissions: { allow: ["Read"] },
    });
  });

  it("supports Gemini, OpenCode JSONC and OpenClaw model fields", async () => {
    const geminiRoot = await createRoot();
    await fs.writeFile(
      path.join(geminiRoot, "settings.json"),
      JSON.stringify({
        model: { name: "gemini-3-pro-preview", maxSessionTurns: 50 },
        security: { auth: { selectedType: "oauth-personal" } },
      }),
    );
    const gemini = await inspectAgentModelConfig({
      agentId: "gemini",
      rootPath: geminiRoot,
    });
    expect(gemini).toMatchObject({
      model: "gemini-3-pro-preview",
      provider: "google",
      credentialStatus: "platform-managed",
    });

    const openCodeRoot = await createRoot();
    await fs.writeFile(
      path.join(openCodeRoot, "opencode.jsonc"),
      `{
        // Keep this comment and unrelated setting.
        "model": "anthropic/claude-sonnet-4-6",
        "small_model": "anthropic/claude-haiku-4-5",
        "share": "disabled",
      }\n`,
    );
    const openCode = await updateAgentModelConfig(
      {
        agentId: "opencode",
        rootPath: openCodeRoot,
        model: "openai/gpt-5.4",
        secondaryModel: "openai/gpt-5.4-mini",
      },
      { backupRoot: path.join(openCodeRoot, "backups") },
    );
    const openCodeRaw = await fs.readFile(
      path.join(openCodeRoot, "opencode.jsonc"),
      "utf8",
    );
    expect(openCode).toMatchObject({
      model: "openai/gpt-5.4",
      secondaryModel: "openai/gpt-5.4-mini",
      provider: "openai",
    });
    expect(openCodeRaw).toContain("Keep this comment");
    expect(openCodeRaw).toContain('"share": "disabled"');

    const openClawRoot = await createRoot();
    await fs.writeFile(
      path.join(openClawRoot, "openclaw.json"),
      JSON.stringify({
        agents: {
          defaults: {
            model: {
              primary: "anthropic/claude-sonnet-4-6",
              fallbacks: ["openai/gpt-5.4"],
            },
          },
        },
      }),
    );
    const openClaw = await inspectAgentModelConfig({
      agentId: "openclaw",
      rootPath: openClawRoot,
    });
    expect(openClaw).toMatchObject({
      model: "anthropic/claude-sonnet-4-6",
      fallbackModels: ["openai/gpt-5.4"],
      provider: "anthropic",
    });
  });

  it("parses and safely rewrites Codex TOML while preserving semantic fields", async () => {
    const root = await createRoot();
    await fs.writeFile(
      path.join(root, "config.toml"),
      [
        'model = "gpt-5.4"',
        'model_provider = "work"',
        'model_reasoning_effort = "high"',
        "",
        "[model_providers.work]",
        'name = "Work Gateway"',
        'base_url = "https://gateway.example.com/v1"',
        'wire_api = "responses"',
        "",
      ].join("\n"),
    );

    const before = await inspectAgentModelConfig({
      agentId: "codex",
      rootPath: root,
    });
    expect(before).toMatchObject({
      model: "gpt-5.4",
      provider: "work",
      endpoint: "https://gateway.example.com/v1",
      formattingMayChange: true,
    });

    await updateAgentModelConfig(
      { agentId: "codex", rootPath: root, model: "gpt-5.5" },
      { backupRoot: path.join(root, "backups") },
    );
    const after = await inspectAgentModelConfig({
      agentId: "codex",
      rootPath: root,
    });
    expect(after.model).toBe("gpt-5.5");
    expect(after.provider).toBe("work");
    expect(after.endpoint).toBe("https://gateway.example.com/v1");
  });

  it("inspects and updates current Kimi Code TOML without exposing provider secrets", async () => {
    const root = await createRoot();
    const backupRoot = path.join(root, "backups");
    const validateNativeConfig = vi.fn().mockResolvedValue(undefined);
    await fs.writeFile(
      path.join(root, "config.toml"),
      [
        'default_model = "kimi-code/kimi-for-coding"',
        'default_permission_mode = "manual"',
        "",
        '[providers."managed:kimi-code"]',
        'type = "kimi"',
        'base_url = "https://account:password@api.kimi.com/coding/v1?token=query-secret"',
        'api_key = "kimi-secret"',
        "",
        '[models."kimi-code/kimi-for-coding"]',
        'provider = "managed:kimi-code"',
        'model = "kimi-for-coding"',
        "max_context_size = 262144",
        "",
        '[models."anthropic/claude-sonnet"]',
        'provider = "anthropic"',
        'model = "claude-sonnet"',
        "",
      ].join("\n"),
    );

    const before = await inspectAgentModelConfig({
      agentId: "kimi",
      rootPath: root,
    });
    expect(before).toMatchObject({
      status: "configured",
      model: "kimi-code/kimi-for-coding",
      provider: "managed:kimi-code",
      endpoint: "https://api.kimi.com/coding/v1",
      availableModels: ["kimi-code/kimi-for-coding", "anthropic/claude-sonnet"],
      credentialStatus: "configured",
      sourceRelativePath: "config.toml",
      canSetModel: true,
      formattingMayChange: true,
    });
    expect(JSON.stringify(before)).not.toContain("kimi-secret");
    expect(JSON.stringify(before)).not.toContain("query-secret");
    expect(JSON.stringify(before)).not.toContain("password");

    const result = await updateAgentModelConfig(
      {
        agentId: "kimi",
        rootPath: root,
        model: "anthropic/claude-sonnet",
      },
      { backupRoot, validateNativeConfig },
    );
    expect(result.model).toBe("anthropic/claude-sonnet");
    expect(result.provider).toBe("anthropic");
    expect(result.backupPath).toMatch(/config\.toml$/);
    expect(validateNativeConfig).toHaveBeenCalledWith(
      "kimi",
      path.join(root, "config.toml"),
    );

    const saved = await fs.readFile(path.join(root, "config.toml"), "utf8");
    expect(saved).toContain('default_model = "anthropic/claude-sonnet"');
    expect(saved).toContain('default_permission_mode = "manual"');
    expect(saved).toContain('api_key = "kimi-secret"');
  });

  it("restores Kimi Code TOML when native validation fails", async () => {
    const root = await createRoot();
    const configPath = path.join(root, "config.toml");
    const original = [
      'default_model = "kimi-code/kimi-for-coding"',
      "",
      '[models."kimi-code/kimi-for-coding"]',
      'provider = "managed:kimi-code"',
      'model = "kimi-for-coding"',
      "",
    ].join("\n");
    await fs.writeFile(configPath, original);

    await expect(
      updateAgentModelConfig(
        {
          agentId: "kimi",
          rootPath: root,
          model: "anthropic/claude-sonnet",
        },
        {
          backupRoot: path.join(root, "backups"),
          validateNativeConfig: vi
            .fn()
            .mockRejectedValue(new Error("doctor rejected config")),
        },
      ),
    ).rejects.toThrow("AGENT_MODEL_CONFIG_UPDATE_FAILED");
    expect(await fs.readFile(configPath, "utf8")).toBe(original);
  });

  it("reports missing, unsupported and malformed configurations without leaking content", async () => {
    const root = await createRoot();
    await fs.writeFile(
      path.join(root, "settings.json"),
      "{ broken secret-value",
    );

    const malformed = await inspectAgentModelConfig({
      agentId: "claude",
      rootPath: root,
    });
    expect(malformed.status).toBe("invalid");
    expect(JSON.stringify(malformed)).not.toContain("secret-value");

    await expect(
      updateAgentModelConfig(
        { agentId: "claude", rootPath: root, model: "" },
        { backupRoot: path.join(root, "backups") },
      ),
    ).rejects.toThrow("AGENT_MODEL_CONFIG_MODEL_INVALID");

    await expect(
      updateAgentModelConfig(
        { agentId: "claude", rootPath: root, model: "bad\nmodel" },
        { backupRoot: path.join(root, "backups") },
      ),
    ).rejects.toThrow("AGENT_MODEL_CONFIG_MODEL_INVALID");

    await expect(
      inspectAgentModelConfig({ agentId: "cursor", rootPath: root }),
    ).resolves.toMatchObject({ status: "unsupported", canSetModel: false });
  });

  it("creates a missing declared config and returns stable errors for invalid TOML", async () => {
    const claudeRoot = await createRoot();
    const created = await updateAgentModelConfig(
      { agentId: "claude", rootPath: claudeRoot, model: "sonnet" },
      { backupRoot: path.join(claudeRoot, "backups") },
    );

    expect(created).toMatchObject({
      status: "configured",
      model: "sonnet",
      backupPath: null,
    });
    expect(
      JSON.parse(
        await fs.readFile(path.join(claudeRoot, "settings.json"), "utf8"),
      ),
    ).toEqual({ model: "sonnet" });

    const codexRoot = await createRoot();
    await fs.writeFile(
      path.join(codexRoot, "config.toml"),
      'model = "secret-value\n',
    );
    await expect(
      updateAgentModelConfig(
        { agentId: "codex", rootPath: codexRoot, model: "gpt-5.5" },
        { backupRoot: path.join(codexRoot, "backups") },
      ),
    ).rejects.toThrow("AGENT_MODEL_CONFIG_INVALID");
  });
});
