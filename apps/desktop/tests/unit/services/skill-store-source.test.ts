import { describe, expect, it } from "vitest";

import {
  isLikelyLocalSource,
  isSupportedGitRepoSource,
  normalizeGitStoreSourceInput,
  normalizeLocalSourcePath,
  validateMarketplaceStoreDocument,
  validateStoreSourceInput,
} from "../../../src/renderer/services/skill-store-source";

describe("skill-store-source", () => {
  it("accepts local directory paths for local-dir and git-repo sources", () => {
    expect(validateStoreSourceInput("~/Projects/skills", "local-dir")).toBe(
      "~/Projects/skills",
    );
    expect(validateStoreSourceInput("~/Projects/skills", "git-repo")).toBe(
      "~/Projects/skills",
    );
  });

  it("normalizes file URLs into local filesystem paths", () => {
    expect(normalizeLocalSourcePath("file:///Users/demo/skills")).toBe(
      "/Users/demo/skills",
    );
  });

  it("accepts hosted and self-hosted git repo URLs plus local paths", () => {
    expect(isSupportedGitRepoSource("https://github.com/anthropics/skills")).toBe(
      true,
    );
    expect(isSupportedGitRepoSource("https://gitea.example.com/icelemon/skills")).toBe(
      true,
    );
    expect(isSupportedGitRepoSource("git@gitea.example.com:icelemon/skills.git")).toBe(
      true,
    );
    expect(isSupportedGitRepoSource("~/Projects/my-skill-repo")).toBe(true);
    expect(isLikelyLocalSource("file:///Users/demo/skills")).toBe(true);
    expect(isSupportedGitRepoSource("https://gitlab.com/demo/skills")).toBe(true);
  });

  it("normalizes github tree urls into structured git source fields", () => {
    expect(
      normalizeGitStoreSourceInput(
        "https://github.com/openai/skills/tree/main/skills/.curated",
      ),
    ).toEqual({
      url: "https://github.com/openai/skills",
      branch: "main",
      directory: "skills/.curated",
    });
  });

  it("lets explicit branch and directory override parsed tree url values", () => {
    expect(
      normalizeGitStoreSourceInput(
        "https://github.com/openai/skills/tree/main/skills/.curated",
        "release",
        "skills/custom",
      ),
    ).toEqual({
      url: "https://github.com/openai/skills",
      branch: "release",
      directory: "skills/custom",
    });
  });

  it("accepts marketplace JSON documents with direct skills", () => {
    expect(
      validateMarketplaceStoreDocument(
        JSON.stringify({
          skills: [
            {
              name: "Docs Helper",
              content_url: "https://example.com/docs-helper/SKILL.md",
            },
          ],
        }),
      ),
    ).toEqual({ referenceCount: 0, skillCount: 1 });
  });

  it("accepts marketplace JSON documents with nested registry references", () => {
    expect(
      validateMarketplaceStoreDocument(
        JSON.stringify({
          sources: ["https://example.com/child-store.json"],
        }),
      ),
    ).toEqual({ referenceCount: 1, skillCount: 0 });
  });

  it("rejects empty marketplace JSON documents", () => {
    expect(() =>
      validateMarketplaceStoreDocument(
        JSON.stringify({
          total: 0,
          skills: [],
        }),
      ),
    ).toThrow("MARKETPLACE_STORE_EMPTY");
  });

  it("rejects malformed marketplace JSON responses", () => {
    expect(() => validateMarketplaceStoreDocument("<html>not json</html>")).toThrow(
      "MARKETPLACE_STORE_INVALID_JSON",
    );
  });
});
