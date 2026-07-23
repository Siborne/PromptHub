import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AgentAppearanceService,
  type AgentAppearanceThemeEngine,
  type DreamSkinThemePackage,
} from "../../../src/main/services/agent-appearance-service";

const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function themePackage(directoryPath: string): DreamSkinThemePackage {
  const config = {
    schemaVersion: 1 as const,
    id: "midnight",
    name: "Midnight",
    image: "background.png",
    appearance: "dark" as const,
  };
  return {
    schemaVersion: 1,
    id: config.id,
    name: config.name,
    directoryPath,
    imagePath: path.join(directoryPath, config.image),
    imageName: config.image,
    config,
    configBytes: Buffer.from(`${JSON.stringify(config)}\n`),
    imageBytes: PNG_BYTES,
    previewDataUrl: `data:image/png;base64,${PNG_BYTES.toString("base64")}`,
  };
}

async function writeTheme(directoryPath: string): Promise<void> {
  const theme = themePackage(directoryPath);
  await fs.mkdir(directoryPath, { recursive: true });
  await fs.writeFile(path.join(directoryPath, "theme.json"), theme.configBytes);
  await fs.writeFile(theme.imagePath, theme.imageBytes);
}

describe("AgentAppearanceService", () => {
  let root: string;
  let dataRoot: string;
  let codexRoot: string;
  let engine: AgentAppearanceThemeEngine;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "prompthub-appearance-"));
    dataRoot = path.join(root, "data");
    codexRoot = path.join(root, ".codex");
    engine = {
      version: "1.2.0",
      sourceCommit: "3af1d6d62f3a0388cc640d2f497ac3100998938e",
      adapterLastVerifiedVersion: "26.707.72221",
      readThemePackage: vi.fn(async (directoryPath) =>
        themePackage(directoryPath),
      ),
      applyTheme: vi.fn(async () => undefined),
      restoreTheme: vi.fn(async () => undefined),
    };
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("imports a validated Dream Skin directory atomically and exports its declaration", async () => {
    const source = path.join(root, "theme-source");
    await writeTheme(source);
    const service = new AgentAppearanceService({ dataRoot, codexRoot, engine });

    const imported = await service.importTheme(source);
    const exported = await service.exportTheme(
      imported.id,
      path.join(root, "theme-export"),
    );
    const overview = await service.getOverview();

    expect(imported).toMatchObject({
      id: "midnight",
      name: "Midnight",
      version: "1",
      compatibleTarget: true,
    });
    expect(imported.directoryPath).toMatch(
      /agent-appearance\/themes\/codex\/midnight$/,
    );
    expect(overview.themes).toEqual([imported]);
    expect(overview.engineVersion).toBe("1.2.0");
    expect(overview.adapterLastVerifiedVersion).toBe("26.707.72221");
    expect(
      await fs.readFile(path.join(exported, "theme.json"), "utf8"),
    ).toContain('"midnight"');
    expect(await fs.readFile(path.join(exported, "background.png"))).toEqual(
      PNG_BYTES,
    );
    await expect(
      service.exportTheme(imported.id, path.join(root, "theme-export")),
    ).rejects.toThrow("already contains");
  });

  it("rejects symlinked and invalid Dream Skin source directories", async () => {
    const source = path.join(root, "theme-source");
    const linked = path.join(root, "linked-theme");
    await writeTheme(source);
    await fs.symlink(source, linked);
    const service = new AgentAppearanceService({ dataRoot, codexRoot, engine });

    await expect(service.importTheme(linked)).rejects.toThrow("symlink");

    engine.readThemePackage = vi.fn(async () => {
      throw new Error("Theme image exceeds 50 megapixels");
    });
    await expect(service.importTheme(source)).rejects.toThrow("50 megapixels");
  });

  it("records a skin only after Dream Skin start and clears it after verified restore", async () => {
    const source = path.join(root, "theme-source");
    await writeTheme(source);
    const service = new AgentAppearanceService({ dataRoot, codexRoot, engine });
    await service.importTheme(source);

    await service.applyTheme("midnight", true);
    expect((await service.getOverview()).activeThemeId).toBe("midnight");
    expect(engine.applyTheme).toHaveBeenCalledWith(
      expect.objectContaining({
        restartExisting: true,
        theme: expect.objectContaining({ id: "midnight" }),
      }),
    );
    await expect(service.deleteTheme("midnight")).rejects.toThrow(
      "Restore the active theme",
    );

    await service.restoreTheme();
    expect((await service.getOverview()).activeThemeId).toBeNull();
    expect(engine.restoreTheme).toHaveBeenCalledOnce();

    engine.applyTheme = vi.fn(async () => {
      throw new Error("required landmark missing");
    });
    await expect(service.applyTheme("midnight")).rejects.toThrow("landmark");
    expect((await service.getOverview()).activeThemeId).toBeNull();
  });

  it("returns Dream Skin artwork and counts invalid stored directories", async () => {
    const source = path.join(root, "theme-source");
    await writeTheme(source);
    const service = new AgentAppearanceService({ dataRoot, codexRoot, engine });
    const imported = await service.importTheme(source);
    await fs.writeFile(
      path.join(path.dirname(imported.directoryPath), "not-a-theme"),
      "bad",
    );
    engine.readThemePackage = vi.fn(async (directoryPath) => {
      if (directoryPath.endsWith("broken")) throw new Error("bad");
      return themePackage(directoryPath);
    });
    await fs.mkdir(path.join(path.dirname(imported.directoryPath), "broken"));

    await expect(service.getThemePreview(imported.id)).resolves.toMatch(
      /^data:image\/png;base64,/,
    );
    expect((await service.getOverview()).invalidThemeCount).toBe(2);
  });

  it("seeds the neutral bundled theme once and keeps user-managed copies", async () => {
    const bundled = path.join(root, "runtime", "themes", "dream-portal");
    await writeTheme(bundled);
    engine.getBundledThemeDirectories = () => [bundled];
    const service = new AgentAppearanceService({ dataRoot, codexRoot, engine });

    const first = await service.getOverview();
    const second = await service.getOverview();

    expect(first.themes).toHaveLength(1);
    expect(second.themes).toEqual(first.themes);
    expect(
      await fs.readFile(
        path.join(
          dataRoot,
          "agent-appearance",
          "themes",
          "codex",
          ".dream-skin-bundled-v1",
        ),
        "utf8",
      ),
    ).toBe("1\n");
  });

  it("atomically replaces a re-imported inactive theme and allows deletion", async () => {
    const source = path.join(root, "theme-source");
    await writeTheme(source);
    const service = new AgentAppearanceService({ dataRoot, codexRoot, engine });
    const first = await service.importTheme(source);
    const updated = themePackage(source);
    updated.config = { ...updated.config, name: "Midnight Updated" };
    updated.name = "Midnight Updated";
    updated.configBytes = Buffer.from(`${JSON.stringify(updated.config)}\n`);
    engine.readThemePackage = vi.fn(async (directoryPath) => ({
      ...updated,
      directoryPath,
      imagePath: path.join(directoryPath, updated.imageName),
    }));

    await expect(service.importTheme(source)).resolves.toMatchObject({
      id: first.id,
      name: "Midnight Updated",
    });
    await service.deleteTheme(first.id);
    await expect(service.getThemePreview(first.id)).rejects.toThrow(
      "Unknown desktop theme",
    );
  });

  it("restores Dream Skin when PromptHub state cannot be committed", async () => {
    const source = path.join(root, "theme-source");
    await writeTheme(source);
    const service = new AgentAppearanceService({ dataRoot, codexRoot, engine });
    await service.importTheme(source);
    await fs.mkdir(
      path.join(dataRoot, "agent-appearance", "codex-state.json"),
      { recursive: true },
    );

    await expect(service.applyTheme("midnight")).rejects.toThrow();
    expect(engine.restoreTheme).toHaveBeenCalledOnce();
  });

  it("keeps the active state when verified Dream Skin restore fails", async () => {
    const source = path.join(root, "theme-source");
    await writeTheme(source);
    const service = new AgentAppearanceService({ dataRoot, codexRoot, engine });
    await service.importTheme(source);
    await service.applyTheme("midnight");
    engine.restoreTheme = vi.fn(async () => {
      throw new Error("restore verification failed");
    });

    await expect(service.restoreTheme()).rejects.toThrow("verification failed");
    expect((await service.getOverview()).activeThemeId).toBe("midnight");
  });

  it("scans valid Codex Pets while excluding malformed and symlinked entries", async () => {
    const validDir = path.join(codexRoot, "pets", "orbit");
    const invalidDir = path.join(codexRoot, "pets", "broken");
    await fs.mkdir(validDir, { recursive: true });
    await fs.mkdir(invalidDir, { recursive: true });
    await fs.writeFile(
      path.join(validDir, "pet.json"),
      JSON.stringify({
        id: "orbit",
        displayName: "Orbit",
        description: "A tiny astronaut",
        spritesheetPath: "spritesheet.webp",
      }),
    );
    await fs.writeFile(path.join(validDir, "spritesheet.webp"), PNG_BYTES);
    await fs.writeFile(path.join(invalidDir, "pet.json"), "{bad json");
    await fs.symlink(validDir, path.join(codexRoot, "pets", "linked"));
    const service = new AgentAppearanceService({ dataRoot, codexRoot, engine });

    const overview = await service.getOverview();

    expect(overview.pets).toEqual([
      expect.objectContaining({
        id: "orbit",
        name: "Orbit",
        description: "A tiny astronaut",
        spriteVersionNumber: 1,
        spritesheetName: "spritesheet.webp",
      }),
    ]);
    expect(overview.invalidPetCount).toBe(2);
    await expect(service.getPetPreview("../orbit")).rejects.toThrow(
      "Invalid Pet id",
    );
    await expect(service.getPetPreview("orbit")).resolves.toMatch(
      /^data:image\/webp;base64,/,
    );
  });

  it("imports, exports and deletes one validated Pet without escaping its root", async () => {
    const source = path.join(root, "pet-source");
    const exportDir = path.join(root, "export");
    await fs.mkdir(source, { recursive: true });
    await fs.writeFile(
      path.join(source, "pet.json"),
      JSON.stringify({
        id: "nova",
        displayName: "Nova",
        spriteVersionNumber: 2,
        spritesheetPath: "spritesheet.png",
      }),
    );
    await fs.writeFile(path.join(source, "spritesheet.png"), PNG_BYTES);
    const service = new AgentAppearanceService({ dataRoot, codexRoot, engine });

    await expect(service.importPet(source)).resolves.toMatchObject({
      id: "nova",
      name: "Nova",
      spriteVersionNumber: 2,
    });
    await expect(service.importPet(source)).rejects.toThrow(
      "already installed",
    );
    await expect(service.getPetPreview("nova")).resolves.toMatch(
      /^data:image\/png;base64,/,
    );
    await expect(service.exportPet("nova", exportDir)).resolves.toBe(
      path.join(exportDir, "nova"),
    );
    expect(
      await fs.readFile(path.join(exportDir, "nova", "pet.json"), "utf8"),
    ).toContain('"nova"');
    await expect(service.exportPet("nova", exportDir)).rejects.toThrow(
      "already contains",
    );
    await expect(service.deletePet("../nova")).rejects.toThrow(
      "Invalid Pet id",
    );
    await service.deletePet("nova");
    await expect(
      fs.stat(path.join(codexRoot, "pets", "nova")),
    ).rejects.toThrow();
  });

  it("rejects Pet manifests with traversal, unsupported media or symlinks", async () => {
    const source = path.join(root, "pet-source");
    await fs.mkdir(source, { recursive: true });
    const service = new AgentAppearanceService({ dataRoot, codexRoot, engine });

    await fs.writeFile(
      path.join(source, "pet.json"),
      JSON.stringify({
        id: "nova",
        displayName: "Nova",
        spritesheetPath: "../outside.webp",
      }),
    );
    await expect(service.importPet(source)).rejects.toThrow("spritesheetPath");

    await fs.writeFile(
      path.join(source, "pet.json"),
      JSON.stringify({
        id: "nova",
        displayName: "Nova",
        spriteVersionNumber: 3,
        spritesheetPath: "spritesheet.png",
      }),
    );
    await fs.writeFile(path.join(source, "spritesheet.png"), PNG_BYTES);
    await expect(service.importPet(source)).rejects.toThrow(
      "spriteVersionNumber",
    );
    await fs.rm(path.join(source, "spritesheet.png"));

    await fs.writeFile(
      path.join(source, "pet.json"),
      JSON.stringify({
        id: "nova",
        displayName: "Nova",
        spritesheetPath: "spritesheet.svg",
      }),
    );
    await fs.writeFile(path.join(source, "spritesheet.svg"), "<svg />");
    await expect(service.importPet(source)).rejects.toThrow("PNG or WebP");

    await fs.rm(path.join(source, "spritesheet.svg"));
    await fs.symlink(
      path.join(source, "pet.json"),
      path.join(source, "spritesheet.webp"),
    );
    await fs.writeFile(
      path.join(source, "pet.json"),
      JSON.stringify({
        id: "nova",
        displayName: "Nova",
        spritesheetPath: "spritesheet.webp",
      }),
    );
    await expect(service.importPet(source)).rejects.toThrow("symlink");
  });
});
