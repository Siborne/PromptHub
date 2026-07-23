import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CodexDreamSkinEngine } from "../../../src/main/services/codex-dream-skin-engine";

const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

describe("CodexDreamSkinEngine", () => {
  let root: string;
  let runtimeRoot: string;
  let stateRoot: string;
  let sourceTheme: string;
  const runCommand = vi.fn(async () => ({ stdout: "verified", stderr: "" }));

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "dream-skin-engine-"));
    runtimeRoot = path.join(root, "runtime");
    stateRoot = path.join(root, "state");
    sourceTheme = path.join(root, "source-theme");
    await fs.mkdir(path.join(runtimeRoot, "macos", "scripts"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(runtimeRoot, "macos", "scripts", "start-dream-skin-macos.sh"),
      "#!/bin/bash\n",
    );
    await fs.writeFile(
      path.join(runtimeRoot, "macos", "scripts", "restore-dream-skin-macos.sh"),
      "#!/bin/bash\n",
    );
    await fs.mkdir(sourceTheme, { recursive: true });
    await fs.writeFile(
      path.join(sourceTheme, "theme.json"),
      JSON.stringify({
        schemaVersion: 1,
        id: "dream-portal",
        name: "Dream Portal",
        image: "portal.png",
        appearance: "auto",
        art: { focusX: 0.72, safeArea: "left", taskMode: "ambient" },
        colors: { accent: "#e25563" },
      }),
    );
    await fs.writeFile(path.join(sourceTheme, "portal.png"), PNG_BYTES);
    runCommand.mockClear();
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("parses a declaration-only Dream Skin theme and validates image metadata", async () => {
    const engine = new CodexDreamSkinEngine({
      runtimeRoot,
      stateRoot,
      platform: "darwin",
      runCommand,
    });

    await expect(engine.readThemePackage(sourceTheme)).resolves.toMatchObject({
      schemaVersion: 1,
      id: "dream-portal",
      name: "Dream Portal",
      imageName: "portal.png",
      config: {
        appearance: "auto",
        art: { focusX: 0.72, safeArea: "left", taskMode: "ambient" },
      },
    });
  });

  it("rejects escaping images, symlinks, malformed fields and oversized dimensions", async () => {
    const engine = new CodexDreamSkinEngine({
      runtimeRoot,
      stateRoot,
      platform: "darwin",
      runCommand,
    });

    await fs.writeFile(
      path.join(sourceTheme, "theme.json"),
      JSON.stringify({
        schemaVersion: 1,
        id: "dream-portal",
        name: "Dream Portal",
        image: "../portal.png",
      }),
    );
    await expect(engine.readThemePackage(sourceTheme)).rejects.toThrow(
      "inside its theme directory",
    );

    await fs.writeFile(
      path.join(sourceTheme, "theme.json"),
      JSON.stringify({
        schemaVersion: 1,
        id: "dream-portal",
        name: "Dream Portal",
        image: "portal.png",
        appearance: "neon",
      }),
    );
    await expect(engine.readThemePackage(sourceTheme)).rejects.toThrow(
      "appearance",
    );

    await fs.writeFile(
      path.join(sourceTheme, "theme.json"),
      JSON.stringify({
        schemaVersion: 1,
        id: "dream-portal",
        name: "Dream Portal",
        image: "portal.png",
      }),
    );
    await fs.rm(path.join(sourceTheme, "portal.png"));
    await fs.symlink(
      path.join(sourceTheme, "theme.json"),
      path.join(sourceTheme, "portal.png"),
    );
    await expect(engine.readThemePackage(sourceTheme)).rejects.toThrow(
      "symlink",
    );

    await fs.rm(path.join(sourceTheme, "portal.png"));
    const hugePng = Buffer.from(PNG_BYTES);
    hugePng.writeUInt32BE(20_000, 16);
    await fs.writeFile(path.join(sourceTheme, "portal.png"), hugePng);
    await expect(engine.readThemePackage(sourceTheme)).rejects.toThrow(
      "dimensions",
    );
  });

  it("rejects invalid schema, identity, art, colors and missing image files", async () => {
    const engine = new CodexDreamSkinEngine({
      runtimeRoot,
      stateRoot,
      platform: "darwin",
      runCommand,
    });
    const valid = {
      schemaVersion: 1,
      id: "dream-portal",
      name: "Dream Portal",
      image: "portal.png",
    };
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ ...valid, schemaVersion: 2 }, "schemaVersion"],
      [{ ...valid, id: "../escape" }, "id"],
      [{ ...valid, name: "\u0000" }, "name"],
      [{ ...valid, art: [] }, "art"],
      [{ ...valid, art: { focusX: 2 } }, "art.focusX"],
      [{ ...valid, art: { safeArea: "edge" } }, "art.safeArea"],
      [{ ...valid, colors: [] }, "colors"],
      [{ ...valid, colors: { script: "red" } }, "colors.script"],
      [{ ...valid, colors: { accent: "url(file:///tmp/x)" } }, "colors.accent"],
      [{ ...valid, quote: 42 }, "quote"],
    ];

    for (const [config, message] of cases) {
      await fs.writeFile(
        path.join(sourceTheme, "theme.json"),
        JSON.stringify(config),
      );
      await expect(engine.readThemePackage(sourceTheme)).rejects.toThrow(
        message,
      );
    }

    await fs.writeFile(
      path.join(sourceTheme, "theme.json"),
      JSON.stringify({ ...valid, image: "missing.png" }),
    );
    await expect(engine.readThemePackage(sourceTheme)).rejects.toThrow(
      "missing",
    );
  });

  it("atomically stages the selected theme before starting and verifying macOS runtime", async () => {
    const engine = new CodexDreamSkinEngine({
      runtimeRoot,
      stateRoot,
      platform: "darwin",
      runCommand,
    });
    const theme = await engine.readThemePackage(sourceTheme);

    await engine.applyTheme({ theme, restartExisting: true });

    expect(
      await fs.readFile(path.join(stateRoot, "theme", "theme.json"), "utf8"),
    ).toContain('"dream-portal"');
    expect(
      await fs.readFile(path.join(stateRoot, "theme", "portal.png")),
    ).toEqual(PNG_BYTES);
    expect(runCommand).toHaveBeenCalledWith(
      "/bin/bash",
      expect.arrayContaining([
        expect.stringMatching(/start-dream-skin-macos\.sh$/),
        "--restart-existing",
      ]),
      expect.objectContaining({ timeoutMs: 90_000 }),
    );
  });

  it("uses the upstream verified restore entry and rejects unsupported hosts", async () => {
    const engine = new CodexDreamSkinEngine({
      runtimeRoot,
      stateRoot,
      platform: "darwin",
      runCommand,
    });

    await engine.restoreTheme();
    expect(runCommand).toHaveBeenCalledWith(
      "/bin/bash",
      expect.arrayContaining([
        expect.stringMatching(/restore-dream-skin-macos\.sh$/),
        "--restart-codex",
      ]),
      expect.objectContaining({ timeoutMs: 60_000 }),
    );

    const unsupported = new CodexDreamSkinEngine({
      runtimeRoot,
      stateRoot,
      platform: "linux",
      runCommand,
    });
    await expect(unsupported.restoreTheme()).rejects.toThrow(
      "only supports macOS and Windows",
    );
  });

  it("uses the pinned Windows runtime and preserves useful command failures", async () => {
    await fs.mkdir(path.join(runtimeRoot, "windows", "scripts"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(runtimeRoot, "windows", "scripts", "start-dream-skin.ps1"),
      "# start\n",
    );
    await fs.writeFile(
      path.join(runtimeRoot, "windows", "scripts", "restore-dream-skin.ps1"),
      "# restore\n",
    );
    const engine = new CodexDreamSkinEngine({
      runtimeRoot,
      stateRoot,
      platform: "win32",
      runCommand,
    });
    const theme = await engine.readThemePackage(sourceTheme);

    await engine.applyTheme({ theme, restartExisting: true });
    expect(
      await fs.readFile(
        path.join(stateRoot, "active-theme", "theme.json"),
        "utf8",
      ),
    ).toContain("dream-portal");
    expect(runCommand).toHaveBeenCalledWith(
      "powershell.exe",
      expect.arrayContaining([
        "-File",
        expect.stringMatching(/start-dream-skin\.ps1$/),
        "-RestartExisting",
      ]),
      expect.objectContaining({
        env: expect.objectContaining({
          PROMPTHUB_DREAM_SKIN_STATE_ROOT: stateRoot,
        }),
      }),
    );

    await engine.restoreTheme();
    expect(runCommand).toHaveBeenLastCalledWith(
      "powershell.exe",
      expect.arrayContaining([
        expect.stringMatching(/restore-dream-skin\.ps1$/),
        "-ForceRestart",
      ]),
      expect.objectContaining({ timeoutMs: 60_000 }),
    );

    runCommand.mockRejectedValueOnce(
      Object.assign(new Error("exit 1"), { stderr: "verified CDP missing" }),
    );
    await expect(engine.restoreTheme()).rejects.toThrow("verified CDP missing");
    expect(engine.getBundledThemeDirectories()[0]).toMatch(
      /themes[/\\]dream-portal$/,
    );
  });
});
