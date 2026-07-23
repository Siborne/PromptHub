import { describe, expect, it, vi } from "vitest";

import { launchAgentPlatform } from "../../../src/main/services/agent-launch-service";

const platform = {
  id: "antigravity",
  name: "Antigravity",
  icon: "Sparkles",
  rootDir: { darwin: "~/.gemini/config", win32: "", linux: "" },
  skillsRelativePath: "skills",
  launchPaths: {
    darwin: ["/Applications/Antigravity.app", "~/Applications/Antigravity.app"],
  },
};

describe("Agent launch service", () => {
  it("opens the first installed allowlisted application and focuses an existing instance", async () => {
    const openPath = vi.fn(async () => "");
    const result = await launchAgentPlatform(platform, {
      platform: "darwin",
      homePath: "/Users/test",
      pathExists: vi.fn(async (candidate) =>
        candidate.endsWith("/Applications/Antigravity.app"),
      ),
      openPath,
    });

    expect(result).toEqual({ success: true });
    expect(openPath).toHaveBeenCalledWith("/Applications/Antigravity.app");
  });

  it("expands the user Applications fallback without accepting renderer paths", async () => {
    const openPath = vi.fn(async () => "");
    const result = await launchAgentPlatform(platform, {
      platform: "darwin",
      homePath: "/Users/test",
      pathExists: vi.fn(
        async (candidate) =>
          candidate === "/Users/test/Applications/Antigravity.app",
      ),
      openPath,
    });

    expect(result).toEqual({ success: true });
    expect(openPath).toHaveBeenCalledWith(
      "/Users/test/Applications/Antigravity.app",
    );
  });

  it("returns a classified result when no verified launch target exists", async () => {
    await expect(
      launchAgentPlatform(
        { ...platform, launchPaths: undefined },
        {
          platform: "darwin",
          homePath: "/Users/test",
          pathExists: vi.fn(),
          openPath: vi.fn(),
        },
      ),
    ).resolves.toEqual({ success: false, errorCode: "unsupported" });

    await expect(
      launchAgentPlatform(platform, {
        platform: "darwin",
        homePath: "/Users/test",
        pathExists: vi.fn(async () => false),
        openPath: vi.fn(),
      }),
    ).resolves.toEqual({ success: false, errorCode: "not-installed" });
  });

  it("does not report success when Electron rejects the launch", async () => {
    await expect(
      launchAgentPlatform(platform, {
        platform: "darwin",
        homePath: "/Users/test",
        pathExists: vi.fn(async () => true),
        openPath: vi.fn(async () => "Launch denied"),
      }),
    ).resolves.toEqual({ success: false, errorCode: "launch-failed" });
  });
});
