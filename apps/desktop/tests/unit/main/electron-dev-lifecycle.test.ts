import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const desktopRoot = path.resolve(__dirname, "../../..");

describe("Electron development lifecycle", () => {
  it("lets vite-plugin-electron exclusively own Electron startup", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(desktopRoot, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    const viteConfig = fs.readFileSync(
      path.join(desktopRoot, "vite.config.ts"),
      "utf8",
    );
    const rendererEntry = fs.readFileSync(
      path.join(desktopRoot, "src/renderer/main.tsx"),
      "utf8",
    );
    const command = packageJson.scripts?.["electron:dev"];

    expect(command).toBe("vite");
    expect(command).not.toMatch(/concurrently|wait-on|\belectron\b/);
    expect(viteConfig).toContain('args.startup(["."])');
    expect(rendererEntry).toContain("<RendererErrorBoundary");
    expect(rendererEntry).toContain("<ToastProvider>");
  });

  it("keeps renderer document, module, and HMR traffic on one loopback family", () => {
    const viteConfig = fs.readFileSync(
      path.join(desktopRoot, "vite.config.ts"),
      "utf8",
    );
    const mainEntry = fs.readFileSync(
      path.join(desktopRoot, "src/main/index.ts"),
      "utf8",
    );

    expect(viteConfig).toContain('host: "127.0.0.1"');
    expect(viteConfig).toContain("strictPort: false");
    expect(viteConfig).not.toContain('host: "localhost"');
    expect(viteConfig).toContain("normalizeDesktopDevServerUrl");
    expect(viteConfig).toContain("stopElectronBeforeRestart");
    expect(viteConfig).toContain("createElectronRestartCoordinator");
    expect(viteConfig).toContain("prompthubElectronRestartCoordinator ??=");
    expect(viteConfig).toContain(
      "Failed to restart Electron after main rebuild",
    );
    expect(viteConfig).toContain("await args.startup");
    expect(mainEntry).toContain('"http://127.0.0.1:5173"');
    expect(mainEntry).not.toContain('"http://localhost:5173"');
    expect(mainEntry).toMatch(
      /function emitWindowVisibility\(isVisible: boolean\) \{\s+if \(isQuitting\) return;/,
    );
  });
});
