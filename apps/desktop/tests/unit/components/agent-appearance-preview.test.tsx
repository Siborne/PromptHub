import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentAppearancePreview } from "../../../src/renderer/components/agent/AgentAppearancePreview";
import { installWindowMocks } from "../../helpers/window";

describe("AgentAppearancePreview", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("crops a v1 Pet atlas into an animated idle preview", async () => {
    vi.useFakeTimers();
    installWindowMocks({
      api: {
        agent: {
          getAgentPetPreview: vi
            .fn()
            .mockResolvedValue("data:image/webp;base64,cGV0"),
        },
      },
    });

    render(
      <AgentAppearancePreview
        agentId="codex"
        assetId="orbit"
        kind="pet"
        alt="Orbit"
        spriteVersionNumber={1}
      />,
    );
    await act(async () => Promise.resolve());

    const preview = screen.getByRole("img", { name: "Orbit" });
    expect(preview).toHaveAttribute("data-frame", "0");
    expect(preview).toHaveStyle({
      backgroundImage: 'url("data:image/webp;base64,cGV0")',
      backgroundSize: "800% 900%",
      backgroundPosition: "0% 0%",
    });
    expect(screen.queryByAltText("Orbit")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(280));
    expect(preview).toHaveAttribute("data-frame", "1");
    expect(preview).toHaveStyle({
      backgroundPosition: "14.285714285714285% 0%",
    });
  });

  it("uses the v2 row count and stays on frame zero for reduced motion", async () => {
    vi.useFakeTimers();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    installWindowMocks({
      api: {
        agent: {
          getAgentPetPreview: vi
            .fn()
            .mockResolvedValue("data:image/png;base64,cGV0"),
        },
      },
    });

    render(
      <AgentAppearancePreview
        agentId="codex"
        assetId="nova"
        kind="pet"
        alt="Nova"
        spriteVersionNumber={2}
      />,
    );
    await act(async () => Promise.resolve());

    const preview = screen.getByRole("img", { name: "Nova" });
    expect(preview).toHaveStyle({ backgroundSize: "800% 1100%" });
    act(() => vi.advanceTimersByTime(2_000));
    expect(preview).toHaveAttribute("data-frame", "0");
  });
});
