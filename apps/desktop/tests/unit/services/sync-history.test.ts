import { beforeEach, describe, expect, it, vi } from "vitest";

import { installWindowMocks } from "../../helpers/window";
import {
  AUTO_SYNC_HISTORY_LIMIT,
  normalizeAutoSyncHistory,
  recordAutoSyncHistory,
} from "../../../src/renderer/services/sync-history";

describe("sync-history", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("normalizes only valid automatic sync history entries", () => {
    const history = normalizeAutoSyncHistory([
      {
        id: "ok",
        provider: "webdav",
        reason: "startup",
        status: "success",
        startedAt: "2026-07-01T00:00:00.000Z",
        finishedAt: "2026-07-01T00:00:01.000Z",
        message: "synced",
        localChanged: true,
      },
      {
        provider: "manual",
        reason: "startup",
        status: "success",
        startedAt: "2026-07-01T00:00:00.000Z",
        finishedAt: "2026-07-01T00:00:01.000Z",
        message: "invalid provider",
      },
      null,
      "bad",
    ]);

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      id: "ok",
      provider: "webdav",
      reason: "startup",
      status: "success",
      message: "synced",
      localChanged: true,
    });
  });

  it("records a bounded sanitized automatic sync history entry", async () => {
    const setSettings = vi.fn().mockResolvedValue(undefined);
    const appendAutoSyncLog = vi.fn().mockResolvedValue({ success: true });
    const existing = Array.from(
      { length: AUTO_SYNC_HISTORY_LIMIT },
      (_, index) => ({
        id: `old-${index}`,
        provider: "s3",
        reason: "interval",
        status: "success",
        startedAt: "2026-07-01T00:00:00.000Z",
        finishedAt: "2026-07-01T00:00:01.000Z",
        message: `old ${index}`,
      }),
    );
    installWindowMocks({
      api: {
        settings: {
          get: vi.fn().mockResolvedValue({ autoSyncHistory: existing }),
          set: setSettings,
        },
      },
      electron: {
        appendAutoSyncLog,
      },
    });

    const entry = await recordAutoSyncHistory({
      provider: "self-hosted",
      reason: "startup-resume",
      status: "failed",
      message:
        "Failed to reach https://example.com/sync/data for owner@example.com",
    });

    expect(entry?.message).toBe("Failed to reach [url] for [email]");
    expect(setSettings).toHaveBeenCalledTimes(1);
    const payload = setSettings.mock.calls[0][0] as {
      autoSyncHistory: Array<{ message: string }>;
    };
    expect(payload.autoSyncHistory).toHaveLength(AUTO_SYNC_HISTORY_LIMIT);
    expect(payload.autoSyncHistory[0].message).toBe(
      "Failed to reach [url] for [email]",
    );
    expect(payload.autoSyncHistory.at(-1)?.message).toBe("old 18");
    expect(appendAutoSyncLog).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "self-hosted",
        reason: "startup-resume",
        status: "failed",
        message: "Failed to reach [url] for [email]",
      }),
    );
  });
});
