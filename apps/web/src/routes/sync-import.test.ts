import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DEFAULT_SETTINGS } from "@prompthub/shared";
import { buildRemotePayload } from "./sync.test-fixtures";
import {
  SYNC_ROUTE_TEST_TIMEOUT,
  authHeaders,
  createFolder,
  createPrompt,
  createSkill,
  createTestApp,
  ensureTestMediaDir,
  registerUser,
  setupSyncRouteTestLifecycle,
} from "./sync.test-helpers";

describe("web sync import merge and settings", () => {
  setupSyncRouteTestLifecycle();

  it(
    "keeps newer remote items while merging incoming desktop payload additions",
    async () => {
      const dataDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "prompthub-web-sync-merge-"),
      );

      try {
        const app = await createTestApp(dataDir);
        const { payload: registerPayload } = await registerUser(
          app,
          "mergeowner",
          "debugpass001",
        );
        const token = registerPayload.data.accessToken;

        const folderResponse = await createFolder(app, token, {
          name: "Remote Folder",
        });
        const folderBody = (await folderResponse.json()) as {
          data: { id: string };
        };
        const remoteFolderId = folderBody.data.id;

        const promptResponse = await createPrompt(app, token, {
          title: "Remote Newer Prompt",
          userPrompt: "remote newer",
          folderId: remoteFolderId,
        });
        expect(promptResponse.status).toBe(201);
        const promptBody = (await promptResponse.json()) as {
          data: { id: string };
        };

        const skillResponse = await createSkill(app, token, {
          name: "remote-newer-skill",
          content: "echo remote newer",
        });
        expect(skillResponse.status).toBe(201);
        const skillBody = (await skillResponse.json()) as {
          data: { id: string };
        };

        const importResponse = await app.request(
          new Request("http://local/api/sync/data", {
            method: "PUT",
            headers: authHeaders(token),
            body: JSON.stringify({
              payload: {
                version: "desktop-backup-v1",
                exportedAt: "2026-04-16T02:00:00.000Z",
                prompts: [
                  {
                    id: promptBody.data.id,
                    title: "Remote Older Prompt",
                    userPrompt: "desktop older",
                    variables: [],
                    tags: ["desktop"],
                    folderId: remoteFolderId,
                    isFavorite: false,
                    isPinned: false,
                    version: 1,
                    currentVersion: 1,
                    usageCount: 0,
                    createdAt: "2026-04-16T01:00:00.000Z",
                    updatedAt: "2026-04-16T01:00:00.000Z",
                  },
                  {
                    id: "desktop-added-prompt",
                    title: "Desktop Added Prompt",
                    userPrompt: "desktop new",
                    variables: [],
                    tags: ["desktop"],
                    folderId: remoteFolderId,
                    isFavorite: false,
                    isPinned: false,
                    version: 1,
                    currentVersion: 1,
                    usageCount: 0,
                    createdAt: "2026-04-16T02:00:00.000Z",
                    updatedAt: "2026-04-16T02:00:00.000Z",
                  },
                ],
                promptVersions: [],
                folders: [
                  {
                    id: remoteFolderId,
                    name: "Remote Folder Older Copy",
                    order: 0,
                    createdAt: "2026-04-16T01:00:00.000Z",
                    updatedAt: "2026-04-16T01:00:00.000Z",
                  },
                ],
                skills: [
                  {
                    id: skillBody.data.id,
                    name: "remote-newer-skill",
                    content: "echo desktop older",
                    instructions: "echo desktop older",
                    protocol_type: "skill",
                    is_favorite: false,
                    created_at: 1,
                    updated_at: 1,
                  },
                  {
                    id: "desktop-added-skill",
                    name: "desktop-added-skill",
                    content: "echo desktop new",
                    instructions: "echo desktop new",
                    protocol_type: "skill",
                    is_favorite: false,
                    created_at: 2,
                    updated_at: 2,
                  },
                ],
                skillVersions: [],
                settings: {
                  theme: "dark",
                  language: "en",
                  autoSave: true,
                  customPlatformRootPaths: {},
                  customSkillPlatformPaths: {},
                  sync: {
                    enabled: false,
                    provider: "manual",
                    autoSync: false,
                  },
                },
                settingsUpdatedAt: "2026-04-16T02:00:00.000Z",
              },
            }),
          }),
        );
        expect(importResponse.status).toBe(200);

        const dataResponse = await app.request(
          new Request("http://local/api/sync/data", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        );
        expect(dataResponse.status).toBe(200);
        const dataBody = (await dataResponse.json()) as {
          data: {
            prompts: Array<{ id: string; title: string; userPrompt: string }>;
            folders: Array<{ id: string; name: string }>;
            skills: Array<{ id: string; name: string; content?: string }>;
          };
        };

        expect(dataBody.data.prompts).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: promptBody.data.id,
              title: "Remote Newer Prompt",
              userPrompt: "remote newer",
            }),
            expect.objectContaining({
              id: "desktop-added-prompt",
              title: "Desktop Added Prompt",
            }),
          ]),
        );
        expect(dataBody.data.folders).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: remoteFolderId,
              name: "Remote Folder",
            }),
          ]),
        );
        expect(dataBody.data.skills).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: skillBody.data.id,
              name: "remote-newer-skill",
              content: "echo remote newer",
            }),
            expect.objectContaining({
              id: "desktop-added-skill",
              name: "desktop-added-skill",
            }),
          ]),
        );
      } finally {
        fs.rmSync(dataDir, { recursive: true, force: true });
      }
    },
    SYNC_ROUTE_TEST_TIMEOUT,
  );

  it(
    "accepts PromptHub envelopes on sync data import and normalizes desktop settings snapshots",
    async () => {
      const dataDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "prompthub-web-sync-envelope-"),
      );

      try {
        const app = await createTestApp(dataDir);
        const { payload: registerPayload } = await registerUser(
          app,
          "envelopesync",
          "debugpass001",
        );
        const token = registerPayload.data.accessToken;

        const importResponse = await app.request(
          new Request("http://local/api/sync/data", {
            method: "PUT",
            headers: authHeaders(token),
            body: JSON.stringify({
              payload: {
                kind: "prompthub-export",
                exportedAt: "2099-01-01T00:00:00.000Z",
                payload: {
                  ...buildRemotePayload(),
                  version: 1,
                  settings: {
                    state: {
                      themeMode: "dark",
                      language: "fr",
                      autoSave: false,
                      customPlatformRootPaths: {
                        claude: "/tmp/envelope-sync-root",
                      },
                    },
                  },
                  settingsUpdatedAt: "2099-01-01T00:00:00.000Z",
                  images: {
                    "remote-image.png": Buffer.from(
                      "envelope-sync-image",
                    ).toString("base64"),
                  },
                  videos: {
                    "remote-video.mp4": Buffer.from(
                      "envelope-sync-video",
                    ).toString("base64"),
                  },
                },
              },
            }),
          }),
        );

        expect(importResponse.status).toBe(200);
        const importBody = (await importResponse.json()) as {
          data: {
            ok: boolean;
            promptsImported: number;
            foldersImported: number;
            skillsImported: number;
            settingsUpdated: boolean;
          };
        };
        expect(importBody.data.ok).toBe(true);
        expect(importBody.data.promptsImported).toBe(1);
        expect(importBody.data.foldersImported).toBe(2);
        expect(importBody.data.skillsImported).toBe(1);
        expect(importBody.data.settingsUpdated).toBe(true);

        const dataResponse = await app.request(
          new Request("http://local/api/sync/data", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        );
        expect(dataResponse.status).toBe(200);

        const dataBody = (await dataResponse.json()) as {
          data: {
            prompts: Array<{
              title: string;
              images?: string[];
              videos?: string[];
            }>;
            settings: {
              theme: string;
              language: string;
              autoSave: boolean;
              customPlatformRootPaths?: Record<string, string>;
            };
          };
        };

        expect(dataBody.data.prompts).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              title: "Remote Prompt",
              images: ["remote-image.png"],
              videos: ["remote-video.mp4"],
            }),
          ]),
        );
        expect(dataBody.data.settings).toEqual(
          expect.objectContaining({
            theme: "dark",
            language: "fr",
            autoSave: false,
            customPlatformRootPaths: {
              claude: "/tmp/envelope-sync-root",
            },
          }),
        );
        expect(
          fs.existsSync(
            path.join(
              ensureTestMediaDir(
                dataDir,
                registerPayload.data.user.id,
                "images",
              ),
              "remote-image.png",
            ),
          ),
        ).toBe(true);
        expect(
          fs.existsSync(
            path.join(
              ensureTestMediaDir(
                dataDir,
                registerPayload.data.user.id,
                "videos",
              ),
              "remote-video.mp4",
            ),
          ),
        ).toBe(true);
      } finally {
        fs.rmSync(dataDir, { recursive: true, force: true });
      }
    },
    SYNC_ROUTE_TEST_TIMEOUT,
  );

  it(
    "fills missing settings with shared defaults during sync import",
    async () => {
      const dataDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "prompthub-web-sync-default-settings-"),
      );

      try {
        const app = await createTestApp(dataDir);
        const { payload: registerPayload } = await registerUser(
          app,
          "syncdefaultowner",
          "debugpass001",
        );
        const token = registerPayload.data.accessToken;

        const importResponse = await app.request(
          new Request("http://local/api/sync/data", {
            method: "PUT",
            headers: authHeaders(token),
            body: JSON.stringify({
              payload: {
                version: "web-backup-v2",
                exportedAt: "2026-04-21T00:00:00.000Z",
                prompts: [],
                promptVersions: [],
                folders: [],
                skills: [],
                skillVersions: [],
              },
            }),
          }),
        );

        expect(importResponse.status).toBe(200);

        const dataResponse = await app.request(
          new Request("http://local/api/sync/data", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        );
        expect(dataResponse.status).toBe(200);

        const dataBody = (await dataResponse.json()) as {
          data: {
            settings: {
              theme: string;
              language: string;
              autoSave: boolean;
            };
          };
        };

        expect(dataBody.data.settings).toEqual(
          expect.objectContaining({
            theme: DEFAULT_SETTINGS.theme,
            language: DEFAULT_SETTINGS.language,
            autoSave: DEFAULT_SETTINGS.autoSave,
          }),
        );
      } finally {
        fs.rmSync(dataDir, { recursive: true, force: true });
      }
    },
    SYNC_ROUTE_TEST_TIMEOUT,
  );

  it(
    "rejects sync imports with insecure WebDAV settings endpoints",
    async () => {
      const dataDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "prompthub-web-sync-settings-boundary-"),
      );

      try {
        const app = await createTestApp(dataDir);
        const { payload: registerPayload } = await registerUser(
          app,
          "syncinsecuresettings",
          "debugpass001",
        );
        const token = registerPayload.data.accessToken;

        const importResponse = await app.request(
          new Request("http://local/api/sync/data", {
            method: "PUT",
            headers: authHeaders(token),
            body: JSON.stringify({
              payload: {
                version: "web-backup-v2",
                exportedAt: "2026-04-21T00:00:00.000Z",
                prompts: [],
                promptVersions: [],
                folders: [],
                skills: [],
                skillVersions: [],
                settings: {
                  ...DEFAULT_SETTINGS,
                  sync: {
                    enabled: true,
                    provider: "webdav",
                    endpoint:
                      "http://dav.example.com/remote.php/dav/files/sync-import",
                  },
                },
              },
            }),
          }),
        );

        expect(importResponse.status).toBe(422);
        const importBody = (await importResponse.json()) as {
          error: { code: string; message: string };
        };
        expect(importBody.error.code).toBe("VALIDATION_ERROR");
        expect(importBody.error.message).toContain("settings.sync.endpoint");
        expect(importBody.error.message).toContain(
          "WebDAV endpoint must use HTTPS",
        );

        const dataResponse = await app.request(
          new Request("http://local/api/sync/data", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        );
        expect(dataResponse.status).toBe(200);
        const dataBody = (await dataResponse.json()) as {
          data: { settings: { sync?: { endpoint?: string } } };
        };
        expect(dataBody.data.settings.sync?.endpoint).toBeUndefined();
      } finally {
        fs.rmSync(dataDir, { recursive: true, force: true });
      }
    },
    SYNC_ROUTE_TEST_TIMEOUT,
  );

  it(
    "rejects sync imports with oversized WebDAV settings fields",
    async () => {
      const dataDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "prompthub-web-sync-settings-size-boundary-"),
      );

      try {
        const app = await createTestApp(dataDir);
        const { payload: registerPayload } = await registerUser(
          app,
          "syncoversizedsettings",
          "debugpass001",
        );
        const token = registerPayload.data.accessToken;

        const importResponse = await app.request(
          new Request("http://local/api/sync/data", {
            method: "PUT",
            headers: authHeaders(token),
            body: JSON.stringify({
              payload: {
                version: "web-backup-v2",
                exportedAt: "2026-04-21T00:00:00.000Z",
                prompts: [],
                promptVersions: [],
                folders: [],
                skills: [],
                skillVersions: [],
                settings: {
                  ...DEFAULT_SETTINGS,
                  sync: {
                    enabled: true,
                    provider: "webdav",
                    endpoint: `https://dav.example.com/${"a".repeat(2050)}`,
                    username: "u".repeat(513),
                    password: "p".repeat(513),
                    remotePath: `/${"backup/".repeat(180)}`,
                    autoSync: true,
                    lastSyncAt: "not-an-iso-date",
                  },
                },
              },
            }),
          }),
        );

        expect(importResponse.status).toBe(422);
        const importBody = (await importResponse.json()) as {
          error: { code: string; message: string };
        };
        expect(importBody.error.code).toBe("VALIDATION_ERROR");
        expect(importBody.error.message).toContain("settings.sync.endpoint");
        expect(importBody.error.message).toContain("settings.sync.username");
        expect(importBody.error.message).toContain("settings.sync.password");
        expect(importBody.error.message).toContain("settings.sync.remotePath");
        expect(importBody.error.message).toContain("settings.sync.lastSyncAt");

        const dataResponse = await app.request(
          new Request("http://local/api/sync/data", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        );
        expect(dataResponse.status).toBe(200);
        const dataBody = (await dataResponse.json()) as {
          data: { settings: { sync?: { endpoint?: string } } };
        };
        expect(dataBody.data.settings.sync?.endpoint).toBeUndefined();
      } finally {
        fs.rmSync(dataDir, { recursive: true, force: true });
      }
    },
    SYNC_ROUTE_TEST_TIMEOUT,
  );

  it(
    "rejects sync imports with malformed persisted settings preference fields",
    async () => {
      const dataDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "prompthub-web-sync-preference-boundary-"),
      );

      try {
        const app = await createTestApp(dataDir);
        const { payload: registerPayload } = await registerUser(
          app,
          "syncmalformedsettings",
          "debugpass001",
        );
        const token = registerPayload.data.accessToken;

        const importResponse = await app.request(
          new Request("http://local/api/sync/data", {
            method: "PUT",
            headers: authHeaders(token),
            body: JSON.stringify({
              payload: {
                version: "web-backup-v2",
                exportedAt: "2026-04-21T00:00:00.000Z",
                prompts: [],
                promptVersions: [],
                folders: [],
                skills: [],
                skillVersions: [],
                settings: {
                  ...DEFAULT_SETTINGS,
                  backgroundImageFileName: "../wallpaper.png",
                  lastManualBackupAt: "not-an-iso-date",
                  lastManualBackupVersion: "v".repeat(121),
                },
              },
            }),
          }),
        );

        expect(importResponse.status).toBe(422);
        const importBody = (await importResponse.json()) as {
          error: { code: string; message: string };
        };
        expect(importBody.error.code).toBe("VALIDATION_ERROR");
        expect(importBody.error.message).toContain(
          "settings.backgroundImageFileName",
        );
        expect(importBody.error.message).toContain(
          "settings.lastManualBackupAt",
        );
        expect(importBody.error.message).toContain(
          "settings.lastManualBackupVersion",
        );

        const dataResponse = await app.request(
          new Request("http://local/api/sync/data", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        );
        expect(dataResponse.status).toBe(200);
        const dataBody = (await dataResponse.json()) as {
          data: {
            settings: {
              backgroundImageFileName?: string;
              lastManualBackupAt?: string;
              lastManualBackupVersion?: string;
            };
          };
        };
        expect(dataBody.data.settings.backgroundImageFileName).toBeUndefined();
        expect(dataBody.data.settings.lastManualBackupAt).toBeUndefined();
        expect(dataBody.data.settings.lastManualBackupVersion).toBeUndefined();
      } finally {
        fs.rmSync(dataDir, { recursive: true, force: true });
      }
    },
    SYNC_ROUTE_TEST_TIMEOUT,
  );
});
