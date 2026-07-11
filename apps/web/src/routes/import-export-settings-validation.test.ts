import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { strToU8, zipSync } from "fflate";
import { closeDatabase } from "@prompthub/db";
import { DEFAULT_SETTINGS } from "@prompthub/shared";

import {
  ENV_KEYS,
  originalEnv,
  ISO_TIMESTAMP,
  createTestApp,
  registerUser,
  authHeaders,
  createFolder,
  createPrompt,
  createSkill,
  exportPayload,
} from "./import-export.test-helpers";

describe("web import/export routes", () => {
  const TEST_TIMEOUT = 20000;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    closeDatabase();
    for (const key of ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it(
    "imports legacy versions payloads and normalizes numeric timestamps back to ISO strings",
    async () => {
      const dataDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "prompthub-web-import-export-test-"),
      );

      try {
        const app = await createTestApp(dataDir);
        const { payload: registerPayload } = await registerUser(
          app,
          "legacyimporter",
          "debugpass001",
        );
        const token = registerPayload.data.accessToken;

        const folder = await createFolder(app, token, {
          name: "Legacy Folder",
        });
        const prompt = await createPrompt(app, token, {
          title: "Legacy Prompt",
          userPrompt: "Legacy body",
          folderId: folder.payload.data!.id,
        });
        expect(prompt.response.status).toBe(201);

        const promptUpdate = await app.request(
          new Request(`http://local/api/prompts/${prompt.payload.data!.id}`, {
            method: "PUT",
            headers: authHeaders(token),
            body: JSON.stringify({ userPrompt: "Legacy body v2" }),
          }),
        );
        expect(promptUpdate.status).toBe(200);

        const skill = await createSkill(app, token, {
          name: "legacy-skill",
          content: "echo legacy",
        });
        expect(skill.response.status).toBe(201);

        const createSkillVersion = await app.request(
          new Request(
            `http://local/api/skills/${skill.payload.data!.id}/versions`,
            {
              method: "POST",
              headers: authHeaders(token),
              body: JSON.stringify({ note: "legacy-snapshot" }),
            },
          ),
        );
        expect(createSkillVersion.status).toBe(201);

        const { payload: exportedPayload } = await exportPayload(app, token);

        const legacyPayload = structuredClone(exportedPayload);
        legacyPayload.promptVersions = [];
        legacyPayload.prompts = legacyPayload.prompts.map((entry) => ({
          ...entry,
          createdAt:
            typeof entry.createdAt === "string"
              ? Date.parse(entry.createdAt)
              : entry.createdAt,
          updatedAt:
            typeof entry.updatedAt === "string"
              ? Date.parse(entry.updatedAt)
              : entry.updatedAt,
        }));
        legacyPayload.versions = legacyPayload.versions.map((entry) => ({
          ...entry,
          createdAt:
            typeof entry.createdAt === "string"
              ? Date.parse(entry.createdAt)
              : entry.createdAt,
        }));
        legacyPayload.folders = legacyPayload.folders.map((entry) => ({
          ...entry,
          createdAt:
            typeof entry.createdAt === "string"
              ? Date.parse(entry.createdAt)
              : entry.createdAt,
          updatedAt:
            typeof entry.updatedAt === "string"
              ? Date.parse(entry.updatedAt)
              : entry.updatedAt,
        }));
        legacyPayload.skillVersions = legacyPayload.skillVersions.map(
          (entry) => ({
            ...entry,
            createdAt:
              typeof entry.createdAt === "string"
                ? Date.parse(entry.createdAt)
                : entry.createdAt,
          }),
        );

        const importResponse = await app.request(
          new Request("http://local/api/import", {
            method: "POST",
            headers: authHeaders(token),
            body: JSON.stringify(legacyPayload),
          }),
        );

        expect(importResponse.status).toBe(201);

        const { payload: reExportedPayload } = await exportPayload(app, token);
        expect(reExportedPayload.promptVersions.length).toBe(
          exportedPayload.versions.length,
        );
        expect(reExportedPayload.prompts[0]?.createdAt).toMatch(ISO_TIMESTAMP);
        expect(reExportedPayload.prompts[0]?.updatedAt).toMatch(ISO_TIMESTAMP);
        expect(reExportedPayload.promptVersions[0]?.createdAt).toMatch(
          ISO_TIMESTAMP,
        );
        expect(reExportedPayload.folders[0]?.createdAt).toMatch(ISO_TIMESTAMP);
        expect(reExportedPayload.folders[0]?.updatedAt).toMatch(ISO_TIMESTAMP);
        expect(reExportedPayload.skillVersions[0]?.createdAt).toMatch(
          ISO_TIMESTAMP,
        );
      } finally {
        fs.rmSync(dataDir, { recursive: true, force: true });
      }
    },
    TEST_TIMEOUT,
  );

  it(
    "imports PromptHub backup/export envelopes and restores embedded media payloads",
    async () => {
      const dataDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "prompthub-web-import-export-test-"),
      );

      try {
        const app = await createTestApp(dataDir);
        const { payload: registerPayload } = await registerUser(
          app,
          "envelopeimporter",
          "debugpass001",
        );
        const token = registerPayload.data.accessToken;

        const envelopePayload = {
          kind: "prompthub-backup",
          exportedAt: "2026-04-20T00:00:00.000Z",
          payload: {
            version: 1,
            exportedAt: "2026-04-20T00:00:00.000Z",
            prompts: [
              {
                id: "prompt-envelope-1",
                title: "Envelope Prompt",
                userPrompt: "Envelope body",
                variables: [],
                tags: [],
                folderId: "folder-envelope-1",
                images: ["image-envelope.png"],
                videos: ["video-envelope.mp4"],
                isFavorite: false,
                isPinned: false,
                version: 1,
                currentVersion: 1,
                usageCount: 0,
                createdAt: "2026-04-20T00:00:00.000Z",
                updatedAt: "2026-04-20T00:00:00.000Z",
              },
            ],
            folders: [
              {
                id: "folder-envelope-1",
                name: "Envelope Folder",
                order: 0,
                createdAt: "2026-04-20T00:00:00.000Z",
                updatedAt: "2026-04-20T00:00:00.000Z",
              },
            ],
            versions: [
              {
                id: "prompt-envelope-v1",
                promptId: "prompt-envelope-1",
                version: 1,
                userPrompt: "Envelope body",
                variables: [],
                createdAt: "2026-04-20T00:00:00.000Z",
              },
            ],
            images: {
              "image-envelope.png": Buffer.from(
                "envelope-image",
                "utf8",
              ).toString("base64"),
            },
            videos: {
              "video-envelope.mp4": Buffer.from(
                "envelope-video",
                "utf8",
              ).toString("base64"),
            },
            skills: [],
            skillVersions: [],
            settings: {
              state: {
                themeMode: "dark",
                language: "fr",
                autoSave: false,
                customPlatformRootPaths: {
                  claude: "/tmp/envelope-root",
                },
              },
            },
            settingsUpdatedAt: "2026-04-20T00:00:00.000Z",
          },
        };

        const importResponse = await app.request(
          new Request("http://local/api/import", {
            method: "POST",
            headers: authHeaders(token),
            body: JSON.stringify(envelopePayload),
          }),
        );

        expect(importResponse.status).toBe(201);

        const { payload: exportedPayload } = await exportPayload(app, token);
        expect(exportedPayload.prompts).toEqual([
          expect.objectContaining({
            title: "Envelope Prompt",
            images: ["image-envelope.png"],
            videos: ["video-envelope.mp4"],
          }),
        ]);
        expect(exportedPayload.settings).toEqual(
          expect.objectContaining({
            theme: "dark",
            language: "fr",
            autoSave: false,
            customPlatformRootPaths: {
              claude: "/tmp/envelope-root",
            },
          }),
        );
        expect(exportedPayload.images).toEqual({
          "image-envelope.png": Buffer.from("envelope-image", "utf8").toString(
            "base64",
          ),
        });
        expect(exportedPayload.videos).toEqual({
          "video-envelope.mp4": Buffer.from("envelope-video", "utf8").toString(
            "base64",
          ),
        });
      } finally {
        fs.rmSync(dataDir, { recursive: true, force: true });
      }
    },
    TEST_TIMEOUT,
  );

  it(
    "fills missing settings with shared defaults during import",
    async () => {
      const dataDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "prompthub-web-import-default-settings-"),
      );

      try {
        const app = await createTestApp(dataDir);
        const { payload: registerPayload } = await registerUser(
          app,
          "defaultsettingsimporter",
          "debugpass001",
        );
        const token = registerPayload.data.accessToken;

        const importResponse = await app.request(
          new Request("http://local/api/import", {
            method: "POST",
            headers: authHeaders(token),
            body: JSON.stringify({
              version: "web-backup-v2",
              exportedAt: "2026-04-21T00:00:00.000Z",
              prompts: [],
              promptVersions: [],
              folders: [],
              skills: [],
              skillVersions: [],
            }),
          }),
        );

        expect(importResponse.status).toBe(201);

        const { payload: exportedPayload } = await exportPayload(app, token);
        expect(exportedPayload.settings).toEqual(
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
    TEST_TIMEOUT,
  );

  it(
    "rejects imported WebDAV settings with insecure endpoints",
    async () => {
      const dataDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "prompthub-web-import-settings-boundary-"),
      );

      try {
        const app = await createTestApp(dataDir);
        const { payload: registerPayload } = await registerUser(
          app,
          "insecuresettingsimporter",
          "debugpass001",
        );
        const token = registerPayload.data.accessToken;

        const importResponse = await app.request(
          new Request("http://local/api/import", {
            method: "POST",
            headers: authHeaders(token),
            body: JSON.stringify({
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
                    "http://dav.example.com/remote.php/dav/files/import",
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

        const { payload: exportedPayload } = await exportPayload(app, token);
        const exportedSettings = exportedPayload.settings as {
          sync?: { endpoint?: string };
        };
        expect(exportedSettings.sync?.endpoint).toBeUndefined();
      } finally {
        fs.rmSync(dataDir, { recursive: true, force: true });
      }
    },
    TEST_TIMEOUT,
  );

  it(
    "rejects imported WebDAV settings with oversized fields",
    async () => {
      const dataDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "prompthub-web-import-settings-size-boundary-"),
      );

      try {
        const app = await createTestApp(dataDir);
        const { payload: registerPayload } = await registerUser(
          app,
          "oversizedsettingsimporter",
          "debugpass001",
        );
        const token = registerPayload.data.accessToken;

        const importResponse = await app.request(
          new Request("http://local/api/import", {
            method: "POST",
            headers: authHeaders(token),
            body: JSON.stringify({
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

        const { payload: exportedPayload } = await exportPayload(app, token);
        const exportedSettings = exportedPayload.settings as {
          sync?: { endpoint?: string };
        };
        expect(exportedSettings.sync?.endpoint).toBeUndefined();
      } finally {
        fs.rmSync(dataDir, { recursive: true, force: true });
      }
    },
    TEST_TIMEOUT,
  );

  it(
    "rejects imported settings with malformed persisted preference fields",
    async () => {
      const dataDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "prompthub-web-import-preference-boundary-"),
      );

      try {
        const app = await createTestApp(dataDir);
        const { payload: registerPayload } = await registerUser(
          app,
          "malformedsettingsimporter",
          "debugpass001",
        );
        const token = registerPayload.data.accessToken;

        const importResponse = await app.request(
          new Request("http://local/api/import", {
            method: "POST",
            headers: authHeaders(token),
            body: JSON.stringify({
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

        const { payload: exportedPayload } = await exportPayload(app, token);
        const exportedSettings = exportedPayload.settings as {
          backgroundImageFileName?: string;
          lastManualBackupAt?: string;
          lastManualBackupVersion?: string;
        };
        expect(exportedSettings.backgroundImageFileName).toBeUndefined();
        expect(exportedSettings.lastManualBackupAt).toBeUndefined();
        expect(exportedSettings.lastManualBackupVersion).toBeUndefined();
      } finally {
        fs.rmSync(dataDir, { recursive: true, force: true });
      }
    },
    TEST_TIMEOUT,
  );

  it(
    "rejects invalid import payloads",
    async () => {
      const dataDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "prompthub-web-import-export-test-"),
      );

      try {
        const app = await createTestApp(dataDir);
        const { payload: registerPayload } = await registerUser(
          app,
          "invalidimporter",
          "debugpass001",
        );

        const response = await app.request(
          new Request("http://local/api/import", {
            method: "POST",
            headers: authHeaders(registerPayload.data.accessToken),
            body: JSON.stringify({
              version: "web-backup-v2",
              exportedAt: "2026-04-13T00:00:00.000Z",
              prompts: [],
              promptVersions: [],
              folders: [],
              skills: [],
              skillVersions: [],
              settings: {
                theme: "blue",
                language: "zh",
                autoSave: true,
              },
            }),
          }),
        );

        expect(response.status).toBe(422);
        const body = (await response.json()) as {
          error: { code: string; message: string };
        };
        expect(body.error.code).toBe("VALIDATION_ERROR");
        expect(body.error.message).toContain("settings.theme");
      } finally {
        fs.rmSync(dataDir, { recursive: true, force: true });
      }
    },
    TEST_TIMEOUT,
  );
});
