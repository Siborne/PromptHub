import { describe, expect, it } from "vitest";
import {
  getCloudListingId,
  isCloudRegistrySkill,
  mapCloudListingToRegistrySkill,
} from "../../../src/renderer/services/cloud-store";

describe("cloud store registry mapping", () => {
  it("maps only published skill listings to stable cloud source identities", () => {
    const skill = mapCloudListingToRegistrySkill({
      id: "listing:skill-1",
      sourceType: "skill",
      sourceId: "source-1",
      slug: "repo-audit",
      title: "Repository Audit",
      summary: "Audit a repository",
      tags: ["audit"],
      updatedAt: "2026-07-12T00:00:00.000Z",
    });

    expect(skill).toMatchObject({
      source_id: "cloud:listing:skill-1",
      source_label: "PromptHub Cloud",
      source_url: "cloud://store/listings/repo-audit",
      version: "2026-07-12T00:00:00.000Z",
    });
    expect(isCloudRegistrySkill(skill!)).toBe(true);
    expect(getCloudListingId(skill!)).toBe("listing:skill-1");
    expect(
      mapCloudListingToRegistrySkill({
        id: "prompt-1",
        sourceType: "prompt",
        sourceId: "source-2",
        slug: "prompt",
        title: "Prompt",
        summary: null,
      }),
    ).toBeNull();
  });
});
