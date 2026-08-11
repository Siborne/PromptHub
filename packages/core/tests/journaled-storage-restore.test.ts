import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getStorageRestoreJournalPath,
  readStorageRestoreJournalState,
  recoverJournaledStorageRestore,
  runJournaledStorageRestore,
  type StorageRestorePublicationStage,
} from "../src/journaled-storage-restore";
import { assertStorageMaintenanceAvailable } from "../src/storage-maintenance-intent";
import { acquireStorageMaintenanceIntent } from "../src/storage-maintenance-intent";

describe("journaled storage restore", () => {
  const roots: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function fixture(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "prompthub-restore-"));
    roots.push(root);
    fs.mkdirSync(path.join(root, "data"), { recursive: true });
    fs.mkdirSync(path.join(root, "config"), { recursive: true });
    fs.writeFileSync(path.join(root, "data", "library.txt"), "before");
    fs.writeFileSync(path.join(root, "config", "app.json"), '{"before":true}');
    return root;
  }

  async function leaveInterruptedRestore(
    root: string,
    operationId: string,
    failureStage: StorageRestorePublicationStage,
    entryNames = ["data"],
  ): Promise<Record<string, any>> {
    const interruption = Object.assign(new Error("interrupted"), {
      leaveOperationForRecovery: true,
    });
    await expect(
      runJournaledStorageRestore({
        activeRoot: root,
        operationId,
        entryNames,
        prepareCandidate: (stageRoot) => {
          for (const entryName of entryNames) {
            const entryPath = path.join(stageRoot, entryName);
            fs.mkdirSync(entryPath, { recursive: true });
            fs.writeFileSync(path.join(entryPath, "candidate.txt"), "after");
          }
        },
        verifyCandidate: () => undefined,
        verifyActive: () => undefined,
        injectFailure: (stage) => {
          if (stage === failureStage) throw interruption;
        },
      }),
    ).rejects.toThrow("interrupted");
    return JSON.parse(
      fs.readFileSync(getStorageRestoreJournalPath(root), "utf8"),
    );
  }

  it("publishes all prepared domains and preserves the prior set as one artifact", async () => {
    const root = fixture();
    const result = await runJournaledStorageRestore({
      activeRoot: root,
      operationId: "restore-1",
      entryNames: ["data", "config"],
      prepareCandidate: (stageRoot) => {
        fs.mkdirSync(path.join(stageRoot, "data"), { recursive: true });
        fs.mkdirSync(path.join(stageRoot, "config"), { recursive: true });
        fs.writeFileSync(path.join(stageRoot, "data", "library.txt"), "after");
        fs.writeFileSync(
          path.join(stageRoot, "config", "app.json"),
          '{"after":true}',
        );
      },
      verifyCandidate: (stageRoot) => {
        expect(
          fs.readFileSync(path.join(stageRoot, "data", "library.txt"), "utf8"),
        ).toBe("after");
      },
      verifyActive: (activeRoot) => {
        expect(
          fs.readFileSync(path.join(activeRoot, "data", "library.txt"), "utf8"),
        ).toBe("after");
      },
    });

    expect(result.status).toBe("committed");
    expect(
      fs.readFileSync(path.join(root, "data", "library.txt"), "utf8"),
    ).toBe("after");
    expect(
      fs.readFileSync(
        path.join(result.recoveryArtifactPath, "root", "data", "library.txt"),
        "utf8",
      ),
    ).toBe("before");
    expect(fs.existsSync(getStorageRestoreJournalPath(root))).toBe(false);
  });

  it("rolls every entry back when verification fails after publication", async () => {
    const root = fixture();
    await expect(
      runJournaledStorageRestore({
        activeRoot: root,
        operationId: "restore-fail",
        entryNames: ["data", "config"],
        prepareCandidate: (stageRoot) => {
          fs.mkdirSync(path.join(stageRoot, "data"), { recursive: true });
          fs.mkdirSync(path.join(stageRoot, "config"), { recursive: true });
          fs.writeFileSync(
            path.join(stageRoot, "data", "library.txt"),
            "broken",
          );
        },
        verifyCandidate: () => undefined,
        verifyActive: () => {
          throw new Error("domain invariant failed");
        },
      }),
    ).rejects.toThrow("domain invariant failed");

    expect(
      fs.readFileSync(path.join(root, "data", "library.txt"), "utf8"),
    ).toBe("before");
    expect(fs.readFileSync(path.join(root, "config", "app.json"), "utf8")).toBe(
      '{"before":true}',
    );
    expect(fs.existsSync(getStorageRestoreJournalPath(root))).toBe(false);
  });

  it("resolves an interrupted swap before startup services open", async () => {
    const root = fixture();
    await expect(
      runJournaledStorageRestore({
        activeRoot: root,
        operationId: "restore-restart",
        entryNames: ["data", "config"],
        prepareCandidate: (stageRoot) => {
          fs.mkdirSync(path.join(stageRoot, "data"), { recursive: true });
          fs.mkdirSync(path.join(stageRoot, "config"), { recursive: true });
          fs.writeFileSync(
            path.join(stageRoot, "data", "library.txt"),
            "after",
          );
          fs.writeFileSync(path.join(stageRoot, "config", "app.json"), "after");
        },
        verifyCandidate: () => undefined,
        verifyActive: () => undefined,
        injectFailure: (stage: StorageRestorePublicationStage) => {
          if (stage === "entry-swapped:data") {
            throw Object.assign(new Error("power loss"), {
              leaveOperationForRecovery: true,
            });
          }
        },
      }),
    ).rejects.toThrow("power loss");
    expect(fs.existsSync(getStorageRestoreJournalPath(root))).toBe(true);

    const recovered = await recoverJournaledStorageRestore({
      activeRoot: root,
      verifyActive: (activeRoot) => {
        expect(() => assertStorageMaintenanceAvailable(root)).toThrow(
          "storage maintenance",
        );
        expect(
          fs.readFileSync(path.join(activeRoot, "data", "library.txt"), "utf8"),
        ).toBe("after");
        expect(
          fs.readFileSync(path.join(activeRoot, "config", "app.json"), "utf8"),
        ).toBe("after");
      },
    });
    expect(recovered.status).toBe("committed");
    expect(() => assertStorageMaintenanceAvailable(root)).not.toThrow();
    expect(fs.existsSync(getStorageRestoreJournalPath(root))).toBe(false);
  });

  it("rejects unsafe entry names before creating staging state", async () => {
    const root = fixture();
    await expect(
      runJournaledStorageRestore({
        activeRoot: root,
        operationId: "unsafe",
        entryNames: ["../outside"],
        prepareCandidate: () => undefined,
        verifyCandidate: () => undefined,
        verifyActive: () => undefined,
      }),
    ).rejects.toThrow("Invalid restore entry");
    expect(fs.existsSync(path.join(path.dirname(root), "outside"))).toBe(false);
  });

  it("reuses one verified maintenance barrier for staged authority work", async () => {
    const root = fixture();
    const maintenance = acquireStorageMaintenanceIntent(root, {
      operationId: "authority-restore",
      operationKind: "canonical-authority",
    });
    try {
      await expect(
        runJournaledStorageRestore({
          activeRoot: root,
          operationId: "different-operation",
          maintenanceOperationId: "authority-restore",
          entryNames: ["data"],
          prepareCandidate: () => undefined,
          verifyCandidate: () => undefined,
          verifyActive: () => undefined,
        }),
      ).rejects.toThrow("does not own maintenance intent");

      const result = await runJournaledStorageRestore({
        activeRoot: root,
        maintenanceOperationId: "authority-restore",
        entryNames: ["data"],
        prepareCandidate: (stageRoot) => {
          fs.mkdirSync(path.join(stageRoot, "data"), { recursive: true });
          fs.writeFileSync(
            path.join(stageRoot, "data", "library.txt"),
            "after",
          );
        },
        verifyCandidate: () => undefined,
        verifyActive: () => undefined,
      });
      expect(result.operationId).toBe("authority-restore");
    } finally {
      maintenance.release();
    }
  });

  it("rejects unsafe roots, operation ids, entry lists, and existing operation paths", async () => {
    const root = fixture();
    const unsafeRoot = fixture();
    fs.rmSync(unsafeRoot, { recursive: true });
    fs.writeFileSync(unsafeRoot, "unsafe");
    await expect(
      runJournaledStorageRestore({
        activeRoot: unsafeRoot,
        operationId: "unsafe-root",
        entryNames: ["data"],
        prepareCandidate: () => undefined,
        verifyCandidate: () => undefined,
        verifyActive: () => undefined,
      }),
    ).rejects.toThrow(/active root is unsafe/);
    await expect(
      runJournaledStorageRestore({
        activeRoot: root,
        operationId: "invalid/id",
        entryNames: ["data"],
        prepareCandidate: () => undefined,
        verifyCandidate: () => undefined,
        verifyActive: () => undefined,
      }),
    ).rejects.toThrow(/Invalid storage restore operation id/);
    for (const entryNames of [[], ["data", "data"]]) {
      await expect(
        runJournaledStorageRestore({
          activeRoot: root,
          operationId: `invalid-entries-${entryNames.length}`,
          entryNames,
          prepareCandidate: () => undefined,
          verifyCandidate: () => undefined,
          verifyActive: () => undefined,
        }),
      ).rejects.toThrow(/Invalid restore entry list/);
    }

    const operationId = "existing-stage";
    fs.mkdirSync(path.join(root, `.prompthub-restore-stage-${operationId}`));
    await expect(
      runJournaledStorageRestore({
        activeRoot: root,
        operationId,
        entryNames: ["data"],
        prepareCandidate: () => undefined,
        verifyCandidate: () => undefined,
        verifyActive: () => undefined,
      }),
    ).rejects.toThrow(/operation path already exists/);
  });

  it("removes staging when preparation, declaration, or candidate verification fails", async () => {
    for (const mode of ["prepare", "undeclared", "verify"] as const) {
      const root = fixture();
      const operationId = `preflight-${mode}`;
      await expect(
        runJournaledStorageRestore({
          activeRoot: root,
          operationId,
          entryNames: ["data"],
          prepareCandidate: (stageRoot) => {
            if (mode === "prepare") throw new Error("prepare failed");
            fs.mkdirSync(path.join(stageRoot, "data"));
            fs.writeFileSync(path.join(stageRoot, "data", "value"), "after");
            if (mode === "undeclared") {
              fs.mkdirSync(path.join(stageRoot, "config"));
            }
          },
          verifyCandidate: () => {
            if (mode === "verify") throw new Error("candidate invalid");
          },
          verifyActive: () => undefined,
        }),
      ).rejects.toThrow();
      expect(
        fs.existsSync(
          path.join(root, `.prompthub-restore-stage-${operationId}`),
        ),
      ).toBe(false);
      expect(fs.existsSync(getStorageRestoreJournalPath(root))).toBe(false);
    }
  });

  it("enforces configurable candidate depth, entry, byte, and numeric limits", async () => {
    const cases = [
      {
        id: "depth",
        limits: { maxDepth: 1 },
        prepare: (stageRoot: string) => {
          fs.mkdirSync(path.join(stageRoot, "data", "nested"), {
            recursive: true,
          });
        },
        error: /depth limit/,
      },
      {
        id: "entries",
        limits: { maxEntries: 1 },
        prepare: (stageRoot: string) => {
          fs.mkdirSync(path.join(stageRoot, "data"), { recursive: true });
          fs.writeFileSync(path.join(stageRoot, "data", "value"), "after");
        },
        error: /entry limit/,
      },
      {
        id: "bytes",
        limits: { maxBytes: 1 },
        prepare: (stageRoot: string) => {
          fs.mkdirSync(path.join(stageRoot, "data"), { recursive: true });
          fs.writeFileSync(path.join(stageRoot, "data", "value"), "after");
        },
        error: /byte limit/,
      },
    ];
    for (const testCase of cases) {
      const root = fixture();
      await expect(
        runJournaledStorageRestore({
          activeRoot: root,
          operationId: `candidate-${testCase.id}`,
          entryNames: ["data"],
          candidateLimits: testCase.limits,
          prepareCandidate: testCase.prepare,
          verifyCandidate: () => undefined,
          verifyActive: () => undefined,
        }),
      ).rejects.toThrow(testCase.error);
    }
    const invalid = fixture();
    await expect(
      runJournaledStorageRestore({
        activeRoot: invalid,
        operationId: "candidate-invalid-limit",
        entryNames: ["data"],
        candidateLimits: { maxEntries: 0 },
        prepareCandidate: () => undefined,
        verifyCandidate: () => undefined,
        verifyActive: () => undefined,
      }),
    ).rejects.toThrow(/positive safe integer/);
  });

  it.skipIf(process.platform === "win32")(
    "rejects symbolic links inside a candidate",
    async () => {
      const root = fixture();
      const outside = path.join(root, "outside");
      fs.writeFileSync(outside, "outside");
      await expect(
        runJournaledStorageRestore({
          activeRoot: root,
          operationId: "candidate-link",
          entryNames: ["data"],
          prepareCandidate: (stageRoot) => {
            fs.mkdirSync(path.join(stageRoot, "data"));
            fs.symlinkSync(outside, path.join(stageRoot, "data", "linked"));
          },
          verifyCandidate: () => undefined,
          verifyActive: () => undefined,
        }),
      ).rejects.toThrow(/contains symbolic link/);
    },
  );

  it("rejects a special file observed in a candidate", async () => {
    const root = fixture();
    const specialPath = path.join(
      root,
      ".prompthub-restore-stage-candidate-special",
      "data",
      "value",
    );
    const originalLstat = fs.lstatSync.bind(fs);
    vi.spyOn(fs, "lstatSync").mockImplementation((target, options) => {
      const stats = originalLstat(target, options as never);
      if (path.resolve(String(target)) !== specialPath) return stats;
      return Object.assign(Object.create(stats), {
        isDirectory: () => false,
        isFile: () => false,
        isSymbolicLink: () => false,
      });
    });
    await expect(
      runJournaledStorageRestore({
        activeRoot: root,
        operationId: "candidate-special",
        entryNames: ["data"],
        prepareCandidate: (stageRoot) => {
          fs.mkdirSync(path.join(stageRoot, "data"));
          fs.writeFileSync(path.join(stageRoot, "data", "value"), "after");
        },
        verifyCandidate: () => undefined,
        verifyActive: () => undefined,
      }),
    ).rejects.toThrow(/contains special file/);
  });

  it("reports no recovery without a journal and rolls back a prepared journal", async () => {
    const emptyRoot = fixture();
    expect(readStorageRestoreJournalState(emptyRoot)).toBeNull();
    await expect(
      recoverJournaledStorageRestore({
        activeRoot: emptyRoot,
        verifyActive: () => undefined,
      }),
    ).resolves.toEqual({ status: "none" });

    const preparedRoot = fixture();
    await leaveInterruptedRestore(
      preparedRoot,
      "prepared-recovery",
      "prepared",
    );
    expect(readStorageRestoreJournalState(preparedRoot)).toMatchObject({
      operationId: "prepared-recovery",
      state: "prepared",
      currentEntry: null,
      swappedEntries: [],
    });
    await expect(
      recoverJournaledStorageRestore({
        activeRoot: preparedRoot,
        verifyActive: () => undefined,
      }),
    ).resolves.toEqual({
      status: "rolled-back",
      operationId: "prepared-recovery",
    });
  });

  it("blocks a new restore while a durable journal is pending", async () => {
    const root = fixture();
    await leaveInterruptedRestore(root, "pending-restore", "prepared");

    await expect(
      runJournaledStorageRestore({
        activeRoot: root,
        operationId: "second-restore",
        entryNames: ["data"],
        prepareCandidate: () => undefined,
        verifyCandidate: () => undefined,
        verifyActive: () => undefined,
      }),
    ).rejects.toThrow(/already pending/);
  });

  it("rejects malformed, unsafe, and root-escaping restore journals", async () => {
    const malformedRoot = fixture();
    const malformedPath = getStorageRestoreJournalPath(malformedRoot);
    fs.mkdirSync(path.dirname(malformedPath), { recursive: true });
    fs.writeFileSync(malformedPath, "{}\n");
    expect(() => readStorageRestoreJournalState(malformedRoot)).toThrow(
      /Invalid storage restore journal/,
    );

    const unsafeRoot = fixture();
    const unsafePath = getStorageRestoreJournalPath(unsafeRoot);
    fs.mkdirSync(unsafePath, { recursive: true });
    await expect(
      recoverJournaledStorageRestore({
        activeRoot: unsafeRoot,
        verifyActive: () => undefined,
      }),
    ).rejects.toThrow(/Invalid storage restore journal/);

    const escapingRoot = fixture();
    const escapingPath = getStorageRestoreJournalPath(escapingRoot);
    fs.mkdirSync(path.dirname(escapingPath), { recursive: true });
    fs.writeFileSync(
      escapingPath,
      JSON.stringify({
        formatVersion: 1,
        kind: "prompthub-journaled-storage-restore",
        operationId: "escape-journal",
        state: "prepared",
        activeRoot: escapingRoot,
        stageRoot: path.join(path.dirname(escapingRoot), "outside-stage"),
        priorRoot: path.join(
          escapingRoot,
          ".prompthub-restore-prior-escape-journal",
        ),
        entryNames: ["data"],
        swappedEntries: [],
        currentEntry: null,
        createdAt: "2026-08-12T00:00:00.000Z",
        updatedAt: "2026-08-12T00:00:00.000Z",
      }),
    );
    await expect(
      recoverJournaledStorageRestore({
        activeRoot: escapingRoot,
        verifyActive: () => undefined,
      }),
    ).rejects.toThrow(/escapes active root/);

    const invalidEntriesRoot = fixture();
    const invalidEntriesJournal = await leaveInterruptedRestore(
      invalidEntriesRoot,
      "invalid-journal-entries",
      "prepared",
    );
    invalidEntriesJournal.entryNames = [42];
    fs.writeFileSync(
      getStorageRestoreJournalPath(invalidEntriesRoot),
      JSON.stringify(invalidEntriesJournal),
    );
    expect(() => readStorageRestoreJournalState(invalidEntriesRoot)).toThrow(
      /Invalid storage restore journal/,
    );
  });

  it.skipIf(process.platform === "win32")(
    "rejects a symlinked restore journal",
    async () => {
      const root = fixture();
      const journalPath = getStorageRestoreJournalPath(root);
      fs.mkdirSync(path.dirname(journalPath), { recursive: true });
      const outside = path.join(root, "outside-journal.json");
      fs.writeFileSync(outside, "{}\n");
      fs.symlinkSync(outside, journalPath);
      await expect(
        recoverJournaledStorageRestore({
          activeRoot: root,
          verifyActive: () => undefined,
        }),
      ).rejects.toThrow(/Invalid storage restore journal/);
    },
  );

  it("cleans its temporary journal after an atomic journal rename failure", async () => {
    const root = fixture();
    const originalRename = fs.renameSync.bind(fs);
    vi.spyOn(fs, "renameSync").mockImplementation((from, to) => {
      if (String(from).includes("full-restore.json.tmp-")) {
        throw new Error("journal rename failed");
      }
      return originalRename(from, to);
    });

    await expect(
      runJournaledStorageRestore({
        activeRoot: root,
        operationId: "journal-write-failure",
        entryNames: ["data"],
        prepareCandidate: (stageRoot) => {
          fs.mkdirSync(path.join(stageRoot, "data"));
        },
        verifyCandidate: () => undefined,
        verifyActive: () => undefined,
      }),
    ).rejects.toThrow("journal rename failed");
    expect(
      fs
        .readdirSync(path.dirname(getStorageRestoreJournalPath(root)))
        .some((entry) => entry.includes("full-restore.json.tmp-")),
    ).toBe(false);
  });

  it("allocates a default operation id and tolerates unavailable directory fsync", async () => {
    const root = fixture();
    const journalDirectory = path.dirname(getStorageRestoreJournalPath(root));
    const originalOpen = fs.openSync.bind(fs);
    vi.spyOn(fs, "openSync").mockImplementation((target, flags, mode) => {
      if (path.resolve(String(target)) === journalDirectory && flags === "r") {
        throw Object.assign(new Error("directory fsync unavailable"), {
          code: "EINVAL",
        });
      }
      return originalOpen(target, flags, mode);
    });

    const result = await runJournaledStorageRestore({
      activeRoot: root,
      entryNames: ["data"],
      prepareCandidate: (stageRoot) => {
        fs.mkdirSync(path.join(stageRoot, "data"));
        fs.writeFileSync(path.join(stageRoot, "data", "value"), "after");
      },
      verifyCandidate: () => undefined,
      verifyActive: () => undefined,
    });

    expect(result.operationId).toMatch(/^[a-f0-9-]{36}$/);
  });

  it("finishes each recoverable entry publication layout", async () => {
    for (const layout of [
      "active-and-candidate",
      "candidate-only",
      "prior-and-candidate",
    ] as const) {
      const root = fixture();
      const journal = await leaveInterruptedRestore(
        root,
        `layout-${layout}`,
        "entry-swapping:data",
      );
      const activePath = path.join(root, "data");
      const priorPath = path.join(journal.priorRoot, "data");
      if (layout === "candidate-only") {
        fs.rmSync(activePath, { recursive: true });
      }
      if (layout === "prior-and-candidate") {
        fs.mkdirSync(path.dirname(priorPath), { recursive: true });
        fs.renameSync(activePath, priorPath);
      }

      const recovered = await recoverJournaledStorageRestore({
        activeRoot: root,
        verifyActive: () => undefined,
      });
      expect(recovered.status).toBe("committed");
      expect(
        fs.readFileSync(path.join(root, "data", "candidate.txt"), "utf8"),
      ).toBe("after");
    }
  });

  it("rolls back an ambiguous publication and a failed active verification", async () => {
    const ambiguousRoot = fixture();
    const ambiguousJournal = await leaveInterruptedRestore(
      ambiguousRoot,
      "ambiguous-layout",
      "entry-swapping:data",
    );
    const ambiguousPrior = path.join(ambiguousJournal.priorRoot, "data");
    fs.mkdirSync(path.dirname(ambiguousPrior), { recursive: true });
    fs.cpSync(path.join(ambiguousRoot, "data"), ambiguousPrior, {
      recursive: true,
    });
    await expect(
      recoverJournaledStorageRestore({
        activeRoot: ambiguousRoot,
        verifyActive: () => undefined,
      }),
    ).resolves.toMatchObject({ status: "rolled-back" });
    expect(
      fs.readFileSync(path.join(ambiguousRoot, "data", "library.txt"), "utf8"),
    ).toBe("before");

    const verificationRoot = fixture();
    await leaveInterruptedRestore(
      verificationRoot,
      "recovery-verification",
      "entry-swapped:data",
    );
    await expect(
      recoverJournaledStorageRestore({
        activeRoot: verificationRoot,
        verifyActive: () => {
          throw new Error("recovered state invalid");
        },
      }),
    ).resolves.toMatchObject({ status: "rolled-back" });
    expect(
      fs.readFileSync(
        path.join(verificationRoot, "data", "library.txt"),
        "utf8",
      ),
    ).toBe("before");
  });

  it("reports recovery-required when both completion and rollback fail", async () => {
    const root = fixture();
    const journal = await leaveInterruptedRestore(
      root,
      "recovery-required",
      "entry-swapped:data",
    );
    const priorPath = path.join(journal.priorRoot, "data");
    const originalRename = fs.renameSync.bind(fs);
    vi.spyOn(fs, "renameSync").mockImplementation((from, to) => {
      if (path.resolve(String(from)) === priorPath) {
        throw new Error("rollback rename failed");
      }
      return originalRename(from, to);
    });

    await expect(
      recoverJournaledStorageRestore({
        activeRoot: root,
        verifyActive: () => Promise.reject("completion failed"),
      }),
    ).resolves.toMatchObject({
      status: "recovery-required",
      operationId: "recovery-required",
      reason: expect.stringContaining(
        "Recovery failed: completion failed; rollback failed: rollback rename failed",
      ),
    });
    expect(fs.existsSync(getStorageRestoreJournalPath(root))).toBe(true);
  });

  it("removes a newly introduced entry when rollback has no prior copy", async () => {
    const root = fixture();
    await expect(
      runJournaledStorageRestore({
        activeRoot: root,
        operationId: "new-entry-rollback",
        entryNames: ["skills"],
        prepareCandidate: (stageRoot) => {
          fs.mkdirSync(path.join(stageRoot, "skills"));
          fs.writeFileSync(path.join(stageRoot, "skills", "value"), "new");
        },
        verifyCandidate: () => undefined,
        verifyActive: () => {
          throw new Error("verification failed");
        },
      }),
    ).rejects.toThrow("verification failed");
    expect(fs.existsSync(path.join(root, "skills"))).toBe(false);
  });

  it("returns none when a journal disappears while recovery acquires maintenance", async () => {
    const root = fixture();
    await leaveInterruptedRestore(root, "journal-race", "prepared");
    const journalPath = getStorageRestoreJournalPath(root);
    const originalLstat = fs.lstatSync.bind(fs);
    let journalReads = 0;
    vi.spyOn(fs, "lstatSync").mockImplementation((target, options) => {
      if (path.resolve(String(target)) === journalPath) {
        journalReads += 1;
        if (journalReads === 2) {
          fs.rmSync(journalPath);
          throw Object.assign(new Error("missing"), { code: "ENOENT" });
        }
      }
      return originalLstat(target, options as never);
    });

    await expect(
      recoverJournaledStorageRestore({
        activeRoot: root,
        verifyActive: () => undefined,
      }),
    ).resolves.toEqual({ status: "none" });
  });

  it("commits a durable committed journal even when its prior tree disappeared", async () => {
    const root = fixture();
    const journal = await leaveInterruptedRestore(
      root,
      "committed-no-prior",
      "committed",
    );
    fs.rmSync(journal.priorRoot, { recursive: true });

    const recovered = await recoverJournaledStorageRestore({
      activeRoot: root,
      verifyActive: () => undefined,
    });
    expect(recovered.status).toBe("committed");
    expect(
      fs
        .statSync(path.join(recovered.recoveryArtifactPath!, "root"))
        .isDirectory(),
    ).toBe(true);
  });

  it("rolls back when the recovery artifact identity already exists", async () => {
    const root = fixture();
    await leaveInterruptedRestore(root, "artifact-conflict", "committed");
    fs.mkdirSync(path.join(root, "backups", "recovery", "artifact-conflict"), {
      recursive: true,
    });

    await expect(
      recoverJournaledStorageRestore({
        activeRoot: root,
        verifyActive: () => undefined,
      }),
    ).resolves.toMatchObject({
      status: "rolled-back",
      operationId: "artifact-conflict",
    });
    expect(
      fs.readFileSync(path.join(root, "data", "library.txt"), "utf8"),
    ).toBe("before");
  });

  it("does not fail a committed restore when retention cleanup fails", async () => {
    const root = fixture();
    const recoveryRoot = path.join(root, "backups", "recovery");
    for (let index = 0; index < 11; index += 1) {
      const id = `old-${index}`;
      const artifactPath = path.join(recoveryRoot, id);
      fs.mkdirSync(path.join(artifactPath, "root"), { recursive: true });
      fs.writeFileSync(path.join(artifactPath, "root", "value"), "old");
      fs.writeFileSync(
        path.join(artifactPath, "manifest.json"),
        JSON.stringify({
          formatVersion: 1,
          kind: "storage-restore-recovery-artifact",
          state: "complete",
          id,
          operationId: id,
          artifactType: "pre-restore-state",
          sourceRoot: root,
          createdAt: `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
          validatedAt: `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
        }),
      );
    }
    const failingArtifact = path.join(recoveryRoot, "old-0");
    const originalRemove = fs.rmSync.bind(fs);
    vi.spyOn(fs, "rmSync").mockImplementation((target, options) => {
      if (path.resolve(String(target)) === failingArtifact) {
        throw new Error("retention cleanup failed");
      }
      return originalRemove(target, options);
    });

    await expect(
      runJournaledStorageRestore({
        activeRoot: root,
        operationId: "retention-nonfatal",
        entryNames: ["data"],
        prepareCandidate: (stageRoot) => {
          fs.mkdirSync(path.join(stageRoot, "data"));
          fs.writeFileSync(path.join(stageRoot, "data", "value"), "after");
        },
        verifyCandidate: () => undefined,
        verifyActive: () => undefined,
      }),
    ).resolves.toMatchObject({ status: "committed" });
  });

  it("does not fail committed recovery when retention cleanup fails", async () => {
    const root = fixture();
    await leaveInterruptedRestore(
      root,
      "recovery-retention-nonfatal",
      "committed",
    );
    const recoveryRoot = path.join(root, "backups", "recovery");
    for (let index = 0; index < 11; index += 1) {
      const id = `recovery-old-${index}`;
      const artifactPath = path.join(recoveryRoot, id);
      fs.mkdirSync(path.join(artifactPath, "root"), { recursive: true });
      fs.writeFileSync(path.join(artifactPath, "root", "value"), "old");
      fs.writeFileSync(
        path.join(artifactPath, "manifest.json"),
        JSON.stringify({
          formatVersion: 1,
          kind: "storage-restore-recovery-artifact",
          state: "complete",
          id,
          operationId: id,
          artifactType: "pre-restore-state",
          sourceRoot: root,
          createdAt: `2025-12-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
          validatedAt: `2025-12-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
        }),
      );
    }
    const failingArtifact = path.join(recoveryRoot, "recovery-old-0");
    const originalRemove = fs.rmSync.bind(fs);
    vi.spyOn(fs, "rmSync").mockImplementation((target, options) => {
      if (path.resolve(String(target)) === failingArtifact) {
        throw new Error("recovery retention cleanup failed");
      }
      return originalRemove(target, options);
    });

    await expect(
      recoverJournaledStorageRestore({
        activeRoot: root,
        verifyActive: () => undefined,
      }),
    ).resolves.toMatchObject({ status: "committed" });
  });
});
