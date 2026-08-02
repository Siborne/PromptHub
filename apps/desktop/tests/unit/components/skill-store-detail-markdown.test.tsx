import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SkillStoreDetailMarkdown } from "../../../src/renderer/components/skill/SkillStoreDetailMarkdown";

const markdownRender = vi.hoisted(() => vi.fn());

vi.mock("../../../src/renderer/components/skill/SkillMarkdown", () => ({
  SkillMarkdown: (props: { content: string }) => {
    markdownRender(props.content);
    return <div>{props.content}</div>;
  },
}));

describe("SkillStoreDetailMarkdown", () => {
  it("renders original, full translation, and immersive translation modes", () => {
    const view = render(
      <SkillStoreDetailMarkdown
        contentUrl="https://example.com/SKILL.md"
        effectiveContent="# Original"
        showTranslation={false}
        sourceUrl="https://example.com/repo"
        translatedContent="# Translated"
        translationMode="full"
      />,
    );
    expect(markdownRender).toHaveBeenLastCalledWith("# Original");

    view.rerender(
      <SkillStoreDetailMarkdown
        contentUrl="https://example.com/SKILL.md"
        effectiveContent="# Original"
        showTranslation
        sourceUrl="https://example.com/repo"
        translatedContent="# Translated"
        translationMode="full"
      />,
    );
    expect(markdownRender).toHaveBeenLastCalledWith("# Translated");

    view.rerender(
      <SkillStoreDetailMarkdown
        contentUrl="https://example.com/SKILL.md"
        effectiveContent="# Original"
        showTranslation
        sourceUrl="https://example.com/repo"
        translatedContent={"Original\n<t>译文</t>"}
        translationMode="immersive"
      />,
    );
    expect(markdownRender).toHaveBeenCalledWith("译文");
  });

  it("does not rerender markdown when its stable inputs are unchanged", () => {
    markdownRender.mockClear();
    const props = {
      contentUrl: "https://example.com/SKILL.md",
      effectiveContent: "# Stable",
      showTranslation: false,
      sourceUrl: "https://example.com/repo",
      translatedContent: "# Translated",
      translationMode: "full" as const,
    };
    const view = render(<SkillStoreDetailMarkdown {...props} />);
    expect(markdownRender).toHaveBeenCalledTimes(1);

    view.rerender(<SkillStoreDetailMarkdown {...props} />);

    expect(markdownRender).toHaveBeenCalledTimes(1);
  });
});
