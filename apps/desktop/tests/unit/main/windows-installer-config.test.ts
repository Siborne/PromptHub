import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("windows installer config", () => {
  const configPath = path.join(process.cwd(), "electron-builder.config.cjs");

  const loadConfig = (releaseSign: boolean) => {
    const previousValue = process.env.PROMPTHUB_MAC_RELEASE_SIGN;
    process.env.PROMPTHUB_MAC_RELEASE_SIGN = releaseSign ? "true" : "false";

    delete require.cache[require.resolve(configPath)];
    const config = require(configPath) as {
      mac?: {
        entitlements?: string;
        entitlementsInherit?: string;
        hardenedRuntime?: boolean;
        identity?: string | null;
        notarize?: boolean;
      };
      nsis?: { guid?: string; include?: string };
    };
    delete require.cache[require.resolve(configPath)];

    if (previousValue === undefined) {
      delete process.env.PROMPTHUB_MAC_RELEASE_SIGN;
    } else {
      process.env.PROMPTHUB_MAC_RELEASE_SIGN = previousValue;
    }

    return config;
  };

  it("pins a stable NSIS guid and custom include", () => {
    const config = loadConfig(false);

    expect(config.nsis?.guid).toBe("16181c11-b075-53d6-87cb-f192f9b74217");
    expect(config.nsis?.include).toBe("resources/installer.nsh");
  });

  it("keeps local mac packaging unsigned by default", () => {
    const config = loadConfig(false);

    expect(config.mac?.hardenedRuntime).toBe(false);
    expect(config.mac?.identity).toBeNull();
    expect(config.mac?.notarize).toBeUndefined();
    expect(config.mac?.entitlements).toBeUndefined();
    expect(config.mac?.entitlementsInherit).toBeUndefined();
  });

  it("enables hardened runtime, notarization, and entitlements for release mac builds", () => {
    const config = loadConfig(true);

    expect(config.mac?.hardenedRuntime).toBe(true);
    expect(config.mac?.notarize).toBe(true);
    expect(config.mac?.identity).toBeUndefined();
    expect(config.mac?.entitlements).toBe("resources/entitlements.mac.plist");
    expect(config.mac?.entitlementsInherit).toBe("resources/entitlements.mac.inherit.plist");
  });

  it("ships the NSIS fallback include script", () => {
    const includePath = path.join(process.cwd(), "resources/installer.nsh");
    const contents = fs.readFileSync(includePath, "utf8");

    expect(contents).toContain("PROMPTHUB_INSTALL_STATE_KEY");
    expect(contents).toContain("customInit");
    expect(contents).toContain("customInstall");
  });
});
