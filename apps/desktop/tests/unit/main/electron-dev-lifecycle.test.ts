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
});
