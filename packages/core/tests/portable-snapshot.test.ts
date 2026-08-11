import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import {
  createPortableSnapshot,
  readPortableSnapshot,
} from "../src/portable-snapshot";

describe("portable snapshot", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function fixture(): { root: string; destination: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "prompthub-portable-"));
    roots.push(root);
    fs.mkdirSync(path.join(root, "data", "prompts", "p1"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(root, "data", "skills", "s1"), {
      recursive: true,
    });
    fs.writeFileSync(path.join(root, "data", "prompts", "p1", "prompt.json"), "prompt");
    fs.writeFileSync(path.join(root, "data", "skills", "s1", "SKILL.md"), "skill");
    fs.mkdirSync(path.join(root, "secrets"));
    fs.writeFileSync(path.join(root, "secrets", "vault.enc"), "secret");
    return { root, destination: path.join(path.dirname(root), `${path.basename(root)}-out`) };
  }

  it("reads only selected scopes and publishes a versioned verified envelope", () => {
    const { root, destination } = fixture();
    roots.push(destination);
    const result = createPortableSnapshot({
      sourceRoot: root,
      destinationPath: destination,
      scopes: [
        {
          id: "prompts",
          sourcePath: path.join(root, "data", "prompts"),
          archivePath: "data/prompts",
        },
      ],
      generatedFiles: [
        {
          archivePath: "config/app.json",
          content: Buffer.from('{"theme":"dark"}\n'),
          scope: "configuration",
        },
      ],
      omissions: ["secrets", "skills"],
      operationId: "snapshot-1",
      now: new Date("2026-08-11T00:00:00.000Z"),
    });

    expect(result.manifest).toMatchObject({
      kind: "prompthub-portable-snapshot",
      formatVersion: 1,
      consistencyId: expect.stringMatching(/^[a-f0-9]{64}$/),
      scopes: ["configuration", "prompts"],
      omissions: ["secrets", "skills"],
    });
    expect(fs.existsSync(path.join(destination, "data", "prompts", "p1", "prompt.json"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(destination, "data", "skills"))).toBe(false);
    expect(fs.existsSync(path.join(destination, "secrets"))).toBe(false);
    expect(readPortableSnapshot(destination).manifest.consistencyId).toBe(
      result.manifest.consistencyId,
    );
  });

  it("fails without publishing when a selected source mutates during copy", () => {
    const { root, destination } = fixture();
    roots.push(destination);
    expect(() =>
      createPortableSnapshot({
        sourceRoot: root,
        destinationPath: destination,
        scopes: [
          {
            id: "prompts",
            sourcePath: path.join(root, "data", "prompts"),
            archivePath: "data/prompts",
          },
        ],
        operationId: "snapshot-race",
        afterFileCopied: ({ sourcePath }) => {
          fs.appendFileSync(sourcePath, "changed");
        },
      }),
    ).toThrow("changed during snapshot");
    expect(fs.existsSync(destination)).toBe(false);
  });

  it.skipIf(process.platform === "win32")(
    "rejects traversal and symlinked selected content",
    () => {
      const { root, destination } = fixture();
      roots.push(destination);
      fs.symlinkSync(
        path.join(root, "secrets", "vault.enc"),
        path.join(root, "data", "prompts", "linked"),
      );
      expect(() =>
        createPortableSnapshot({
          sourceRoot: root,
          destinationPath: destination,
          scopes: [
            {
              id: "prompts",
              sourcePath: path.join(root, "data", "prompts"),
              archivePath: "../escape",
            },
          ],
        }),
      ).toThrow(/archive path|symbolic link/i);
      expect(fs.existsSync(destination)).toBe(false);
    },
  );
});
