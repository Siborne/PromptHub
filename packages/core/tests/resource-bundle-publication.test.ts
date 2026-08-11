import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  getResourceBundlePublicationJournalPath,
  getNextResourceBundleRevision,
  publishResourceBundle,
  readResourceBundle,
  recoverCanonicalResourcePublications,
  recoverResourceBundlePublication,
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
