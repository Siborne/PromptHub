import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SkillMarkdown } from "../../../src/renderer/components/skill/SkillMarkdown";

describe("SkillMarkdown", () => {
  it("renders unsafe markdown links as text instead of empty clickable anchors", () => {
    render(
      <SkillMarkdown
        content={
          "[bad](javascript:alert(1)) [file](file:///etc/passwd) [ok](https://example.com/docs)"
        }
      />,
    );

    expect(screen.getByText("bad").closest("a")).toBeNull();
    expect(screen.getByText("file").closest("a")).toBeNull();
    expect(screen.getByRole("link", { name: "ok" })).toHaveAttribute(
      "href",
      "https://example.com/docs",
    );
  });

  it("keeps GitHub relative markdown links clickable when a safe base exists", () => {
    render(
      <SkillMarkdown
        content={"[setup](docs/setup.md)"}
        sourceUrl="https://github.com/anthropics/skills/tree/main/skills/pdf"
      />,
    );

    expect(screen.getByRole("link", { name: "setup" })).toHaveAttribute(
      "href",
      "https://github.com/anthropics/skills/blob/main/skills/pdf/docs/setup.md",
    );
  });

  it("marks rendered Markdown blocks with their source line when requested", () => {
    render(
      <SkillMarkdown
        content={"# First section\n\nOpening text.\n\n## Second section"}
        enableHighlight
        trackSourceLines
      />,
    );

    expect(
      screen.getByRole("heading", { name: "First section" }),
    ).toHaveAttribute("data-source-line", "1");
    expect(screen.getByText("Opening text.")).toHaveAttribute(
      "data-source-line",
      "3",
    );
    expect(
      screen.getByRole("heading", { name: "Second section" }),
    ).toHaveAttribute("data-source-line", "5");
  });

  it("keeps in-document table-of-contents links inside the Markdown surface", () => {
    render(
      <SkillMarkdown
        content={
          "[代码提交规则](#1-代码提交规则submission-policy)\n\n## 1. 代码提交规则（Submission Policy）"
        }
      />,
    );

    expect(screen.getByRole("link", { name: "代码提交规则" })).toHaveAttribute(
      "href",
      "#1-%E4%BB%A3%E7%A0%81%E6%8F%90%E4%BA%A4%E8%A7%84%E5%88%99submission-policy",
    );
    expect(
      screen.getByRole("link", { name: "代码提交规则" }),
    ).not.toHaveAttribute("target");
    const heading = screen.getByRole("heading", {
      name: "1. 代码提交规则（Submission Policy）",
    });
    expect(
      screen.getByRole("heading", {
        name: "1. 代码提交规则（Submission Policy）",
      }),
    ).toHaveAttribute("id", "1-代码提交规则submission-policy");

    const scrollIntoView = vi.fn();
    heading.scrollIntoView = scrollIntoView;
    fireEvent.click(screen.getByRole("link", { name: "代码提交规则" }));
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
  });

  it("creates stable unique heading anchors and tolerates malformed fragments", () => {
    render(
      <SkillMarkdown
        content={
          "# !!!\n\n# Repeat\n\n# Repeat\n\n# Hello *world*\n\n[broken](#%E0%A4%A)"
        }
      />,
    );

    expect(screen.getByRole("heading", { name: "!!!" })).toHaveAttribute(
      "id",
      "section",
    );
    expect(
      screen.getAllByRole("heading", { name: "Repeat" })[0],
    ).toHaveAttribute("id", "repeat");
    expect(
      screen.getAllByRole("heading", { name: "Repeat" })[1],
    ).toHaveAttribute("id", "repeat-1");
    expect(
      screen.getByRole("heading", { name: "Hello world" }),
    ).toHaveAttribute("id", "hello-world");
    expect(() =>
      fireEvent.click(screen.getByRole("link", { name: "broken" })),
    ).not.toThrow();
  });

  it("keeps safe images lazy and replaces unsafe images with their alt text", () => {
    const { container } = render(
      <SkillMarkdown
        content={
          "![safe](https://example.com/image.png) ![unsafe](file:///tmp/private.png) ![](https://example.com/decorative.png) ![](file:///tmp/hidden.png)"
        }
      />,
    );

    expect(screen.getByRole("img", { name: "safe" })).toHaveAttribute(
      "loading",
      "lazy",
    );
    expect(screen.getByText("unsafe").closest("img")).toBeNull();
    expect(container.querySelectorAll("img")).toHaveLength(2);
    expect(container.querySelector('img[alt=""]')).not.toBeNull();
  });
});
