/**
 * @vitest-environment node
 */
import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SkillSafetyReport } from "@prompthub/shared/types";
import {
  assertStagedRemoteSkillPackageSafe,
  SkillSafetyBlockedError,
  SkillSafetyReviewRequiredError,
} from "../../../src/main/services/skill-update-safety";

const safePreflight: SkillSafetyReport = {
  level: "safe",
  summary: "Local package checks passed.",
  findings: [],
  recommendedAction: "allow",
  scannedAt: 1,
  checkedFileCount: 1,
  scanMethod: "preflight",
};

describe("staged Skill package safety resilience", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "prompthub-safety-resilience-"),
    );
    await fs.writeFile(
      path.join(tempDir, "SKILL.md"),
      "---\nname: writer\n---\n\n# Writer\n",
      "utf8",
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function createInput(preflightReport: SkillSafetyReport) {
    return {
      skill: { name: "writer" },
      skillDir: tempDir,
      sourceUrl: "https://github.com/example/skills",
      packageFingerprint: "a".repeat(64),
      sourceKey: "git:github.com/example/skills@main:writer",
      safetyScan: {
        aiConfig: {
          provider: "openai",
          apiProtocol: "openai" as const,
          apiKey: "expired-token",
          apiUrl: "https://api.example.com/v1/chat/completions",
          model: "gpt-test",
        },
        preflightScan: vi.fn().mockResolvedValue(preflightReport),
        scan: vi.fn().mockRejectedValue(new Error("Invalid token")),
      },
    };
  }

  it("keeps the completed package preflight when the optional AI token is rejected", async () => {
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const report = await assertStagedRemoteSkillPackageSafe(
      createInput(safePreflight),
    );

    expect(report).toEqual(safePreflight);
    expect(warnSpy).toHaveBeenCalledWith(
      "AI package safety assessment unavailable; enforcing deterministic preflight:",
      expect.any(Error),
    );
  });

  it("still blocks a package rejected by deterministic preflight", async () => {
    const input = createInput({
      ...safePreflight,
      level: "blocked",
      recommendedAction: "block",
    });

    await expect(
      assertStagedRemoteSkillPackageSafe(input),
    ).rejects.toBeInstanceOf(SkillSafetyBlockedError);
    expect(input.safetyScan.scan).not.toHaveBeenCalled();
  });

  it("still requires fingerprint review for high-risk preflight after AI failure", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const input = createInput({
      ...safePreflight,
      level: "high-risk",
      recommendedAction: "review",
    });

    await expect(
      assertStagedRemoteSkillPackageSafe(input),
    ).rejects.toBeInstanceOf(SkillSafetyReviewRequiredError);
  });

  it("skips content scanners when the lifecycle explicitly disables automatic scanning", async () => {
    const preflightScan = vi.fn().mockResolvedValue(safePreflight);
    const scan = vi.fn().mockResolvedValue(safePreflight);

    await expect(
      assertStagedRemoteSkillPackageSafe({
        skill: { name: "writer" },
        skillDir: tempDir,
        sourceUrl: "https://gitea.example.com/team/skills",
        packageFingerprint: "a".repeat(64),
        sourceKey: "team-gitea",
        safetyScan: {
          mode: "disabled",
          preflightScan,
          scan,
        },
      }),
    ).resolves.toBeUndefined();

    expect(preflightScan).not.toHaveBeenCalled();
    expect(scan).not.toHaveBeenCalled();
  });
});
