import { render, screen } from "@testing-library/react";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { PlatformIcon } from "../../../src/renderer/components/ui/PlatformIcon";

const PNG_SIGNATURE = "89504e470d0a1a0a";
const platformAssetsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../src/renderer/assets/platforms",
);

describe("PlatformIcon", () => {
  it("renders the real Cherry Studio icon instead of the generic fallback", () => {
    render(<PlatformIcon platformId="cherry-studio" size={20} />);

    const icon = screen.getByRole("img", { name: "cherry-studio icon" });
    expect(icon).toHaveAttribute(
      "src",
      expect.stringContaining("cherry-studio.png"),
    );
  });

  it("renders the QClaw icon instead of reusing the OpenClaw icon", () => {
    render(<PlatformIcon platformId="qclaw" size={20} />);

    const icon = screen.getByRole("img", { name: "qclaw icon" });
    expect(icon).toHaveAttribute("src", expect.stringContaining("qclaw.png"));
    expect(icon).not.toHaveAttribute(
      "src",
      expect.stringContaining("openclaw.png"),
    );
  });

  it("keeps TRAE IDE and TRAE Work variants on the TRAE brand icon", () => {
    for (const platformId of ["trae", "trae-work", "trae-cn", "trae-work-cn"]) {
      const { unmount } = render(
        <PlatformIcon platformId={platformId} size={20} />,
      );

      expect(
        screen.getByRole("img", { name: `${platformId} icon` }),
      ).toHaveAttribute("src", expect.stringContaining("trae.png"));

      unmount();
    }
  });

  it("renders the WorkBuddy icon instead of the generic fallback", () => {
    render(<PlatformIcon platformId="workbuddy" size={20} />);

    const icon = screen.getByRole("img", { name: "workbuddy icon" });
    expect(icon).toHaveAttribute(
      "src",
      expect.stringContaining("workbuddy.svg"),
    );
  });

  it("renders the official ZCode mark", () => {
    render(<PlatformIcon platformId="zcode" size={20} />);

    const icon = screen.getByRole("img", { name: "zcode icon" });
    expect(icon).toHaveAttribute("src", expect.stringContaining("zcode.svg"));
  });

  it("renders the Grok brand icon in both light and dark themes", () => {
    render(<PlatformIcon platformId="grok" size={20} />);

    const icons = screen.getAllByRole("img", { name: "grok icon" });
    expect(icons).toHaveLength(2);
    expect(icons[0]).toHaveAttribute(
      "src",
      expect.stringContaining("grok-light.svg"),
    );
    expect(icons[1]).toHaveAttribute(
      "src",
      expect.stringContaining("grok-dark.svg"),
    );
  });

  it("keeps bundled platform PNG assets as real PNG files", () => {
    const invalidPngFiles = readdirSync(platformAssetsDir)
      .filter((fileName) => fileName.endsWith(".png"))
      .filter((fileName) => {
        const signature = readFileSync(join(platformAssetsDir, fileName))
          .subarray(0, 8)
          .toString("hex");

        return signature !== PNG_SIGNATURE;
      });

    expect(invalidPngFiles).toEqual([]);
  });

  it("renders the official Reasonix mark", () => {
    render(<PlatformIcon platformId="reasonix" size={20} />);

    expect(screen.getByRole("img", { name: "reasonix icon" })).toHaveAttribute(
      "src",
      expect.stringContaining("reasonix.svg"),
    );
  });

  it("renders the official Kimi Code CLI mark", () => {
    render(<PlatformIcon platformId="kimi" size={20} />);

    expect(screen.getByRole("img", { name: "kimi icon" })).toHaveAttribute(
      "src",
      expect.stringContaining("kimi.png"),
    );
  });

  it("keeps the Auggie mark legible in app-controlled light and dark themes", () => {
    render(<PlatformIcon platformId="augment" size={20} />);

    const icon = screen.getByRole("img", { name: "augment icon" });
    expect(icon).toHaveAttribute("src", expect.stringContaining("augment.svg"));
    expect(icon).toHaveClass("brightness-0", "dark:invert");

    const asset = readFileSync(join(platformAssetsDir, "augment.svg"), "utf8");
    expect(asset).toContain('fill="#000000"');
    expect(asset).not.toContain("prefers-color-scheme");
  });
});
