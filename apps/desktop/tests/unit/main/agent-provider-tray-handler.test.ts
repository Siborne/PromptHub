/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from "vitest";

import { getTrayMenuLabels } from "../../../src/main/tray-menu";
import { handleAgentProviderTraySelection } from "../../../src/main/services/agent-provider-tray-handler";

function createHarness(status: string, model: string | null = "claude-opus-4") {
  const switchProfile = vi.fn(async (_input, confirm) => {
    if (status === "needs-confirmation") {
      const accepted = await confirm({
        agentName: "Claude Code",
        profileName: "Primary",
        model,
        changedFields: 2,
      });
      return {
        status: accepted ? "verified" : "cancelled",
        agentId: "claude",
        profileId: "profile-1",
      };
    }
    return {
      status,
      agentId: "claude",
      profileId: "profile-1",
    };
  });
  const showMessageBox = vi.fn(async () => ({ response: 0 }));
  const openAgents = vi.fn();
  const reloadAgentProviders = vi.fn(async () => undefined);
  return {
    input: { agentId: "claude", profileId: "profile-1" },
    labels: getTrayMenuLabels("en"),
    openAgents,
    reloadAgentProviders,
    service: { switchProfile } as never,
    showMessageBox,
    switchProfile,
  };
}

describe("agent provider tray handler", () => {
  it("shows one confirmation and refreshes only after verified activation", async () => {
    const harness = createHarness("needs-confirmation");

    await handleAgentProviderTraySelection(harness);

    expect(harness.showMessageBox).toHaveBeenCalledOnce();
    expect(harness.showMessageBox).toHaveBeenCalledWith(
      expect.objectContaining({
        buttons: ["Switch", "Cancel"],
        detail: "Claude Code\nPrimary · claude-opus-4",
        message: "Switch provider profile?",
        type: "question",
      }),
    );
    expect(harness.reloadAgentProviders).toHaveBeenCalledOnce();
    expect(harness.openAgents).not.toHaveBeenCalled();
  });

  it("opens the workspace after a review-required preview", async () => {
    const harness = createHarness("review-required");

    await handleAgentProviderTraySelection(harness);

    expect(harness.showMessageBox).toHaveBeenCalledOnce();
    expect(harness.showMessageBox).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Review this change in the Agent workspace.",
        type: "warning",
      }),
    );
    expect(harness.openAgents).toHaveBeenCalledOnce();
    expect(harness.reloadAgentProviders).not.toHaveBeenCalled();
  });

  it("formats a confirmation without an optional model", async () => {
    const harness = createHarness("needs-confirmation", null);

    await handleAgentProviderTraySelection(harness);

    expect(harness.showMessageBox).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: "Claude Code\nPrimary",
      }),
    );
  });

  it("reports a failed switch without exposing an internal error", async () => {
    const harness = createHarness("failed");

    await handleAgentProviderTraySelection(harness);

    expect(harness.showMessageBox).toHaveBeenCalledOnce();
    expect(harness.showMessageBox).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Provider switch failed and no state was assumed.",
        type: "error",
      }),
    );
    expect(JSON.stringify(harness.showMessageBox.mock.calls)).not.toContain(
      "secret",
    );
  });

  it.each(["cancelled", "already-active"])(
    "does not open another dialog for %s",
    async (status) => {
      const harness = createHarness(status);

      await handleAgentProviderTraySelection(harness);

      expect(harness.showMessageBox).not.toHaveBeenCalled();
      expect(harness.openAgents).not.toHaveBeenCalled();
      expect(harness.reloadAgentProviders).not.toHaveBeenCalled();
    },
  );
});
