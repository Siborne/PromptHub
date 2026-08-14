import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = path.resolve(
  process.cwd(),
  "../..",
  ".github/workflows/release.yml",
);

const workflowSource = readFileSync(workflowPath, "utf8");
const packagedStartupSmokePath = path.resolve(
  process.cwd(),
  "scripts/smoke-windows-packaged-startup.mts",
);
const packagedStartupSmokeSource = readFileSync(
  packagedStartupSmokePath,
  "utf8",
);
const desktopMainSource = readFileSync(
  path.resolve(process.cwd(), "src/main/index.ts"),
  "utf8",
);

function getIfLines(source: string): string[] {
  return source
    .split("\n")
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => /^\s*if:/.test(line))
    .map(({ line, lineNumber }) => `${lineNumber}: ${line.trim()}`);
}

describe("release workflow secret guards", () => {
  it("requires the full release gate before platform packaging starts", () => {
    expect(workflowSource).toContain("  verify:\n");
    expect(workflowSource).toContain("pnpm verify:release");
    expect(workflowSource).toContain("  build:\n    needs: verify\n");
  });

  it("does not read secret values from if expressions", () => {
    const unsafeIfLines = getIfLines(workflowSource).filter((line) =>
      /\b(?:env|secrets)\.(CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID|HOMEBREW_TAP_TOKEN)\b/.test(
        line,
      ),
    );

    expect(unsafeIfLines).toEqual([]);
  });

  it("blocks Windows release artifacts on a packaged x64 upgrade cold start", () => {
    expect(workflowSource).toContain(
      "Run packaged Windows x64 upgrade startup smoke",
    );
    expect(workflowSource).toContain(
      "node --experimental-strip-types scripts/smoke-windows-packaged-startup.mts",
    );
    expect(workflowSource).toContain(
      "matrix.platform == 'win' && matrix.arch == 'x64'",
    );
  });

  it("loads the packaged startup smoke with Node strip-types", () => {
    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", packagedStartupSmokePath],
      { encoding: "utf8" },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "The packaged Windows startup smoke must run on Windows",
    );
    expect(result.stderr).not.toContain("ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX");
  });

  it("routes the packaged smoke through an isolated Electron AppData root", () => {
    const environmentKey = "PROMPTHUB_PACKAGED_STARTUP_SMOKE_APP_DATA";

    expect(packagedStartupSmokeSource).toContain(environmentKey);
    expect(desktopMainSource).toContain(
      "resolvePackagedStartupSmokeAppDataPath",
    );
    expect(desktopMainSource).toContain('app.setPath("appData"');
  });

  it("gates optional publishers through non-secret readiness outputs", () => {
    expect(workflowSource).toContain("id: publish_secrets");
    expect(workflowSource).toContain(
      "homebrew_ready=${HOMEBREW_TAP_TOKEN:+true}",
    );
    expect(workflowSource).toContain(
      'r2_ready=$([ -n "${CLOUDFLARE_API_TOKEN:-}" ] && [ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ] && echo true || echo false)',
    );

    const ifLines = getIfLines(workflowSource).join("\n");
    expect(ifLines).toContain("steps.publish_secrets.outputs.homebrew_ready");
    expect(ifLines).toContain("steps.publish_secrets.outputs.r2_ready");
  });
});
