import { expect, test } from "@playwright/test";

import {
  closePromptHub,
  launchPromptHub,
  setAppLanguage,
  setAppSettings,
} from "./helpers/electron";
import {
  loginSelfHosted,
  startSelfHostedTestServer,
} from "./helpers/self-hosted-web";

interface SyncManifestResponse {
  data: {
    counts: {
      prompts: number;
      folders: number;
      skills: number;
      mcpServers: number;
      plugins: number;
    };
  };
}

interface SyncDataResponse {
  data: {
    rules?: unknown[];
    mcpLibrary?: { servers: unknown[] };
    pluginLibrary?: { plugins: unknown[] };
  };
}

test.describe("E2E: desktop self-hosted sync", () => {
  test("automatically pulls the remote workspace on startup when self-hosted startup sync is enabled", async () => {
    const server = await startSelfHostedTestServer();
    const firstLaunch = await launchPromptHub(
      "prompt-workspace.seed.json",
    );
    let app = firstLaunch.app;
    let page = firstLaunch.page;
    const { userDataDir } = firstLaunch;

    try {
      await setAppLanguage(page, "en");

      const accessToken = await loginSelfHosted(
        server.baseUrl,
        server.username,
        server.password,
      );

      const syncUpdateResponse = await fetch(`${server.baseUrl}/api/sync/data`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload: {
            version: "web-backup-v2",
            exportedAt: "2026-04-16T08:00:00.000Z",
            prompts: [
              {
                id: "remote_auto_prompt",
                title: "Auto Pull Prompt",
                description: "Synced during desktop startup",
                promptType: "text",
                systemPrompt: "You are the startup sync payload",
                userPrompt: "Confirm automatic startup sync works.",
                variables: [],
                tags: ["startup", "sync"],
                folderId: "remote_auto_folder",
                images: [],
                videos: [],
                isFavorite: false,
                isPinned: false,
                version: 1,
                currentVersion: 1,
                usageCount: 0,
                source: null,
                notes: "Pulled automatically from self-hosted PromptHub Web",
                lastAiResponse: null,
                createdAt: "2026-04-16T08:00:00.000Z",
                updatedAt: "2026-04-16T08:00:00.000Z",
              },
            ],
            promptVersions: [
              {
                id: "remote_auto_version",
                promptId: "remote_auto_prompt",
                version: 1,
                systemPrompt: "You are the startup sync payload",
                userPrompt: "Confirm automatic startup sync works.",
                variables: [],
                note: "Initial startup sync version",
                aiResponse: null,
                createdAt: "2026-04-16T08:00:00.000Z",
              },
            ],
            folders: [
              {
                id: "remote_auto_folder",
                name: "Startup Folder",
                order: 0,
                createdAt: "2026-04-16T08:00:00.000Z",
                updatedAt: "2026-04-16T08:00:00.000Z",
              },
            ],
            skills: [],
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
          },
        }),
      });
      expect(syncUpdateResponse.ok).toBe(true);

      await setAppSettings(page, {
        autoCheckUpdate: false,
        minimizeOnLaunch: false,
        syncProvider: "self-hosted",
        selfHostedSyncEnabled: true,
        selfHostedSyncUrl: server.baseUrl,
        selfHostedSyncUsername: server.username,
        selfHostedSyncPassword: server.password,
        selfHostedSyncOnStartup: true,
        selfHostedSyncOnStartupDelay: 0,
      });

      await closePromptHub(app, userDataDir, { preserveUserDataDir: true });

      const secondLaunch = await launchPromptHub(null, {
        userDataDir,
      });
      app = secondLaunch.app;
      page = secondLaunch.page;

      const startupSettings = await page.evaluate(() => {
        const raw = localStorage.getItem("prompthub-settings");
        const parsed = raw ? JSON.parse(raw) : {};
        return {
          onLine: navigator.onLine,
          selfHostedSyncEnabled: parsed.state?.selfHostedSyncEnabled ?? false,
          selfHostedSyncOnStartup: parsed.state?.selfHostedSyncOnStartup ?? false,
          selfHostedSyncUrl: parsed.state?.selfHostedSyncUrl ?? "",
          selfHostedSyncUsername: parsed.state?.selfHostedSyncUsername ?? "",
        };
      });

      expect(startupSettings.selfHostedSyncEnabled).toBe(true);
      expect(startupSettings.selfHostedSyncOnStartup).toBe(true);
      expect(startupSettings.selfHostedSyncUrl).toBe(server.baseUrl);
      expect(startupSettings.selfHostedSyncUsername).toBe(server.username);

      await expect
        .poll(
          async () =>
            page.evaluate(async () => {
              const prompts = await window.api.prompt.getAll();
              return prompts.map((prompt) => prompt.title);
            }),
          {
            timeout: 8000,
            message: "desktop should pull remote prompt content on startup",
          },
        )
        .toEqual(["Auto Pull Prompt"]);

      const restoredState = await page.evaluate(async () => {
        const prompts = await window.api.prompt.getAll();
        const folders = await window.api.folder.getAll();
        return {
          prompts: prompts.map((prompt) => ({
            title: prompt.title,
            folderId: prompt.folderId,
          })),
          folders: folders.map((folder) => ({
            id: folder.id,
            name: folder.name,
          })),
        };
      });

      expect(restoredState.prompts).toEqual([
        expect.objectContaining({ title: "Auto Pull Prompt" }),
      ]);
      expect(restoredState.folders).toEqual([
        expect.objectContaining({ name: "Startup Folder" }),
      ]);

      const startupPrompt = restoredState.prompts.find(
        (prompt) => prompt.title === "Auto Pull Prompt",
      );
      const startupFolder = restoredState.folders.find(
        (folder) => folder.name === "Startup Folder",
      );
      expect(startupPrompt?.folderId).toBe(startupFolder?.id);
    } finally {
      await closePromptHub(app, userDataDir);
      await server.stop();
    }
  });

  test("connects, uploads to, and downloads from a live self-hosted PromptHub Web", async () => {
    const server = await startSelfHostedTestServer();
    const { app, page, userDataDir } = await launchPromptHub(
      "prompt-workspace.seed.json",
    );

    try {
      await setAppLanguage(page, "en");
      await setAppSettings(page, {
        autoCheckUpdate: false,
        syncProvider: "self-hosted",
        selfHostedSyncEnabled: true,
        selfHostedSyncUrl: server.baseUrl,
        selfHostedSyncUsername: server.username,
        selfHostedSyncPassword: server.password,
      });

      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page.getByRole("button", { name: "Data & Sync", exact: true }).click();
      await page.getByRole("button", { name: /Self-Hosted PromptHub/ }).click();

      await page.getByRole("button", { name: "Test Connection" }).click();
      await expect(
        page.getByText(/Connection successful/i),
      ).toBeVisible();

      const expectedRuntimeAssetCounts = await page.evaluate(async () => {
        const [rules, mcpLibrary, pluginSnapshot] = await Promise.all([
          window.api.rules.list(),
          window.api.mcp.getLibrary(),
          window.api.plugin.exportLibrarySnapshot(),
        ]);

        return {
          rules: rules.length,
          mcpServers: mcpLibrary.servers.length,
          plugins: pluginSnapshot.library.plugins.length,
        };
      });

      const backupToRemote = page.getByRole("button", {
        name: "Back up to remote",
        exact: true,
      });
      await expect(backupToRemote).toBeEnabled();
      await backupToRemote.click();
      await expect(
        page.getByText(
          new RegExp(
            `Uploaded 1 prompts, 1 folders, ${expectedRuntimeAssetCounts.rules} rules, and 0 skills`,
            "i",
          ),
        ),
      ).toBeVisible();

      const accessToken = await loginSelfHosted(
        server.baseUrl,
        server.username,
        server.password,
      );

      const manifestResponse = await fetch(`${server.baseUrl}/api/sync/manifest`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });
      expect(manifestResponse.ok).toBe(true);

      const manifestPayload =
        (await manifestResponse.json()) as SyncManifestResponse;
      expect(manifestPayload.data.counts).toEqual({
        prompts: 1,
        folders: 1,
        skills: 0,
        mcpServers: expectedRuntimeAssetCounts.mcpServers,
        plugins: expectedRuntimeAssetCounts.plugins,
      });

      const uploadedDataResponse = await fetch(`${server.baseUrl}/api/sync/data`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });
      expect(uploadedDataResponse.ok).toBe(true);
      const uploadedData =
        (await uploadedDataResponse.json()) as SyncDataResponse;
      expect(uploadedData.data.rules ?? []).toHaveLength(
        expectedRuntimeAssetCounts.rules,
      );
      expect(uploadedData.data.mcpLibrary?.servers ?? []).toHaveLength(
        expectedRuntimeAssetCounts.mcpServers,
      );
      expect(uploadedData.data.pluginLibrary?.plugins ?? []).toHaveLength(
        expectedRuntimeAssetCounts.plugins,
      );

      const syncUpdateResponse = await fetch(`${server.baseUrl}/api/sync/data`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload: {
            version: "web-backup-v2",
            exportedAt: "2026-04-16T00:00:00.000Z",
            prompts: [
              {
                id: "remote_prompt_1",
                title: "Remote Prompt",
                description: "Pulled from web",
                promptType: "text",
                systemPrompt: "You are the remote backup",
                userPrompt: "Validate {{target}} from remote.",
                variables: [
                  {
                    name: "target",
                    type: "text",
                    required: true,
                  },
                ],
                tags: ["remote", "backup"],
                folderId: "remote_folder_1",
                images: [],
                videos: [],
                isFavorite: false,
                isPinned: false,
                version: 1,
                currentVersion: 1,
                usageCount: 0,
                source: null,
                notes: "Round-tripped from self-hosted web",
                lastAiResponse: null,
                createdAt: "2026-04-16T00:00:00.000Z",
                updatedAt: "2026-04-16T00:00:00.000Z",
              },
            ],
            promptVersions: [
              {
                id: "remote_version_1",
                promptId: "remote_prompt_1",
                version: 1,
                systemPrompt: "You are the remote backup",
                userPrompt: "Validate {{target}} from remote.",
                variables: [
                  {
                    name: "target",
                    type: "text",
                    required: true,
                  },
                ],
                note: "Initial remote version",
                aiResponse: null,
                createdAt: "2026-04-16T00:00:00.000Z",
              },
            ],
            folders: [
              {
                id: "remote_folder_1",
                name: "Remote Folder",
                order: 0,
                createdAt: "2026-04-16T00:00:00.000Z",
                updatedAt: "2026-04-16T00:00:00.000Z",
              },
            ],
            skills: [],
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
          },
        }),
      });
      expect(syncUpdateResponse.ok).toBe(true);

      const updateFromRemote = page.getByRole("button", {
        name: "Update from remote",
        exact: true,
      });
      await expect(updateFromRemote).toBeEnabled();
      await updateFromRemote.click();
      await expect
        .poll(
          async () =>
            page.evaluate(async () => {
              const prompts = await window.api.prompt.getAll();
              const folders = await window.api.folder.getAll();
              return {
                prompts: prompts.map((prompt) => ({
                  id: prompt.id,
                  title: prompt.title,
                  folderId: prompt.folderId,
                })),
                folders: folders.map((folder) => ({
                  id: folder.id,
                  name: folder.name,
                })),
              };
            }),
          {
            timeout: 10000,
            message: "desktop should restore remote self-hosted data after download",
          },
        )
        .toEqual(
          expect.objectContaining({
            prompts: expect.arrayContaining([
              expect.objectContaining({ title: "Deploy Checklist" }),
              expect.objectContaining({ title: "Remote Prompt" }),
            ]),
            folders: expect.arrayContaining([
              expect.objectContaining({ name: "Ops" }),
              expect.objectContaining({ name: "Remote Folder" }),
            ]),
          }),
        );

      const restoredState = await page.evaluate(async () => {
        const prompts = await window.api.prompt.getAll();
        const folders = await window.api.folder.getAll();
        return {
          prompts: prompts.map((prompt) => ({
            id: prompt.id,
            title: prompt.title,
            folderId: prompt.folderId,
          })),
          folders: folders.map((folder) => ({
            id: folder.id,
            name: folder.name,
          })),
        };
      });

      expect(restoredState.prompts).toHaveLength(2);
      expect(restoredState.folders).toHaveLength(2);
      expect(restoredState.prompts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ title: "Deploy Checklist" }),
          expect.objectContaining({ title: "Remote Prompt" }),
        ]),
      );
      expect(restoredState.folders).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "Ops" }),
          expect.objectContaining({ name: "Remote Folder" }),
        ]),
      );

      const remotePrompt = restoredState.prompts.find(
        (prompt) => prompt.title === "Remote Prompt",
      );
      const remoteFolder = restoredState.folders.find(
        (folder) => folder.name === "Remote Folder",
      );
      expect(remotePrompt?.folderId).toBe(remoteFolder?.id);
    } finally {
      await closePromptHub(app, userDataDir);
      await server.stop();
    }
  });
});
