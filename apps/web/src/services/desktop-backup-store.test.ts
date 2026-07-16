import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DEFAULT_SETTINGS,
  type SelfHostedBackupSnapshot,
} from "@prompthub/shared";
import { DesktopBackupStore } from "./desktop-backup-store.js";

function createSnapshot(title: string): SelfHostedBackupSnapshot {
  return {
    version: "desktop-backup-v1",
    exportedAt: "2026-07-16T00:00:00.000Z",
    prompts: [
      {
        id: `prompt-${title}`,
        title,
        userPrompt: `${title} body`,
        variables: [],
        tags: [],
        folderId: null,
        images: [],
        videos: [],
        isFavorite: false,
        isPinned: false,
        version: 1,
        currentVersion: 1,
        usageCount: 0,
        createdAt: "2026-07-16T00:00:00.000Z",
        updatedAt: "2026-07-16T00:00:00.000Z",
      },
    ],
    promptVersions: [],
    folders: [],
    skills: [],
    skillVersions: [],
    settings: DEFAULT_SETTINGS,
  };
}

function getOnlySnapshotFile(rootDir: string): string {
  const backupFiles = fs
    .readdirSync(path.join(rootDir, "desktop"), {
      recursive: true,
      withFileTypes: true,
    })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"));
  expect(backupFiles).toHaveLength(1);
  return path.join(backupFiles[0]!.parentPath, backupFiles[0]!.name);
}

describe("DesktopBackupStore", () => {
  it("stores immutable per-user snapshots and prunes only after a newer snapshot is durable", () => {
    const rootDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-desktop-backup-store-"),
    );
    let tick = 0;
    const store = new DesktopBackupStore({
      rootDir,
      retentionLimit: 2,
      now: () => new Date(`2026-07-16T00:00:0${tick++}.000Z`),
      createId: () => `backup-${tick}`,
    });

    try {
      store.create("user-a", {
        clientVersion: "0.5.9",
        serverVersion: "0.5.9",
        snapshot: createSnapshot("first"),
      });
      store.create("user-a", {
        clientVersion: "0.5.9",
        serverVersion: "0.5.9",
        snapshot: createSnapshot("second"),
      });
      store.create("user-a", {
        clientVersion: "0.5.9",
        serverVersion: "0.5.9",
        snapshot: createSnapshot("third"),
      });

      const listed = store.list("user-a");
      expect(listed).toHaveLength(2);
      expect(listed.map((item) => item.summary.prompts)).toEqual([1, 1]);
      expect(store.readLatest("user-a").snapshot.prompts[0]?.title).toBe(
        "third",
      );
      expect(store.list("user-b")).toEqual([]);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects a tampered latest snapshot instead of silently restoring older data", () => {
    const rootDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-desktop-backup-tamper-"),
    );
    const store = new DesktopBackupStore({
      rootDir,
      now: () => new Date("2026-07-16T00:00:00.000Z"),
      createId: () => "backup-tamper",
    });

    try {
      const metadata = store.create("user-a", {
        clientVersion: "0.5.9",
        serverVersion: "0.5.9",
        snapshot: createSnapshot("original"),
      });
      const filePath = getOnlySnapshotFile(rootDir);
      const envelope = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
        snapshot: SelfHostedBackupSnapshot;
      };
      envelope.snapshot.prompts[0]!.title = "tampered";
      fs.writeFileSync(filePath, JSON.stringify(envelope), "utf8");

      expect(() => store.readLatest("user-a")).toThrow(
        "backup checksum mismatch",
      );
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("summarizes optional prompt graph and Agent asset collections", () => {
    const rootDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-desktop-backup-summary-"),
    );
    const store = new DesktopBackupStore({ rootDir });
    const snapshot = createSnapshot("assets");
    snapshot.rules = [];
    snapshot.promptRelations = [
      {
        id: "relation-1",
        sourcePromptId: "prompt-assets",
        targetPromptId: "prompt-assets",
        kind: "related_to",
        createdAt: "2026-07-16T00:00:00.000Z",
        updatedAt: "2026-07-16T00:00:00.000Z",
      },
    ];
    snapshot.outputFormatItems = [
      {
        id: "output-1",
        sourcePromptId: "prompt-assets",
        targetPromptId: null,
        sortOrder: 0,
        createdAt: "2026-07-16T00:00:00.000Z",
        updatedAt: "2026-07-16T00:00:00.000Z",
      },
    ];
    snapshot.mcpLibrary = {
      kind: "prompthub-mcp-library",
      version: 1,
      updatedAt: "2026-07-16T00:00:00.000Z",
      servers: [
        {
          id: "mcp-1",
          name: "mcp",
          displayName: "MCP",
          transport: "stdio",
          command: "node",
          enabled: true,
          source: { type: "manual" },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      bindings: [],
    };
    snapshot.pluginLibrary = {
      kind: "prompthub-plugin-library",
      version: 1,
      updatedAt: "2026-07-16T00:00:00.000Z",
      plugins: [
        {
          id: "plugin-1",
          name: "plugin",
          displayName: "Plugin",
          trustLevel: "custom",
          inventory: {
            skills: 0,
            mcpServers: 0,
            apps: 0,
            commands: 0,
            hooks: 0,
            agents: 0,
            assets: 0,
            docs: 0,
            lspServers: 0,
            scripts: 0,
          },
          classification: "bundle",
          source: { kind: "local" },
          installedAt: 1,
          updatedAt: 1,
        },
      ],
    };

    try {
      const metadata = store.create("user-a", {
        clientVersion: "0.5.9",
        serverVersion: "0.5.9",
        snapshot,
      });
      expect(metadata.summary).toMatchObject({
        promptRelations: 1,
        outputFormatItems: 1,
        mcpServers: 1,
        plugins: 1,
      });
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects invalid identities before a snapshot file is created", () => {
    const rootDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-desktop-backup-identity-"),
    );
    const invalidIdStore = new DesktopBackupStore({
      rootDir,
      createId: () => "../escape",
    });

    try {
      expect(() => invalidIdStore.list(" ")).toThrow(
        "Backup user ID is required",
      );
      expect(() =>
        invalidIdStore.create("user-a", {
          clientVersion: "0.5.9",
          serverVersion: "0.5.9",
          snapshot: createSnapshot("invalid-id"),
        }),
      ).toThrow("unsupported characters");
      expect(
        fs
          .readdirSync(path.join(rootDir, "desktop"), { recursive: true })
          .some((entry) => String(entry).endsWith(".json")),
      ).toBe(false);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("returns an empty list before backup directories exist", () => {
    const rootDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-desktop-backup-empty-"),
    );
    const missingBase = path.join(rootDir, "missing-base");
    const store = new DesktopBackupStore({ rootDir: missingBase });

    try {
      expect(store.list("user-a")).toEqual([]);
      fs.mkdirSync(missingBase);
      expect(store.list("user-a")).toEqual([]);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("propagates filesystem inspection failures instead of treating them as missing directories", () => {
    const rootDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-desktop-backup-lstat-error-"),
    );
    const store = new DesktopBackupStore({ rootDir });
    const inspectionError = Object.assign(new Error("permission denied"), {
      code: "EACCES",
    });
    const lstatSpy = vi.spyOn(fs, "lstatSync").mockImplementation(() => {
      throw inspectionError;
    });

    try {
      expect(() => store.list("user-a")).toThrow(inspectionError);
    } finally {
      lstatSpy.mockRestore();
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects invalid JSON and malformed envelopes", () => {
    const rootDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-desktop-backup-envelope-"),
    );
    const store = new DesktopBackupStore({ rootDir });

    try {
      store.create("user-a", {
        clientVersion: "0.5.9",
        serverVersion: "0.5.9",
        snapshot: createSnapshot("envelope"),
      });
      const filePath = getOnlySnapshotFile(rootDir);
      fs.writeFileSync(filePath, "not-json", "utf8");
      expect(() => store.readLatest("user-a")).toThrow("not valid JSON");

      fs.writeFileSync(filePath, "null", "utf8");
      expect(() => store.readLatest("user-a")).toThrow("envelope is invalid");
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("never overwrites an existing immutable snapshot on an ID collision", () => {
    const rootDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-desktop-backup-collision-"),
    );
    const store = new DesktopBackupStore({
      rootDir,
      now: () => new Date("2026-07-16T00:00:00.000Z"),
      createId: () => "same-id",
    });

    try {
      store.create("user-a", {
        clientVersion: "0.5.9",
        serverVersion: "0.5.9",
        snapshot: createSnapshot("original"),
      });

      expect(() =>
        store.create("user-a", {
          clientVersion: "0.5.9",
          serverVersion: "0.5.9",
          snapshot: createSnapshot("replacement"),
        }),
      ).toThrow();
      expect(store.readLatest("user-a").snapshot.prompts[0]?.title).toBe(
        "original",
      );
      const [userDirName] = fs.readdirSync(path.join(rootDir, "desktop"));
      const storedEntries = fs.readdirSync(
        path.join(rootDir, "desktop", userDirName!),
      );
      expect(
        storedEntries.filter((entry) => entry.endsWith(".json")),
      ).toHaveLength(1);
      expect(storedEntries.some((entry) => entry.endsWith(".tmp"))).toBe(false);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it.skipIf(process.platform === "win32")(
    "keeps the previous latest snapshot when final directory durability fails",
    () => {
      const rootDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "prompthub-desktop-backup-durability-"),
      );
      let tick = 0;
      const store = new DesktopBackupStore({
        rootDir,
        now: () => new Date(`2026-07-16T00:00:0${tick}.000Z`),
        createId: () => `backup-${tick++}`,
      });

      try {
        store.create("user-a", {
          clientVersion: "0.5.9",
          serverVersion: "0.5.9",
          snapshot: createSnapshot("original"),
        });
        let fsyncCall = 0;
        const fsyncSpy = vi.spyOn(fs, "fsyncSync").mockImplementation(() => {
          fsyncCall += 1;
          if (fsyncCall === 2) {
            throw new Error("simulated directory fsync failure");
          }
        });

        expect(() =>
          store.create("user-a", {
            clientVersion: "0.5.9",
            serverVersion: "0.5.9",
            snapshot: createSnapshot("not-durable"),
          }),
        ).toThrow("simulated directory fsync failure");
        fsyncSpy.mockRestore();

        expect(store.readLatest("user-a").snapshot.prompts[0]?.title).toBe(
          "original",
        );
        const [userDirName] = fs.readdirSync(path.join(rootDir, "desktop"));
        const storedEntries = fs.readdirSync(
          path.join(rootDir, "desktop", userDirName!),
        );
        expect(
          storedEntries.filter((entry) => entry.endsWith(".json")),
        ).toHaveLength(1);
        expect(storedEntries.some((entry) => entry.endsWith(".tmp"))).toBe(
          false,
        );
      } finally {
        vi.restoreAllMocks();
        fs.rmSync(rootDir, { recursive: true, force: true });
      }
    },
  );

  it.skipIf(process.platform === "win32")(
    "rejects a symlinked backup root before creating any external user data",
    () => {
      const rootDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "prompthub-desktop-backup-symlink-"),
      );
      const externalDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "prompthub-desktop-backup-external-"),
      );
      fs.symlinkSync(externalDir, path.join(rootDir, "desktop"), "dir");
      const store = new DesktopBackupStore({ rootDir });

      try {
        expect(() =>
          store.create("user-a", {
            clientVersion: "0.5.9",
            serverVersion: "0.5.9",
            snapshot: createSnapshot("must-not-escape"),
          }),
        ).toThrow("backup directory must be a real directory");
        expect(fs.readdirSync(externalDir)).toEqual([]);
        expect(() => store.list("user-a")).toThrow(
          "backup directory must be a real directory",
        );
      } finally {
        fs.rmSync(rootDir, { recursive: true, force: true });
        fs.rmSync(externalDir, { recursive: true, force: true });
      }
    },
  );
});
