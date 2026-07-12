import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CloudStoreEngagement } from "../../../src/renderer/components/skill/CloudStoreEngagement";
import { renderWithI18n } from "../../helpers/i18n";
import { installWindowMocks } from "../../helpers/window";

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("../../../src/renderer/components/ui/Toast", () => ({
  useToast: () => ({ showToast }),
}));

describe("CloudStoreEngagement", () => {
  beforeEach(() => {
    showToast.mockReset();
  });

  it("loads viewer state, toggles interactions, and submits a bounded report", async () => {
    const user = userEvent.setup();
    const like = vi.fn().mockResolvedValue({ likeCount: 4, favoriteCount: 2, installCount: 8, downloadCount: 9, viewCount: 20 });
    const favorite = vi.fn().mockResolvedValue({ likeCount: 4, favoriteCount: 3, installCount: 8, downloadCount: 9, viewCount: 20 });
    const report = vi.fn().mockResolvedValue(undefined);
    installWindowMocks({
      api: {
        cloud: {
          auth: { getState: vi.fn().mockResolvedValue({ authenticated: true }) },
          store: {
            getListing: vi.fn().mockResolvedValue({
              listing: { id: "listing-1", slug: "demo", title: "Demo" },
              metrics: { likeCount: 3, favoriteCount: 2, installCount: 8, downloadCount: 9, viewCount: 20 },
              viewerState: { liked: false, favorited: false },
            }),
            like,
            unlike: vi.fn(),
            favorite,
            unfavorite: vi.fn(),
            report,
          },
        },
      },
    });

    await renderWithI18n(<CloudStoreEngagement slug="demo" />, { language: "en" });
    expect(await screen.findByRole("button", { name: "Like 3" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Like 3" }));
    await waitFor(() => expect(like).toHaveBeenCalledWith("listing-1"));
    expect(screen.getByRole("button", { name: "Like 4" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Favorite 2" }));
    await waitFor(() => expect(favorite).toHaveBeenCalledWith("listing-1"));
    expect(screen.getByRole("button", { name: "Favorite 3" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Report" }));
    fireEvent.change(screen.getByLabelText("Additional details"), {
      target: { value: "contains an unsafe command" },
    });
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() =>
      expect(report).toHaveBeenCalledWith("listing-1", {
        reason: "security",
        details: "contains an unsafe command",
      }),
    );
  });

  it("does not send interaction writes for a signed-out viewer", async () => {
    const like = vi.fn();
    installWindowMocks({
      api: {
        cloud: {
          auth: { getState: vi.fn().mockResolvedValue({ authenticated: false }) },
          store: {
            getListing: vi.fn().mockResolvedValue({
              listing: { id: "listing-1", slug: "demo", title: "Demo" },
              metrics: { likeCount: 0, favoriteCount: 0, installCount: 0, downloadCount: 0, viewCount: 0 },
              viewerState: { liked: false, favorited: false },
            }),
            like,
            unlike: vi.fn(),
            favorite: vi.fn(),
            unfavorite: vi.fn(),
            report: vi.fn(),
          },
        },
      },
    });

    await renderWithI18n(<CloudStoreEngagement slug="demo" />, { language: "en" });
    await userEvent.setup().click(await screen.findByRole("button", { name: "Like 0" }));

    expect(like).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("Sign in to interact with the Store", "info");
  });
});
