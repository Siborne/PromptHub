import { describe, expect, it } from "vitest";
import { parseSelfHostedBackupSnapshot } from "./self-hosted-backup-snapshot.js";

function createSnapshot() {
  return {
    version: "desktop-backup-v1",
    exportedAt: "2026-07-16T00:00:00.000Z",
    prompts: [],
    promptVersions: [],
    folders: [],
    skills: [],
    skillVersions: [],
  };
}

describe("parseSelfHostedBackupSnapshot", () => {
  it.each([null, [], "snapshot"])(
    "rejects non-object backup payloads: %j",
    (payload) => {
      expect(() => parseSelfHostedBackupSnapshot(payload)).toThrow(
        "expected an object",
      );
    },
  );

  it("reports the invalid desktop extras path", () => {
    expect(() =>
      parseSelfHostedBackupSnapshot({
        ...createSnapshot(),
        desktopSettings: { state: [] },
      }),
    ).toThrow(/desktopSettings\.state/);
  });

  it("preserves portable settings and nested model definitions", () => {
    const snapshot = parseSelfHostedBackupSnapshot({
      ...createSnapshot(),
      desktopSettings: {
        state: {
          language: "zh",
          recentPages: ["skills", "prompts"],
          nested: { enabled: true, count: 2 },
        },
      },
      desktopAiConfig: {
        aiProviders: [
          null,
          "local",
          { id: "provider-1", apiUrl: "https://api.example.com" },
        ],
      },
    });

    expect(snapshot.desktopSettings?.state).toMatchObject({ language: "zh" });
    expect(snapshot.desktopAiConfig?.aiProviders).toHaveLength(3);
  });

  it.each([
    ["object", { nested: { accessKeyId: "secret" } }, "accessKeyId"],
    [
      "array",
      { providers: [{ id: "safe" }, { api_key: "secret" }] },
      "providers.1.api_key",
    ],
  ])("rejects credential fields nested in %s values", (_label, value, path) => {
    expect(() =>
      parseSelfHostedBackupSnapshot({
        ...createSnapshot(),
        desktopAiConfig: value,
      }),
    ).toThrow(String(path));
  });

  it("accepts a portable snapshot without desktop-only extras", () => {
    expect(parseSelfHostedBackupSnapshot(createSnapshot())).toMatchObject({
      version: "desktop-backup-v1",
      prompts: [],
      skills: [],
    });
  });
});
