import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  RegistrySkill,
  SkillUpdateSafetyReview,
} from "@prompthub/shared/types";
import {
  useRegistrySkillUpdateReview,
  useSkillPackageInstall,
} from "../../../src/renderer/components/skill/useSkillPackageInstall";
import { useSettingsStore } from "../../../src/renderer/stores/settings.store";
import { useSkillStore } from "../../../src/renderer/stores/skill.store";

const SKILL = {
  slug: "writer",
  source_id: "source-writer",
  name: "Writer",
  description: "Writer",
  category: "general",
  tags: [],
  version: "1.0.0",
  content: "# Writer",
} as RegistrySkill;

function makeReview(fingerprint: string): SkillUpdateSafetyReview {
  return {
    sourceKey: "git:https://gitea.example.com/team/skills#main:skills/writer",
    packageFingerprint: fingerprint,
    report: {
      level: "high-risk",
      summary: `Review ${fingerprint.slice(0, 1)}`,
      findings: [],
      recommendedAction: "review",
      scannedAt: 1,
      checkedFileCount: 2,
      scanMethod: "preflight",
    },
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("Skill package operation controllers", () => {
  const trustSource = vi.fn();

  beforeEach(() => {
    trustSource.mockReset();
    useSettingsStore.setState({
      trustSkillUpdateSource: trustSource,
      trustedSkillUpdateSourceKeys: [],
    } as never);
  });

  it("keeps a changed package in review and does not persist trust", async () => {
    const firstReview = makeReview("a".repeat(64));
    const changedReview = makeReview("b".repeat(64));
    const installRegistrySkill = vi
      .fn()
      .mockResolvedValueOnce({
        status: "safety-review-required",
        review: firstReview,
      })
      .mockResolvedValueOnce({
        status: "safety-review-required",
        review: changedReview,
      });
    useSkillStore.setState({ installRegistrySkill } as never);
    const { result } = renderHook(() => useSkillPackageInstall());

    await act(async () => {
      await result.current.install(SKILL);
    });
    act(() => result.current.setTrustReviewedSource(true));
    await act(async () => {
      await result.current.confirmReview();
    });

    expect(installRegistrySkill).toHaveBeenLastCalledWith(SKILL, {
      approvedPackageFingerprint: firstReview.packageFingerprint,
    });
    expect(result.current.pendingReview?.review).toEqual(changedReview);
    expect(result.current.trustReviewedSource).toBe(false);
    expect(trustSource).not.toHaveBeenCalled();
  });

  it("persists exact-source trust only after a reviewed update completes", async () => {
    const review = makeReview("c".repeat(64));
    const updateRegistrySkill = vi.fn().mockResolvedValue({
      status: "updated",
      skill: { id: "writer" },
      check: { status: "update-available" },
    });
    useSkillStore.setState({ updateRegistrySkill } as never);
    const { result } = renderHook(() => useRegistrySkillUpdateReview());

    act(() => {
      result.current.enqueueReview(SKILL, review);
      result.current.setTrustReviewedSource(true);
    });
    await act(async () => {
      await result.current.confirmReview();
    });

    expect(updateRegistrySkill).toHaveBeenCalledWith(SKILL.source_id, {
      approvedPackageFingerprint: review.packageFingerprint,
    });
    expect(trustSource).toHaveBeenCalledWith(review.sourceKey);
    expect(result.current.pendingReview).toBeNull();
  });

  it("persists exact-source trust only after a reviewed install completes", async () => {
    const review = makeReview("9".repeat(64));
    const installRegistrySkill = vi
      .fn()
      .mockResolvedValueOnce({ status: "safety-review-required", review })
      .mockResolvedValueOnce({
        status: "installed",
        skill: { id: "writer", name: "Writer" },
      });
    useSkillStore.setState({ installRegistrySkill } as never);
    const { result } = renderHook(() => useSkillPackageInstall());

    await act(async () => {
      await result.current.install(SKILL);
    });
    act(() => result.current.setTrustReviewedSource(true));
    await act(async () => {
      await result.current.confirmReview();
    });

    expect(trustSource).toHaveBeenCalledWith(review.sourceKey);
    expect(result.current.pendingReview).toBeNull();
  });

  it("deduplicates install reviews and supports close, reset, and untrusted completion", async () => {
    const review = makeReview("d".repeat(64));
    const anotherReview = makeReview("e".repeat(64));
    const installed = {
      status: "installed" as const,
      skill: { id: "writer", name: "Writer" },
    };
    const installRegistrySkill = vi
      .fn()
      .mockResolvedValueOnce(installed)
      .mockResolvedValueOnce({ status: "safety-review-required", review })
      .mockResolvedValueOnce({ status: "safety-review-required", review })
      .mockResolvedValueOnce(installed)
      .mockResolvedValueOnce({
        status: "safety-review-required",
        review: anotherReview,
      })
      .mockResolvedValueOnce({ status: "safety-review-required", review });
    useSkillStore.setState({ installRegistrySkill } as never);
    const { result } = renderHook(() => useSkillPackageInstall());

    await expect(result.current.confirmReview()).resolves.toBeNull();
    await act(async () => {
      await result.current.install(SKILL, {
        approvedPackageFingerprint: "f".repeat(64),
      });
      await result.current.install(SKILL);
      await result.current.install(SKILL);
    });
    expect(result.current.pendingReviewCount).toBe(1);

    await act(async () => {
      await result.current.confirmReview();
    });
    expect(result.current.pendingReview).toBeNull();
    expect(trustSource).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.install(SKILL);
    });
    act(() => result.current.closeReview());
    expect(result.current.pendingReview).toBeNull();

    await act(async () => {
      await result.current.install(SKILL);
    });
    act(() => result.current.resetReviews());
    expect(result.current.pendingReviewCount).toBe(0);
  });

  it("guards install review actions while confirmation is in flight", async () => {
    const review = makeReview("f".repeat(64));
    const confirmation = createDeferred<{
      status: "installed";
      skill: { id: string; name: string };
    }>();
    const installRegistrySkill = vi
      .fn()
      .mockResolvedValueOnce({ status: "safety-review-required", review })
      .mockReturnValueOnce(confirmation.promise);
    useSkillStore.setState({ installRegistrySkill } as never);
    const { result } = renderHook(() => useSkillPackageInstall());
    await act(async () => {
      await result.current.install(SKILL);
    });

    let pendingConfirmation!: ReturnType<typeof result.current.confirmReview>;
    act(() => {
      pendingConfirmation = result.current.confirmReview();
    });
    expect(result.current.isConfirmingReview).toBe(true);
    await expect(result.current.confirmReview()).resolves.toBeNull();
    act(() => {
      result.current.closeReview();
      result.current.resetReviews();
    });
    expect(result.current.pendingReview).not.toBeNull();

    confirmation.resolve({
      status: "installed",
      skill: { id: "writer", name: "Writer" },
    });
    await act(async () => {
      await pendingConfirmation;
    });
    expect(result.current.pendingReview).toBeNull();
    expect(result.current.isConfirmingReview).toBe(false);
  });

  it("deduplicates update reviews, replaces changed reviews, and completes without trust", async () => {
    const review = makeReview("1".repeat(64));
    const changedReview = makeReview("2".repeat(64));
    const updateRegistrySkill = vi
      .fn()
      .mockResolvedValueOnce({
        status: "safety-review-required",
        review: changedReview,
      })
      .mockResolvedValueOnce({
        status: "updated",
        skill: { id: "writer" },
        check: { status: "update-available" },
      });
    useSkillStore.setState({ updateRegistrySkill } as never);
    const { result } = renderHook(() => useRegistrySkillUpdateReview());

    await expect(result.current.confirmReview()).resolves.toBeNull();
    act(() => {
      result.current.enqueueReview(SKILL, review);
      result.current.enqueueReview(SKILL, review);
    });
    expect(result.current.pendingReviewCount).toBe(1);

    await act(async () => {
      await result.current.confirmReview();
    });
    expect(result.current.pendingReview?.review).toEqual(changedReview);
    expect(result.current.trustReviewedSource).toBe(false);

    await act(async () => {
      await result.current.confirmReview();
    });
    expect(result.current.pendingReview).toBeNull();
    expect(trustSource).not.toHaveBeenCalled();

    act(() => {
      result.current.enqueueReview(SKILL, review);
      result.current.closeReview();
    });
    expect(result.current.pendingReview).toBeNull();
  });

  it("guards update review confirmation and close while the update is in flight", async () => {
    const review = makeReview("3".repeat(64));
    const confirmation = createDeferred<{
      status: "updated";
      skill: { id: string };
      check: { status: "update-available" };
    }>();
    const updateRegistrySkill = vi
      .fn()
      .mockReturnValueOnce(confirmation.promise);
    useSkillStore.setState({ updateRegistrySkill } as never);
    const { result } = renderHook(() => useRegistrySkillUpdateReview());
    act(() => result.current.enqueueReview(SKILL, review));

    let pendingConfirmation!: ReturnType<typeof result.current.confirmReview>;
    act(() => {
      pendingConfirmation = result.current.confirmReview();
    });
    expect(result.current.isConfirmingReview).toBe(true);
    await expect(result.current.confirmReview()).resolves.toBeNull();
    act(() => result.current.closeReview());
    expect(result.current.pendingReview).not.toBeNull();

    confirmation.resolve({
      status: "updated",
      skill: { id: "writer" },
      check: { status: "update-available" },
    });
    await act(async () => {
      await pendingConfirmation;
    });
    expect(result.current.pendingReview).toBeNull();
    expect(result.current.isConfirmingReview).toBe(false);
  });
});
