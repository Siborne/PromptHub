import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AgentConversationMarkdown } from "../../../src/renderer/components/agent/AgentConversationMarkdown";

describe("AgentConversationMarkdown", () => {
  it("renders compact GFM content and preserves safe links", () => {
    render(
      <AgentConversationMarkdown
        content={[
          "## Fix plan",
          "",
          "- **Remove** the invalid config",
          "- Run `pnpm test`",
          "",
          "[Open docs](https://example.com/docs)",
        ].join("\n")}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Fix plan", level: 2 }),
    ).toBeVisible();
    expect(screen.getByText("Remove").tagName).toBe("STRONG");
    expect(screen.getByText("pnpm test").tagName).toBe("CODE");
    expect(screen.getByRole("link", { name: "Open docs" })).toHaveAttribute(
      "href",
      "https://example.com/docs",
    );
  });

  it("does not expose unsafe links or remote images", () => {
    render(
      <AgentConversationMarkdown
        content={[
          "[Run script](javascript:alert(1))",
          "",
          "![tracker](https://example.com/tracker.png)",
        ].join("\n")}
      />,
    );

    expect(screen.queryByRole("link", { name: "Run script" })).toBeNull();
    expect(screen.queryByRole("img", { name: "tracker" })).toBeNull();
    expect(screen.getByText("tracker")).toBeVisible();
  });

  it("contains wide GFM tables inside a horizontal scroll region", () => {
    const { container } = render(
      <AgentConversationMarkdown
        content={[
          "| File | Focus | Do not put here |",
          "| --- | --- | --- |",
          "| `docs/workflow/01-requirements/README.md` | what / why / success | framework and implementation details |",
        ].join("\n")}
      />,
    );

    const table = screen.getByRole("table");
    expect(table).toHaveClass("min-w-full", "w-max");
    expect(table.parentElement).toHaveClass(
      "min-w-0",
      "max-w-full",
      "overflow-x-auto",
    );
    expect(container.firstElementChild).toHaveClass("min-w-0", "max-w-full");
  });
});
