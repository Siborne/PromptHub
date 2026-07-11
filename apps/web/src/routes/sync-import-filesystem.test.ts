import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildDeepFolderPayload,
  buildDeepSkillPayload,
  buildRemotePayload,
  buildUnsafeRulePayload,
} from "./sync.test-fixtures";
import {
  SYNC_ROUTE_TEST_TIMEOUT,
  authHeaders,
  createTestApp,
  ensureTestMediaDir,
  registerUser,
  setupSyncRouteTestLifecycle,
} from "./sync.test-helpers";

describe("web sync import filesystem safety", () => {
  setupSyncRouteTestLifecycle();

  it(
    "writes media files when importing sync data directly",
    async () => {
      const dataDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "prompthub-web-sync-direct-media-"),
      );

      try {
        const app = await createTestApp(dataDir);
        const { payload: registerPayload } = await registerUser(
          app,
          "mediasync",
          "debugpass001",
        );
        const token = registerPayload.data.accessToken;

        const importResponse = await app.request(
          new Request("http://local/api/sync/data", {
            method: "PUT",
            headers: authHeaders(token),
            body: JSON.stringify({
              payload: {
                ...buildRemotePayload(),
                images: {
                  "remote-image.png": Buffer.from(
                    "direct-image-binary",
                  ).toString("base64"),
                },
                videos: {
                  "remote-video.mp4": Buffer.from(
                    "direct-video-binary",
                  ).toString("base64"),
                },
              },
            }),
          }),
        );

        expect(importResponse.status).toBe(200);
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
    "does not leave media files when direct sync import fails during later writes",
    async () => {
      const dataDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "prompthub-web-sync-direct-media-rollback-"),
      );

      try {
        vi.doMock("../services/rule-workspace.js", async () => {
          const actual = await vi.importActual<
            typeof import("../services/rule-workspace.js")
          >("../services/rule-workspace.js");
          return {
            ...actual,
            importRuleBackupRecords: vi.fn(() => {
              throw new Error("Simulated sync rule import failure");
            }),
          };
        });

        const app = await createTestApp(dataDir);
        const { payload: registerPayload } = await registerUser(
          app,
          "mediarollbacksync",
          "debugpass001",
        );
        const token = registerPayload.data.accessToken;

        const importResponse = await app.request(
          new Request("http://local/api/sync/data", {
            method: "PUT",
            headers: authHeaders(token),
            body: JSON.stringify({
              payload: {
                ...buildRemotePayload(),
                images: {
                  "remote-image.png": Buffer.from(
                    "rollback-image-binary",
                  ).toString("base64"),
                },
              },
            }),
          }),
        );

        expect(importResponse.status).toBe(422);
        const importBody = (await importResponse.json()) as {
          error: { message: string };
        };
        expect(importBody.error.message).toContain(
          "Simulated sync rule import failure",
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
        ).toBe(false);

        const dataResponse = await app.request(
          new Request("http://local/api/sync/data", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        );
        expect(dataResponse.status).toBe(200);
        const dataBody = (await dataResponse.json()) as {
          data: {
            prompts: unknown[];
            folders: unknown[];
            rules?: unknown[];
          };
        };
        expect(dataBody.data.prompts).toEqual([]);
        expect(dataBody.data.folders).toEqual([]);
        expect(dataBody.data.rules).toEqual([]);
      } finally {
        vi.doUnmock("../services/rule-workspace.js");
        fs.rmSync(dataDir, { recursive: true, force: true });
      }
    },
    SYNC_ROUTE_TEST_TIMEOUT,
  );

  it(
    "rolls back direct sync import records when pulled media writing fails",
    async () => {
      const dataDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "prompthub-web-sync-media-write-rollback-"),
      );

      try {
        vi.doMock("../services/sync-media.js", async () => {
          const actual = await vi.importActual<
            typeof import("../services/sync-media.js")
          >("../services/sync-media.js");
          return {
            ...actual,
            writePulledSyncMedia: vi.fn(() => {
              throw new Error("Simulated pulled media write failure");
            }),
          };
        });

        const app = await createTestApp(dataDir);
        const { payload: registerPayload } = await registerUser(
          app,
          "mediawriterollbacksync",
          "debugpass001",
        );
        const token = registerPayload.data.accessToken;

        const importResponse = await app.request(
          new Request("http://local/api/sync/data", {
            method: "PUT",
            headers: authHeaders(token),
            body: JSON.stringify({
              payload: {
                ...buildRemotePayload(),
                images: {
                  "remote-image.png": Buffer.from(
                    "write-failure-image",
                  ).toString("base64"),
                },
              },
            }),
          }),
        );

        expect(importResponse.status).toBe(422);
        const importBody = (await importResponse.json()) as {
          error: { message: string };
        };
        expect(importBody.error.message).toContain(
          "Simulated pulled media write failure",
        );

        const dataResponse = await app.request(
          new Request("http://local/api/sync/data", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        );
        expect(dataResponse.status).toBe(200);
        const dataBody = (await dataResponse.json()) as {
          data: {
            prompts: unknown[];
            folders: unknown[];
            rules?: unknown[];
            skills: unknown[];
          };
        };
        expect(dataBody.data.prompts).toEqual([]);
        expect(dataBody.data.folders).toEqual([]);
        expect(dataBody.data.rules).toEqual([]);
        expect(dataBody.data.skills).toEqual([]);
      } finally {
        vi.doUnmock("../services/sync-media.js");
        fs.rmSync(dataDir, { recursive: true, force: true });
      }
    },
    SYNC_ROUTE_TEST_TIMEOUT,
  );

  it(
    "rejects sync imports that exceed prompt workspace path limits before writing media or records",
    async () => {
      const dataDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "prompthub-web-sync-deep-folders-"),
      );

      try {
        const app = await createTestApp(dataDir);
        const { payload: registerPayload } = await registerUser(
          app,
          "deepsync",
          "debugpass001",
        );
        const token = registerPayload.data.accessToken;

        const importResponse = await app.request(
          new Request("http://local/api/sync/data", {
            method: "PUT",
            headers: authHeaders(token),
            body: JSON.stringify({
              payload: buildDeepFolderPayload(180),
            }),
          }),
        );

        expect(importResponse.status).toBe(422);
        const importBody = (await importResponse.json()) as {
          error: { code: string; message: string };
        };
        expect(importBody.error.code).toBe("VALIDATION_ERROR");
        expect(importBody.error.message).toContain(
          "prompt workspace path is too long",
        );
        expect(
          fs.existsSync(
            path.join(
              ensureTestMediaDir(
                dataDir,
                registerPayload.data.user.id,
                "images",
              ),
              "deep-image.png",
            ),
          ),
        ).toBe(false);

        const dataResponse = await app.request(
          new Request("http://local/api/sync/data", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        );
        expect(dataResponse.status).toBe(200);
        const dataBody = (await dataResponse.json()) as {
          data: {
            prompts: unknown[];
            folders: unknown[];
          };
        };
        expect(dataBody.data.prompts).toEqual([]);
        expect(dataBody.data.folders).toEqual([]);
      } finally {
        fs.rmSync(dataDir, { recursive: true, force: true });
      }
    },
    SYNC_ROUTE_TEST_TIMEOUT,
  );

  it(
    "rejects sync imports that exceed skill workspace path limits before writing media or records",
    async () => {
      const dataDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "prompthub-web-sync-deep-skills-"),
      );

      try {
        const app = await createTestApp(dataDir);
        const { payload: registerPayload } = await registerUser(
          app,
          "deepskillsync",
          "debugpass001",
        );
        const token = registerPayload.data.accessToken;

        const importResponse = await app.request(
          new Request("http://local/api/sync/data", {
            method: "PUT",
            headers: authHeaders(token),
            body: JSON.stringify({
              payload: buildDeepSkillPayload(),
            }),
          }),
        );

        expect(importResponse.status).toBe(422);
        const importBody = (await importResponse.json()) as {
          error: { code: string; message: string };
        };
        expect(importBody.error.code).toBe("VALIDATION_ERROR");
        expect(importBody.error.message).toContain(
          "skill workspace path segment is too long",
        );
        expect(
          fs.existsSync(
            path.join(
              ensureTestMediaDir(
                dataDir,
                registerPayload.data.user.id,
                "images",
              ),
              "deep-skill-image.png",
            ),
          ),
        ).toBe(false);

        const dataResponse = await app.request(
          new Request("http://local/api/sync/data", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        );
        expect(dataResponse.status).toBe(200);
        const dataBody = (await dataResponse.json()) as {
          data: {
            prompts: unknown[];
            skills: unknown[];
          };
        };
        expect(dataBody.data.prompts).toEqual([]);
        expect(dataBody.data.skills).toEqual([]);
      } finally {
        fs.rmSync(dataDir, { recursive: true, force: true });
      }
    },
    SYNC_ROUTE_TEST_TIMEOUT,
  );

  it(
    "rejects sync imports with unsafe rule paths before writing media or records",
    async () => {
      const dataDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "prompthub-web-sync-unsafe-rules-"),
      );

      try {
        const app = await createTestApp(dataDir);
        const { payload: registerPayload } = await registerUser(
          app,
          "unsaferulesync",
          "debugpass001",
        );
        const token = registerPayload.data.accessToken;

        const importResponse = await app.request(
          new Request("http://local/api/sync/data", {
            method: "PUT",
            headers: authHeaders(token),
            body: JSON.stringify({
              payload: buildUnsafeRulePayload(),
            }),
          }),
        );

        expect(importResponse.status).toBe(422);
        const importBody = (await importResponse.json()) as {
          error: { code: string; message: string };
        };
        expect(importBody.error.code).toBe("VALIDATION_ERROR");
        expect(importBody.error.message).toContain("rule path segment");
        expect(
          fs.existsSync(
            path.join(
              ensureTestMediaDir(
                dataDir,
                registerPayload.data.user.id,
                "images",
              ),
              "unsafe-rule-image.png",
            ),
          ),
        ).toBe(false);

        const dataResponse = await app.request(
          new Request("http://local/api/sync/data", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        );
        expect(dataResponse.status).toBe(200);
        const dataBody = (await dataResponse.json()) as {
          data: {
            prompts: unknown[];
            rules?: unknown[];
          };
        };
        expect(dataBody.data.prompts).toEqual([]);
        expect(dataBody.data.rules).toEqual([]);
      } finally {
        fs.rmSync(dataDir, { recursive: true, force: true });
      }
    },
    SYNC_ROUTE_TEST_TIMEOUT,
  );
});
