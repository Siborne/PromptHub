import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportDatabase } from "../../../src/renderer/services/database-backup";
import { installWindowMocks } from "../../helpers/window";

const getDatabaseMock = vi.fn();

vi.mock("../../../src/renderer/services/database", () => ({
  getAllFolders: vi.fn().mockResolvedValue([]),
  getAllPrompts: vi.fn().mockResolvedValue([]),
  getDatabase: () => getDatabaseMock(),
  listOutputFormatItems: vi.fn().mockResolvedValue([]),
  listPromptRelations: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../src/renderer/services/settings-snapshot", () => ({
  getAiConfigSnapshot: vi.fn(),
  getSettingsStateSnapshot: vi.fn(),
  SENSITIVE_SETTINGS_FIELDS: [
    "webdavPassword",
    "s3SecretAccessKey",
    "aiApiKey",
  ],
}));

function createEmptyTransaction() {
  const transaction: {
    error: null;
    objectStore: () => {
      getAll: () => {
        result: unknown[];
        onsuccess: (() => void) | null;
        onerror: (() => void) | null;
      };
    };
    oncomplete: (() => void) | null;
    onerror: (() => void) | null;
  } = {
    error: null,
    objectStore: () => ({
      getAll: () => {
        const request = {
          result: [],
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null,
        };
        queueMicrotask(() => request.onsuccess?.());
        return request;
      },
    }),
    oncomplete: null,
    onerror: null,
  };
  queueMicrotask(() => transaction.oncomplete?.());
  return transaction;
}

describe("database backup Agent runtime exclusions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    getDatabaseMock.mockResolvedValue({
      transaction: () => createEmptyTransaction(),
    });
    installWindowMocks();
  });

  it("keeps Qwen runtime sessions and transcripts out of ordinary backups", async () => {
    const backup = await exportDatabase();

    expect(window.api.agent.listSessions).not.toHaveBeenCalled();
    expect(window.api.agent.readSession).not.toHaveBeenCalled();
    expect(JSON.stringify(backup)).not.toMatch(
      /qwenRuntime|sessionTranscript|team-memory|mcp-oauth-tokens/,
    );
  });
});
