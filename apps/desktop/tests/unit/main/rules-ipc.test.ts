/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const handleMock = vi.fn();
const listCachedRuleDescriptorsMock = vi.fn();
const listRuleDescriptorsMock = vi.fn();
const scanRuleDescriptorsMock = vi.fn();
const readRuleContentMock = vi.fn();
const saveRuleContentMock = vi.fn();
const resolveRuleConflictMock = vi.fn();
const createProjectRuleMock = vi.fn();
const removeProjectRuleMock = vi.fn();
const removeMissingProjectRulesMock = vi.fn();
const importRuleBackupRecordsMock = vi.fn();
const rewriteRuleWithAiMock = vi.fn();

vi.mock("electron", () => ({
  ipcMain: {
    handle: handleMock,
  },
}));

vi.mock("../../../src/main/services/rules-workspace", () => ({
  listCachedRuleDescriptors: listCachedRuleDescriptorsMock,
  listRuleDescriptors: listRuleDescriptorsMock,
  scanRuleDescriptors: scanRuleDescriptorsMock,
  readRuleContent: readRuleContentMock,
  saveRuleContent: saveRuleContentMock,
  resolveRuleConflict: resolveRuleConflictMock,
  createProjectRule: createProjectRuleMock,
  removeProjectRule: removeProjectRuleMock,
  removeMissingProjectRules: removeMissingProjectRulesMock,
  importRuleBackupRecords: importRuleBackupRecordsMock,
}));

vi.mock("@prompthub/core", () => ({
  rewriteRuleWithAi: rewriteRuleWithAiMock,
}));

type RegisteredHandlers = Record<string, (...args: unknown[]) => Promise<unknown>>;

async function setupRulesIpc() {
  vi.resetModules();
  handleMock.mockReset();

  const [{ registerRulesIPC }, { IPC_CHANNELS }] = await Promise.all([
    import("../../../src/main/ipc/rules.ipc"),
    import("@prompthub/shared/constants/ipc-channels"),
  ]);

  registerRulesIPC();

  const handlers = Object.fromEntries(
    handleMock.mock.calls.map(([channel, handler]) => [channel, handler]),
  ) as RegisteredHandlers;

  return { handlers, IPC_CHANNELS };
}

describe("rules IPC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCachedRuleDescriptorsMock.mockReset();
    listRuleDescriptorsMock.mockReset();
    scanRuleDescriptorsMock.mockReset();
    readRuleContentMock.mockReset();
    saveRuleContentMock.mockReset();
    resolveRuleConflictMock.mockReset();
    createProjectRuleMock.mockReset();
    removeProjectRuleMock.mockReset();
    removeMissingProjectRulesMock.mockReset();
    importRuleBackupRecordsMock.mockReset();
    rewriteRuleWithAiMock.mockReset();
  });

  it("registers list/read/save handlers and forwards valid payloads", async () => {
    listCachedRuleDescriptorsMock.mockResolvedValue([
      { id: "claude-global", platformId: "claude", path: "/tmp/CLAUDE.md" },
    ]);
    scanRuleDescriptorsMock.mockResolvedValue([
      { id: "claude-global", platformId: "claude", path: "/tmp/CLAUDE.md" },
    ]);
    readRuleContentMock.mockResolvedValue({ id: "claude-global", content: "# Claude" });
    saveRuleContentMock.mockResolvedValue({ id: "claude-global", content: "# Saved" });

    const { handlers, IPC_CHANNELS } = await setupRulesIpc();

    await expect(handlers[IPC_CHANNELS.RULES_LIST](null)).resolves.toEqual([
      expect.objectContaining({ id: "claude-global" }),
    ]);
    await expect(handlers[IPC_CHANNELS.RULES_SCAN](null)).resolves.toEqual([
      expect.objectContaining({ id: "claude-global" }),
    ]);
    await expect(handlers[IPC_CHANNELS.RULES_READ](null, "claude-global")).resolves.toEqual(
      expect.objectContaining({ content: "# Claude" }),
    );
    await expect(handlers[IPC_CHANNELS.RULES_SAVE](null, "claude-global", "# Saved")).resolves.toEqual(
      expect.objectContaining({ content: "# Saved" }),
    );

    expect(readRuleContentMock).toHaveBeenCalledWith("claude-global");
    expect(saveRuleContentMock).toHaveBeenCalledWith("claude-global", "# Saved");
    expect(listCachedRuleDescriptorsMock).toHaveBeenCalledTimes(1);
    expect(scanRuleDescriptorsMock).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid save, rewrite, addProject, removeProject, and import payloads", async () => {
    const { handlers, IPC_CHANNELS } = await setupRulesIpc();

    await expect(
      handlers[IPC_CHANNELS.RULES_SAVE](null, "claude-global", 123),
    ).rejects.toThrow("rules:save requires a string content");

    await expect(
      handlers[IPC_CHANNELS.RULES_REWRITE](null, { instruction: 123 }),
    ).rejects.toThrow("rules:rewrite requires an instruction payload");

    await expect(
      handlers[IPC_CHANNELS.RULES_ADD_PROJECT](null, { name: "Docs" }),
    ).rejects.toThrow("rules:addProject requires name and rootPath");

    await expect(
      handlers[IPC_CHANNELS.RULES_REMOVE_PROJECT](null, ""),
    ).rejects.toThrow("rules:removeProject requires a project id");

    await expect(
      handlers[IPC_CHANNELS.RULES_IMPORT_RECORDS](null, { bad: true }),
    ).rejects.toThrow("rules:importRecords requires an array payload");

    await expect(
      handlers[IPC_CHANNELS.RULES_RESOLVE_CONFLICT](null, "", "use-target"),
    ).rejects.toThrow("rules:resolveConflict requires a ruleId");

    await expect(
      handlers[IPC_CHANNELS.RULES_RESOLVE_CONFLICT](null, "claude-global", "bad"),
    ).rejects.toThrow("rules:resolveConflict requires a valid strategy");
  });

  it("resolves rule conflicts through workspace services", async () => {
    resolveRuleConflictMock.mockResolvedValue({
      id: "project:docs-site",
      content: "# External",
      syncStatus: "synced",
    });
    const { handlers, IPC_CHANNELS } = await setupRulesIpc();

    await expect(
      handlers[IPC_CHANNELS.RULES_RESOLVE_CONFLICT](
        null,
        "project:docs-site",
        "use-target",
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        id: "project:docs-site",
        syncStatus: "synced",
      }),
    );

    expect(resolveRuleConflictMock).toHaveBeenCalledWith(
      "project:docs-site",
      "use-target",
    );
  });

  it("creates and removes project rules through workspace services", async () => {
    createProjectRuleMock.mockResolvedValue({ id: "project:docs-site", platformName: "Docs Site" });
    removeProjectRuleMock.mockResolvedValue(undefined);

    const { handlers, IPC_CHANNELS } = await setupRulesIpc();

    await expect(
      handlers[IPC_CHANNELS.RULES_ADD_PROJECT](null, {
        id: "docs-site",
        name: "Docs Site",
        rootPath: "/tmp/docs-site",
      }),
    ).resolves.toEqual(expect.objectContaining({ id: "project:docs-site" }));

    await expect(
      handlers[IPC_CHANNELS.RULES_REMOVE_PROJECT](null, "docs-site"),
    ).resolves.toEqual({ success: true });

    expect(createProjectRuleMock).toHaveBeenCalledWith({
      id: "docs-site",
      name: "Docs Site",
      rootPath: "/tmp/docs-site",
    });
    expect(removeProjectRuleMock).toHaveBeenCalledWith("docs-site");
  });

  it("validates and removes missing project rules through workspace services", async () => {
    removeMissingProjectRulesMock.mockResolvedValue({
      removed: ["project:missing"],
      skipped: [],
      failed: [],
    });
    const { handlers, IPC_CHANNELS } = await setupRulesIpc();

    await expect(
      handlers[IPC_CHANNELS.RULES_REMOVE_MISSING_PROJECTS](
        null,
        "project:missing",
      ),
    ).rejects.toThrow("rules:removeMissingProjects requires string ids");
    await expect(
      handlers[IPC_CHANNELS.RULES_REMOVE_MISSING_PROJECTS](
        null,
        ["project:missing", 42],
      ),
    ).rejects.toThrow("rules:removeMissingProjects requires string ids");
    await expect(
      handlers[IPC_CHANNELS.RULES_REMOVE_MISSING_PROJECTS](
        null,
        ["project:missing"],
      ),
    ).resolves.toEqual({
      removed: ["project:missing"],
      skipped: [],
      failed: [],
    });
    expect(removeMissingProjectRulesMock).toHaveBeenCalledWith([
      "project:missing",
    ]);
  });

  it("imports backup records through workspace services", async () => {
    importRuleBackupRecordsMock.mockResolvedValue(undefined);
    const { handlers, IPC_CHANNELS } = await setupRulesIpc();

    const records = [
      {
        id: "gemini-global",
        platformId: "gemini",
        platformName: "Gemini CLI",
        platformIcon: "gemini",
        platformDescription: "Gemini rules",
        name: "GEMINI.md",
        description: "Gemini global rule file",
        path: "/Users/test/.gemini/GEMINI.md",
        content: "# Gemini rules",
        versions: [],
      },
    ];

    await expect(
      handlers[IPC_CHANNELS.RULES_IMPORT_RECORDS](null, records, { replace: true }),
    ).resolves.toEqual({ success: true });

    expect(importRuleBackupRecordsMock).toHaveBeenCalledWith(records, { replace: true });
  });

  it("rewrites rules through AI when a valid payload is provided", async () => {
    rewriteRuleWithAiMock.mockResolvedValue({
      content: "# Rewritten rule",
      summary: "AI rewrite generated a new draft.",
    });
    const { handlers, IPC_CHANNELS } = await setupRulesIpc();

    await expect(
      handlers[IPC_CHANNELS.RULES_REWRITE](null, {
        instruction: "Tighten the wording",
        currentContent: "# Old rule",
        fileName: "CLAUDE.md",
        platformName: "Claude Code",
        aiConfig: {
          apiKey: "test-key",
          apiUrl: "https://api.openai.com/v1",
          model: "gpt-4o-mini",
          provider: "openai",
        },
      }),
    ).resolves.toEqual({
      content: "# Rewritten rule",
      summary: "AI rewrite generated a new draft.",
    });

    expect(rewriteRuleWithAiMock).toHaveBeenCalledWith(
      expect.objectContaining({
        instruction: "Tighten the wording",
        currentContent: "# Old rule",
        fileName: "CLAUDE.md",
        platformName: "Claude Code",
        aiConfig: expect.objectContaining({
          apiKey: "test-key",
          apiUrl: "https://api.openai.com/v1",
          model: "gpt-4o-mini",
          provider: "openai",
        }),
      }),
    );
  });
});
