import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getResourceBundlePublicationJournalPath,
  getNextResourceBundleRevision,
  publishResourceBundle,
  readResourceBundle,
  recoverCanonicalResourcePublications,
  recoverResourceBundlePublication,
  resolveResourceBundleWriteRevision,
  type ResourceBundlePublicationStage,
  writeResourceBundle,
} from "../src";

const roots: string[] = [];

function root(): string {
  const value = fs.mkdtempSync(
    path.join(os.tmpdir(), "prompthub-bundle-publication-"),
  );
  roots.push(value);
  return value;
}

function source(rootPath: string, content: string): string {
  const sourcePath = path.join(rootPath, `source-${crypto.randomUUID()}.json`);
  fs.writeFileSync(sourcePath, content, "utf8");
  return sourcePath;
}

function input(
  rootPath: string,
  bundlePath: string,
  revision: number,
  content = `{"revision":${revision}}\n`,
) {
  return {
    bundlePath,
    resourceType: "prompt",
    resourceId: "prompt-1",
    schemaVersion: 1,
    revision,
    createdAt: "2026-08-12T00:00:00.000Z",
    updatedAt: `2026-08-12T00:0${revision}:00.000Z`,
    payloads: [
      {
        path: "prompt.json",
        sourcePath: source(rootPath, content),
        role: "current",
      },
    ],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const value of roots.splice(0)) {
    fs.rmSync(value, { recursive: true, force: true });
  }
});

describe("resource bundle publication", () => {
  it("allocates independent monotonically increasing resource revisions", () => {
    const base = root();
    const bundlePath = path.join(base, "data", "prompts", "prompt-1");
    expect(
      getNextResourceBundleRevision(bundlePath, {
        resourceType: "prompt",
        resourceId: "prompt-1",
        minimumRevision: 4,
      }),
    ).toBe(4);
    writeResourceBundle(input(base, bundlePath, 4));
    const revision = getNextResourceBundleRevision(bundlePath, {
      resourceType: "prompt",
      resourceId: "prompt-1",
    });
    writeResourceBundle(input(base, bundlePath, revision), {
      mode: "replace",
    });

    expect(revision).toBe(5);
    expect(readResourceBundle(bundlePath).manifest.revision).toBe(5);
    expect(() =>
      getNextResourceBundleRevision(bundlePath, {
        resourceType: "skill",
        resourceId: "prompt-1",
      }),
    ).toThrow("resource identity does not match");
    expect(() =>
      getNextResourceBundleRevision(bundlePath, {
        resourceType: "prompt",
        resourceId: "prompt-1",
        minimumRevision: 0,
      }),
    ).toThrow("minimum revision is invalid");
  });

  it("atomically replaces a verified bundle with a newer revision", () => {
    const base = root();
    const bundlePath = path.join(base, "data", "prompts", "prompt-1");
    publishResourceBundle(input(base, bundlePath, 1));

    const result = publishResourceBundle(input(base, bundlePath, 2));

    expect(result.replacedRevision).toBe(1);
    expect(result.manifest.revision).toBe(2);
    expect(fs.readFileSync(path.join(bundlePath, "prompt.json"), "utf8")).toBe(
      '{"revision":2}\n',
    );
    expect(
      fs.existsSync(getResourceBundlePublicationJournalPath(bundlePath)),
    ).toBe(false);
  });

  it("rejects stale or conflicting same-revision replacement", () => {
    const base = root();
    const bundlePath = path.join(base, "data", "prompts", "prompt-1");
    publishResourceBundle(input(base, bundlePath, 2));

    expect(() => publishResourceBundle(input(base, bundlePath, 1))).toThrow(
      "older than active revision",
    );
    expect(() =>
      publishResourceBundle(
        input(base, bundlePath, 2, '{"revision":2,"changed":true}\n'),
      ),
    ).toThrow("conflicts with active revision");
    expect(readResourceBundle(bundlePath).manifest.revision).toBe(2);
  });

  it("rolls back an ordinary failure after moving the prior bundle", () => {
    const base = root();
    const bundlePath = path.join(base, "data", "prompts", "prompt-1");
    publishResourceBundle(input(base, bundlePath, 1));

    expect(() =>
      publishResourceBundle(input(base, bundlePath, 2), {
        injectFailure: (stage) => {
          if (stage === "prior-moved") throw new Error("disk failure");
        },
      }),
    ).toThrow("disk failure");
    expect(readResourceBundle(bundlePath).manifest.revision).toBe(1);
    expect(
      fs.existsSync(getResourceBundlePublicationJournalPath(bundlePath)),
    ).toBe(false);
  });

  it("finishes an interrupted publication deterministically on recovery", () => {
    const base = root();
    const bundlePath = path.join(base, "data", "prompts", "prompt-1");
    publishResourceBundle(input(base, bundlePath, 1));
    const interruption = Object.assign(new Error("process interrupted"), {
      leaveOperationForRecovery: true,
    });

    expect(() =>
      publishResourceBundle(input(base, bundlePath, 2), {
        injectFailure: (stage: ResourceBundlePublicationStage) => {
          if (stage === "prior-moved") throw interruption;
        },
      }),
    ).toThrow("process interrupted");
    expect(fs.existsSync(bundlePath)).toBe(false);

    expect(recoverResourceBundlePublication(bundlePath)).toBe("committed");
    expect(readResourceBundle(bundlePath).manifest.revision).toBe(2);
    expect(recoverResourceBundlePublication(bundlePath)).toBe("none");
  });

  it("rolls back an interruption before the prior bundle is moved", () => {
    const base = root();
    const bundlePath = path.join(base, "data", "prompts", "prompt-1");
    publishResourceBundle(input(base, bundlePath, 1));
    const interruption = Object.assign(new Error("process interrupted"), {
      leaveOperationForRecovery: true,
    });

    expect(() =>
      publishResourceBundle(input(base, bundlePath, 2), {
        injectFailure: (stage) => {
          if (stage === "prepared") throw interruption;
        },
      }),
    ).toThrow("process interrupted");

    expect(recoverResourceBundlePublication(bundlePath)).toBe("rolled-back");
    expect(readResourceBundle(bundlePath).manifest.revision).toBe(1);
  });

  it("commits an interruption after the destination is published", () => {
    const base = root();
    const bundlePath = path.join(base, "data", "prompts", "prompt-1");
    publishResourceBundle(input(base, bundlePath, 1));
    const interruption = Object.assign(new Error("process interrupted"), {
      leaveOperationForRecovery: true,
    });

    expect(() =>
      publishResourceBundle(input(base, bundlePath, 2), {
        injectFailure: (stage) => {
          if (stage === "destination-published") throw interruption;
        },
      }),
    ).toThrow("process interrupted");

    expect(recoverResourceBundlePublication(bundlePath)).toBe("committed");
    expect(readResourceBundle(bundlePath).manifest.revision).toBe(2);
  });

  it("serializes publishers with the durable per-resource journal", () => {
    const base = root();
    const bundlePath = path.join(base, "data", "prompts", "prompt-1");
    let nestedError: unknown;

    publishResourceBundle(input(base, bundlePath, 1), {
      injectFailure: (stage) => {
        if (stage !== "staged") return;
        try {
          publishResourceBundle(input(base, bundlePath, 2));
        } catch (error) {
          nestedError = error;
        }
      },
    });

    expect(nestedError).toBeInstanceOf(Error);
    expect((nestedError as Error).message).toContain("startup recovery");
    expect(readResourceBundle(bundlePath).manifest.revision).toBe(1);
  });

  it("recovers bounded journals across registered canonical domains", () => {
    const base = root();
    const dataPath = path.join(base, "data");
    const promptPath = path.join(dataPath, "prompts", "prompt-1");
    const skillPath = path.join(dataPath, "skills", "skill-1");
    const interruption = Object.assign(new Error("interrupted"), {
      leaveOperationForRecovery: true,
    });
    for (const bundlePath of [promptPath, skillPath]) {
      expect(() =>
        publishResourceBundle(
          {
            ...input(base, bundlePath, 1),
            resourceType: bundlePath === promptPath ? "prompt" : "skill",
            resourceId: bundlePath === promptPath ? "prompt-1" : "skill-1",
          },
          {
            injectFailure: (stage) => {
              if (stage === "prior-moved") throw interruption;
            },
          },
        ),
      ).toThrow("interrupted");
    }

    expect(recoverCanonicalResourcePublications(dataPath)).toEqual({
      scannedJournals: 2,
      committed: 2,
      rolledBack: 0,
    });
    expect(readResourceBundle(promptPath).manifest.resourceType).toBe("prompt");
    expect(readResourceBundle(skillPath).manifest.resourceType).toBe("skill");
    expect(() =>
      recoverCanonicalResourcePublications(dataPath, { maxJournals: 0 }),
    ).toThrow("limit is invalid");
  });

  it("fails before mutation when the recovery inventory exceeds its bound", () => {
    const base = root();
    const dataPath = path.join(base, "data");
    const interruption = Object.assign(new Error("interrupted"), {
      leaveOperationForRecovery: true,
    });
    const bundlePaths = ["prompt-1", "prompt-2"].map((id) =>
      path.join(dataPath, "prompts", id),
    );
    for (const [index, bundlePath] of bundlePaths.entries()) {
      expect(() =>
        publishResourceBundle(
          {
            ...input(base, bundlePath, 1),
            resourceId: `prompt-${index + 1}`,
          },
          {
            injectFailure: (stage) => {
              if (stage === "prior-moved") throw interruption;
            },
          },
        ),
      ).toThrow("interrupted");
    }

    expect(() =>
      recoverCanonicalResourcePublications(dataPath, { maxJournals: 1 }),
    ).toThrow("limit exceeded");
    for (const bundlePath of bundlePaths) {
      expect(
        fs.existsSync(getResourceBundlePublicationJournalPath(bundlePath)),
      ).toBe(true);
      expect(fs.existsSync(bundlePath)).toBe(false);
    }
  });

  it("treats identical content as an idempotent no-op and rejects schema downgrade", () => {
    const base = root();
    const bundlePath = path.join(base, "data", "prompts", "prompt-1");
    const initial = input(base, bundlePath, 1);
    initial.schemaVersion = 2;
    publishResourceBundle(initial);

    const identical = publishResourceBundle({
      ...initial,
      payloads: [
        {
          path: "prompt.json",
          sourcePath: source(base, '{"revision":1}\n'),
          role: "current",
        },
      ],
    });
    expect(identical.replacedRevision).toBe(1);
    expect(identical.manifest.revision).toBe(1);

    expect(() => publishResourceBundle(input(base, bundlePath, 2))).toThrow(
      /schema downgrade is not allowed/,
    );
  });

  it("validates explicit revision policies and detects exhausted revisions", () => {
    const base = root();
    const bundlePath = path.join(base, "data", "prompts", "prompt-1");
    expect(
      resolveResourceBundleWriteRevision(bundlePath, "prompt", "prompt-1", 1, {
        revision: 7,
      }),
    ).toBe(7);
    expect(
      resolveResourceBundleWriteRevision(bundlePath, "prompt", "prompt-1", 3),
    ).toBe(3);
    expect(
      resolveResourceBundleWriteRevision(bundlePath, "prompt", "prompt-1", 4, {
        mode: "replace",
      }),
    ).toBe(4);
    expect(() =>
      resolveResourceBundleWriteRevision(bundlePath, "prompt", "prompt-1", 1, {
        revision: 0,
      }),
    ).toThrow(/revision is invalid/);

    writeResourceBundle({
      ...input(base, bundlePath, Number.MAX_SAFE_INTEGER),
      updatedAt: "2026-08-12T00:00:00.000Z",
    });
    expect(() =>
      getNextResourceBundleRevision(bundlePath, {
        resourceType: "prompt",
        resourceId: "prompt-1",
      }),
    ).toThrow(/revision is exhausted/);
  });

  it("rolls back a failed first publication with no prior bundle", () => {
    const base = root();
    const bundlePath = path.join(base, "data", "prompts", "prompt-1");

    expect(() =>
      publishResourceBundle(input(base, bundlePath, 1), {
        injectFailure: (stage) => {
          if (stage === "prior-moved") throw new Error("first publish failed");
        },
      }),
    ).toThrow("first publish failed");
    expect(fs.existsSync(bundlePath)).toBe(false);
    expect(
      fs.existsSync(getResourceBundlePublicationJournalPath(bundlePath)),
    ).toBe(false);
  });

  it("cleans a temporary journal when an atomic journal update fails", () => {
    const base = root();
    const bundlePath = path.join(base, "data", "prompts", "prompt-1");
    const originalRename = fs.renameSync.bind(fs);
    vi.spyOn(fs, "renameSync").mockImplementation((from, to) => {
      if (String(from).includes(".publish.json.tmp-")) {
        throw new Error("journal rename failed");
      }
      return originalRename(from, to);
    });

    expect(() => publishResourceBundle(input(base, bundlePath, 1))).toThrow(
      "journal rename failed",
    );
    expect(
      fs
        .readdirSync(path.dirname(bundlePath))
        .some((entry) => entry.includes(".publish.json.tmp-")),
    ).toBe(false);
  });

  it("continues when directory fsync is unavailable", () => {
    const base = root();
    const bundlePath = path.join(base, "data", "prompts", "prompt-1");
    const parentPath = path.dirname(bundlePath);
    const originalOpen = fs.openSync.bind(fs);
    vi.spyOn(fs, "openSync").mockImplementation((target, flags, mode) => {
      if (path.resolve(String(target)) === parentPath && flags === "r") {
        throw Object.assign(new Error("directory fsync unavailable"), {
          code: "EINVAL",
        });
      }
      return originalOpen(target, flags, mode);
    });

    expect(
      publishResourceBundle(input(base, bundlePath, 1)).manifest.revision,
    ).toBe(1);
  });

  it("restores a prior bundle when a prepared journal outlives an unrecorded move", () => {
    const base = root();
    const bundlePath = path.join(base, "data", "prompts", "prompt-1");
    publishResourceBundle(input(base, bundlePath, 1));
    const interruption = Object.assign(new Error("interrupted"), {
      leaveOperationForRecovery: true,
    });
    expect(() =>
      publishResourceBundle(input(base, bundlePath, 2), {
        injectFailure: (stage) => {
          if (stage === "prepared") throw interruption;
        },
      }),
    ).toThrow("interrupted");
    const journalPath = getResourceBundlePublicationJournalPath(bundlePath);
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
    fs.renameSync(bundlePath, journal.priorPath);

    expect(recoverResourceBundlePublication(bundlePath)).toBe("rolled-back");
    expect(readResourceBundle(bundlePath).manifest.revision).toBe(1);
  });

  it("rolls back a prior-moved journal when its staged destination disappeared", () => {
    const base = root();
    const dataPath = path.join(base, "data");
    const bundlePath = path.join(dataPath, "prompts", "prompt-1");
    publishResourceBundle(input(base, bundlePath, 1));
    const interruption = Object.assign(new Error("interrupted"), {
      leaveOperationForRecovery: true,
    });
    expect(() =>
      publishResourceBundle(input(base, bundlePath, 2), {
        injectFailure: (stage) => {
          if (stage === "prior-moved") throw interruption;
        },
      }),
    ).toThrow("interrupted");
    const journal = JSON.parse(
      fs.readFileSync(
        getResourceBundlePublicationJournalPath(bundlePath),
        "utf8",
      ),
    );
    fs.rmSync(journal.stagePath, { recursive: true });

    expect(recoverCanonicalResourcePublications(dataPath)).toEqual({
      scannedJournals: 1,
      committed: 0,
      rolledBack: 1,
    });
    expect(readResourceBundle(bundlePath).manifest.revision).toBe(1);
  });

  it("fails closed when a journal has no recoverable bundle, stage, or prior", () => {
    const base = root();
    const bundlePath = path.join(base, "data", "prompts", "prompt-1");
    const interruption = Object.assign(new Error("interrupted"), {
      leaveOperationForRecovery: true,
    });
    expect(() =>
      publishResourceBundle(input(base, bundlePath, 1), {
        injectFailure: (stage) => {
          if (stage === "prior-moved") throw interruption;
        },
      }),
    ).toThrow("interrupted");
    const journal = JSON.parse(
      fs.readFileSync(
        getResourceBundlePublicationJournalPath(bundlePath),
        "utf8",
      ),
    );
    fs.rmSync(journal.stagePath, { recursive: true });
    fs.rmSync(journal.priorPath, { recursive: true, force: true });

    expect(() => recoverResourceBundlePublication(bundlePath)).toThrow(
      /no recoverable state/,
    );
  });

  it("rejects journal path ownership and target revision mismatches", () => {
    const invalidBase = root();
    const invalidBundle = path.join(invalidBase, "data", "prompts", "prompt-1");
    const interruption = Object.assign(new Error("interrupted"), {
      leaveOperationForRecovery: true,
    });
    expect(() =>
      publishResourceBundle(input(invalidBase, invalidBundle, 1), {
        injectFailure: (stage) => {
          if (stage === "prepared") throw interruption;
        },
      }),
    ).toThrow("interrupted");
    const invalidJournalPath =
      getResourceBundlePublicationJournalPath(invalidBundle);
    const invalidJournal = JSON.parse(
      fs.readFileSync(invalidJournalPath, "utf8"),
    );
    invalidJournal.stagePath = path.join(invalidBase, "outside-stage");
    fs.writeFileSync(invalidJournalPath, JSON.stringify(invalidJournal));
    expect(() => recoverResourceBundlePublication(invalidBundle)).toThrow(
      /Invalid resource bundle publication operation path/,
    );

    const mismatchBase = root();
    const mismatchBundle = path.join(
      mismatchBase,
      "data",
      "prompts",
      "prompt-1",
    );
    expect(() =>
      publishResourceBundle(input(mismatchBase, mismatchBundle, 1), {
        injectFailure: (stage) => {
          if (stage === "destination-published") throw interruption;
        },
      }),
    ).toThrow("interrupted");
    const mismatchJournalPath =
      getResourceBundlePublicationJournalPath(mismatchBundle);
    const mismatchJournal = JSON.parse(
      fs.readFileSync(mismatchJournalPath, "utf8"),
    );
    mismatchJournal.targetRevision = 2;
    fs.writeFileSync(mismatchJournalPath, JSON.stringify(mismatchJournal));
    expect(() => recoverResourceBundlePublication(mismatchBundle)).toThrow(
      /revision does not match journal/,
    );
  });

  it("rejects unsafe canonical domains, journal entries, and scan errors", () => {
    const unsafeBase = root();
    const unsafeData = path.join(unsafeBase, "data");
    fs.mkdirSync(unsafeData);
    fs.writeFileSync(path.join(unsafeData, "prompts"), "unsafe");
    expect(() => recoverCanonicalResourcePublications(unsafeData)).toThrow(
      /domain is unsafe/,
    );

    const journalBase = root();
    const journalData = path.join(journalBase, "data");
    const promptDomain = path.join(journalData, "prompts");
    fs.mkdirSync(path.join(promptDomain, ".prompt-1.publish.json"), {
      recursive: true,
    });
    expect(() => recoverCanonicalResourcePublications(journalData)).toThrow(
      /journal is unsafe/,
    );

    const deniedBase = root();
    const deniedData = path.join(deniedBase, "data");
    const deniedDomain = path.join(deniedData, "prompts");
    const originalLstat = fs.lstatSync.bind(fs);
    vi.spyOn(fs, "lstatSync").mockImplementation((target, options) => {
      if (path.resolve(String(target)) === deniedDomain) {
        throw Object.assign(new Error("denied"), { code: "EACCES" });
      }
      return originalLstat(target, options as never);
    });
    expect(() => recoverCanonicalResourcePublications(deniedData)).toThrow(
      "denied",
    );
  });

  it("rejects malformed and symbolic-link publication journals", () => {
    const base = root();
    const bundlePath = path.join(base, "data", "prompts", "prompt-1");
    const journalPath = getResourceBundlePublicationJournalPath(bundlePath);
    fs.mkdirSync(path.dirname(journalPath), { recursive: true });
    fs.writeFileSync(journalPath, "{}\n", "utf8");
    expect(() => recoverResourceBundlePublication(bundlePath)).toThrow(
      "Invalid resource bundle publication journal",
    );

    fs.rmSync(journalPath);
    const target = path.join(base, "outside.json");
    fs.writeFileSync(target, "{}\n", "utf8");
    fs.symlinkSync(target, journalPath);
    expect(() => recoverResourceBundlePublication(bundlePath)).toThrow(
      "Invalid resource bundle publication journal path",
    );
  });
});
