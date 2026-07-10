import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  platform: { OS: "web" },
}));

vi.mock("react-native", () => ({
  Alert: { alert: mocks.alert },
  Platform: mocks.platform,
}));

import {
  showPlatformAlert,
  showPlatformConfirmation,
} from "./platformAlerts";

afterEach(() => {
  mocks.alert.mockReset();
  mocks.platform.OS = "web";
  vi.unstubAllGlobals();
});

describe("platform alerts", () => {
  it("uses browser alerts on web", () => {
    const browserAlert = vi.fn();
    vi.stubGlobal("alert", browserAlert);

    showPlatformAlert("Save failed", "Try again");

    expect(browserAlert).toHaveBeenCalledWith("Save failed\n\nTry again");
    expect(mocks.alert).not.toHaveBeenCalled();
  });

  it("uses native alerts outside web", () => {
    mocks.platform.OS = "ios";

    showPlatformAlert("Save failed", "Try again");

    expect(mocks.alert).toHaveBeenCalledWith("Save failed", "Try again");
  });

  it("only confirms web actions after browser approval", () => {
    const onConfirm = vi.fn();
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.stubGlobal("confirm", confirm);
    const options = {
      cancelLabel: "Cancel",
      confirmLabel: "Delete",
      message: "Delete this Prompt?",
      onConfirm,
      title: "Delete Prompt",
    };

    showPlatformConfirmation(options);
    showPlatformConfirmation(options);

    expect(confirm).toHaveBeenCalledWith(
      "Delete Prompt\n\nDelete this Prompt?",
    );
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("provides cancel and destructive actions to native alerts", () => {
    const onConfirm = vi.fn();
    mocks.platform.OS = "android";

    showPlatformConfirmation({
      cancelLabel: "Cancel",
      confirmLabel: "Delete",
      message: "Delete this Prompt?",
      onConfirm,
      title: "Delete Prompt",
    });

    const buttons = mocks.alert.mock.calls[0]?.[2];
    expect(buttons).toMatchObject([
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive" },
    ]);
    buttons?.[1]?.onPress?.();
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
