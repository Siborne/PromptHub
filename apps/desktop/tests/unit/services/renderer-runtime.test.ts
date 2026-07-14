import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getRuntimeCapabilities,
  isPromptHubCloudEnabled,
} from "../../../src/renderer/runtime";
import { normalizeSkillStoreSourceIdForRuntime } from "../../../src/renderer/services/cloud-store";

describe("renderer runtime capabilities", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete (window as Window & { __PROMPTHUB_WEB__?: boolean })
      .__PROMPTHUB_WEB__;
  });

  it("keeps PromptHub Cloud disabled unless the build explicitly enables it", () => {
    vi.stubEnv("VITE_PROMPTHUB_CLOUD_ENABLED", "false");

    expect(isPromptHubCloudEnabled()).toBe(false);
    expect(getRuntimeCapabilities().promptHubCloud).toBe(false);
    expect(normalizeSkillStoreSourceIdForRuntime("prompthub-cloud")).toBe(
      "official",
    );
    expect(normalizeSkillStoreSourceIdForRuntime("claude-code")).toBe(
      "claude-code",
    );
  });

  it("enables PromptHub Cloud only for an explicitly enabled desktop build", () => {
    vi.stubEnv("VITE_PROMPTHUB_CLOUD_ENABLED", "true");

    expect(isPromptHubCloudEnabled()).toBe(true);
    expect(getRuntimeCapabilities().promptHubCloud).toBe(true);
    expect(normalizeSkillStoreSourceIdForRuntime("prompthub-cloud")).toBe(
      "prompthub-cloud",
    );
  });

  it("never exposes PromptHub Cloud through the self-hosted web runtime", () => {
    vi.stubEnv("VITE_PROMPTHUB_CLOUD_ENABLED", "true");
    (
      window as Window & {
        __PROMPTHUB_WEB__?: boolean;
      }
    ).__PROMPTHUB_WEB__ = true;

    expect(isPromptHubCloudEnabled()).toBe(false);
    expect(getRuntimeCapabilities().promptHubCloud).toBe(false);
  });
});
