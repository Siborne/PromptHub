/**
 * @vitest-environment node
 */
import fs from "fs";
import path from "path";
import { describe, expect, it, vi } from "vitest";

import {
  loadMacTrayTemplateIcon,
  resolveMacTrayIconPaths,
} from "../../../src/main/tray-icon";

function readPngDimensions(filePath: string): {
  height: number;
  width: number;
} {
  const header = fs.readFileSync(filePath).subarray(0, 24);
  return {
    width: header.readUInt32BE(16),
    height: header.readUInt32BE(20),
  };
}

describe("macOS tray icon", () => {
  it("resolves the dedicated Template asset in development", () => {
    expect(
      resolveMacTrayIconPaths({
        dirname: "/repo/apps/desktop/out/main",
        isDev: true,
        resourcesPath: "/packaged/resources",
      }),
    ).toEqual({
      fallbackPath:
        "/repo/apps/desktop/resources/icon.iconset/icon_16x16@2x.png",
      templatePath:
        "/repo/apps/desktop/resources/tray/PromptHubStatusTemplate.png",
      updateTemplatePath:
        "/repo/apps/desktop/resources/tray/PromptHubStatusUpdateTemplate.png",
    });
  });

  it("resolves packaged assets without depending on the asar path", () => {
    expect(
      resolveMacTrayIconPaths({
        dirname:
          "/Applications/PromptHub.app/Contents/Resources/app.asar/out/main",
        isDev: false,
        resourcesPath: "/Applications/PromptHub.app/Contents/Resources",
      }),
    ).toEqual({
      fallbackPath:
        "/Applications/PromptHub.app/Contents/Resources/icon.iconset/icon_16x16@2x.png",
      templatePath:
        "/Applications/PromptHub.app/Contents/Resources/tray/PromptHubStatusTemplate.png",
      updateTemplatePath:
        "/Applications/PromptHub.app/Contents/Resources/tray/PromptHubStatusUpdateTemplate.png",
    });
  });

  it("marks the dedicated icon as a macOS template without raster resizing", () => {
    const setTemplateImage = vi.fn();
    const resize = vi.fn();
    const icon = {
      isEmpty: () => false,
      resize,
      setTemplateImage,
    };
    const createFromPath = vi.fn(() => icon);

    expect(
      loadMacTrayTemplateIcon({
        createFromPath,
        templatePath: "/resources/tray/PromptHubStatusTemplate.png",
      }),
    ).toBe(icon);
    expect(createFromPath).toHaveBeenCalledWith(
      "/resources/tray/PromptHubStatusTemplate.png",
    );
    expect(setTemplateImage).toHaveBeenCalledWith(true);
    expect(resize).not.toHaveBeenCalled();
  });

  it("fails explicitly when the packaged template asset is missing", () => {
    expect(() =>
      loadMacTrayTemplateIcon({
        createFromPath: () => ({
          isEmpty: () => true,
          setTemplateImage: vi.fn(),
        }),
        templatePath: "/missing/PromptHubStatusTemplate.png",
      }),
    ).toThrow("macOS tray template icon is missing");
  });

  it("ships a 16px template image and a matching 32px Retina representation", () => {
    const resourcesDir = path.join(process.cwd(), "resources", "tray");

    for (const filename of [
      "PromptHubStatusTemplate",
      "PromptHubStatusUpdateTemplate",
    ]) {
      expect(
        readPngDimensions(path.join(resourcesDir, `${filename}.png`)),
      ).toEqual({ width: 16, height: 16 });
      expect(
        readPngDimensions(path.join(resourcesDir, `${filename}@2x.png`)),
      ).toEqual({ width: 32, height: 32 });
    }
  });

  it("uses the full menu bar canvas with a dominant top plate", () => {
    const source = fs.readFileSync(
      path.join(
        process.cwd(),
        "resources",
        "tray",
        "PromptHubStatusTemplate.svg",
      ),
      "utf8",
    );
    const firstPath = source.match(/<path d="([^"]+)"/)?.[1];
    const coordinates = firstPath?.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];

    expect(coordinates.length).toBeGreaterThan(0);
    expect(Math.min(...coordinates)).toBeLessThanOrEqual(0.25);
    expect(Math.max(...coordinates)).toBeGreaterThanOrEqual(15.75);
  });

  it("ships a distinct update badge with a transparent upward arrow", () => {
    const source = fs.readFileSync(
      path.join(
        process.cwd(),
        "resources",
        "tray",
        "PromptHubStatusUpdateTemplate.svg",
      ),
      "utf8",
    );

    expect(source).toContain('id="update-badge"');
    expect(source).toContain('id="arrow-cutout"');
    expect(source).toContain('id="update-arrow"');
    expect(source).toContain('mask="url(#arrow-cutout)"');
  });

  it("copies the dedicated tray assets into packaged applications", () => {
    const configPath = path.join(process.cwd(), "electron-builder.config.cjs");
    delete require.cache[require.resolve(configPath)];
    const config = require(configPath) as {
      extraResources?: Array<{ from?: string; to?: string }>;
    };
    delete require.cache[require.resolve(configPath)];

    expect(config.extraResources).toContainEqual({
      from: "resources/tray",
      to: "tray",
    });
  });
});
