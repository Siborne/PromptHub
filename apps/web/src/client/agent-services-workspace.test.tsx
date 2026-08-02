import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ManagedAgentSummary } from "@prompthub/shared/types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

import { WebAgentServicesWorkspace } from "../../../desktop/src/renderer/components/agent/WebAgentServicesWorkspace";

const agent = {
  id: "codex",
  name: "Codex",
  paths: { root: "/srv/codex" },
} as ManagedAgentSummary;

describe("WebAgentServicesWorkspace", () => {
  const getServiceManifest = vi.fn();
  const getService = vi.fn();

  beforeEach(() => {
    getServiceManifest.mockReset();
    getService.mockReset();
    Reflect.set(window, "api", {
      agent: { getServiceManifest, getService },
    });
  });

  afterEach(() => cleanup());

  it("shows the self-hosted service manifest and opens every service in place", async () => {
    getServiceManifest.mockResolvedValue([
      { domain: "skills", serviceAvailable: true, status: "available" },
      { domain: "maintenance", serviceAvailable: true, status: "partial" },
    ]);
    getService.mockResolvedValue({
      agentId: "codex",
      domain: "skills",
      status: "available",
      items: [{ id: "writer", label: "Writer", state: "available" }],
      total: 1,
      truncated: false,
      actions: { browse: "available", install: "unavailable" },
    });

    render(<WebAgentServicesWorkspace agent={agent} />);

    expect(await screen.findByRole("button", { name: /Skills/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Maintenance/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Skills/ }));

    expect(await screen.findByText("Writer")).toBeTruthy();
    expect(
      screen.getByText(/Browse: Available in self-hosted Web/),
    ).toBeTruthy();
    expect(screen.getByText(/Install: Unavailable in browser/)).toBeTruthy();
    expect(getService).toHaveBeenCalledWith("codex", "skills");
  });

  it("shows unavailable services without failing the manifest view", async () => {
    getServiceManifest.mockResolvedValue([
      { domain: "appearance", serviceAvailable: false, status: "unavailable" },
    ]);

    render(<WebAgentServicesWorkspace agent={agent} />);

    expect(
      await screen.findByRole("button", { name: /Appearance/ }),
    ).toBeTruthy();
    expect(screen.getByText("Unavailable")).toBeTruthy();
  });

  it("recovers from a failed domain request without rendering stale data", async () => {
    getService
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({
        agentId: "codex",
        domain: "rules",
        status: "available",
        items: [],
        total: 0,
        truncated: false,
        actions: { browse: "available" },
      });

    render(<WebAgentServicesWorkspace agent={agent} domain="rules" />);

    expect(await screen.findByText("network down")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(getService).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("No items yet.")).toBeTruthy();
  });
});
