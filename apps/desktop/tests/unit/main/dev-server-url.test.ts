import { describe, expect, it } from "vitest";

import { normalizeDesktopDevServerUrl } from "../../../src/main/dev-server-url";

describe("normalizeDesktopDevServerUrl", () => {
  it("keeps an absent development URL absent", () => {
    expect(normalizeDesktopDevServerUrl(undefined)).toBeUndefined();
  });

  it("replaces the plugin localhost alias while preserving the selected port", () => {
    expect(normalizeDesktopDevServerUrl("http://localhost:5174/desktop")).toBe(
      "http://127.0.0.1:5174/desktop",
    );
  });

  it("leaves an explicit non-localhost URL unchanged", () => {
    expect(normalizeDesktopDevServerUrl("http://127.0.0.1:5175/")).toBe(
      "http://127.0.0.1:5175/",
    );
  });
});
