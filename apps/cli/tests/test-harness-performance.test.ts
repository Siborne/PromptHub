import fs from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { makeTempRoot } from "./helpers/cli-harness";

describe("CLI test database fixture", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("seeds ordinary roots and preserves an explicit unseeded mode", () => {
    const seededRoot = makeTempRoot(tempDirs);
    const unseededRoot = makeTempRoot(tempDirs, { seedDatabase: false });
    const relativeDatabasePath = path.join(
      "user-data",
      "data",
      "prompthub.db",
    );

    expect(fs.existsSync(path.join(seededRoot, relativeDatabasePath))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(unseededRoot, relativeDatabasePath))).toBe(
      false,
    );
  });
});
