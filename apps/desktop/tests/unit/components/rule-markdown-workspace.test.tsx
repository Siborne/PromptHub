import { useEffect, useRef, useState } from "react";
import userEvent from "@testing-library/user-event";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RuleMarkdownWorkspace } from "../../../src/renderer/components/rules/RuleMarkdownWorkspace";
import de from "../../../src/renderer/i18n/locales/de.json";
import en from "../../../src/renderer/i18n/locales/en.json";
import es from "../../../src/renderer/i18n/locales/es.json";
import fr from "../../../src/renderer/i18n/locales/fr.json";
import ja from "../../../src/renderer/i18n/locales/ja.json";
import zhTW from "../../../src/renderer/i18n/locales/zh-TW.json";
import zh from "../../../src/renderer/i18n/locales/zh.json";
import { renderWithI18n } from "../../helpers/i18n";

vi.mock("../../../src/renderer/components/skill/SkillCodeEditor", () => ({
  SkillCodeEditor: ({
    ariaLabel,
    editable,
    onChange,
    onReady,
    testId,
    value,
  }: {
    ariaLabel: string;
    editable: boolean;
    onChange: (value: string) => void;
    onReady?: (view: { scrollDOM: HTMLDivElement }) => void;
    testId: string;
    value: string;
  }) => {
    const scrollRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      if (!scrollRef.current) return;
      const scrollDOM = scrollRef.current;
      onReady?.({
        scrollDOM,
        state: {
          doc: {
            lines: 7,
            line: (line: number) => ({ from: (line - 1) * 10 }),
            lineAt: (position: number) => ({
              number: Math.floor(position / 10) + 1,
            }),
          },
        },
        documentPadding: { top: 0, bottom: 0 },
        lineBlockAt: (position: number) => ({
          top: (position / 10) * 25,
        }),
        lineBlockAtHeight: (height: number) => ({
          from: Math.floor(height / 25) * 10,
        }),
      } as never);
    }, [onReady]);

    return (
      <div ref={scrollRef} data-testid="mock-rule-editor-scroll">
        <textarea
          aria-label={ariaLabel}
          data-testid={testId}
          readOnly={!editable}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    );
  },
}));

function WorkspaceHarness({
  initialValue = "# First section\n\n\n\n## Second section\n\n",
  isRewriting = false,
}: {
  initialValue?: string;
  isRewriting?: boolean;
}) {
  const [value, setValue] = useState(initialValue);

  return (
    <RuleMarkdownWorkspace
      path="/Users/test/.codex/AGENTS.md"
      value={value}
      editable={!isRewriting}
      isRewriting={isRewriting}
      onChange={setValue}
    />
  );
}

describe("RuleMarkdownWorkspace", () => {
  it("switches between edit, preview and split modes without losing live draft updates", async () => {
    const user = userEvent.setup();

    await act(async () => {
      await renderWithI18n(<WorkspaceHarness />, { language: "en" });
    });

    const viewModes = screen.getByRole("group", { name: "Rule view" });
    const editButton = within(viewModes).getByRole("button", { name: "Edit" });
    const previewButton = within(viewModes).getByRole("button", {
      name: "Preview",
    });
    const splitButton = within(viewModes).getByRole("button", {
      name: "Split",
    });
    const editor = screen.getByRole("textbox", { name: "Rule Content" });
    const editorPane = screen.getByTestId("rule-markdown-editor-pane");

    expect(previewButton.querySelector(".lucide-book-open")).not.toBeNull();
    expect(screen.getByText(en.rules.draftEditMode).parentElement).not.toBe(
      viewModes.parentElement,
    );
    expect(screen.getByText("7 lines").parentElement?.parentElement).toBe(
      viewModes.parentElement,
    );
    expect(screen.getByText("7 lines").parentElement?.nextElementSibling).toBe(
      viewModes,
    );
    expect(editButton).toHaveAttribute("aria-pressed", "true");
    expect(editorPane).not.toHaveClass("hidden");
    expect(
      screen.queryByRole("region", { name: "Markdown preview" }),
    ).not.toBeInTheDocument();

    await user.click(previewButton);
    const preview = screen.getByRole("region", { name: "Markdown preview" });
    expect(previewButton).toHaveAttribute("aria-pressed", "true");
    expect(editorPane).toHaveClass("hidden");
    expect(
      within(preview).getByRole("heading", { name: "First section" }),
    ).toBeVisible();

    await user.click(splitButton);
    expect(splitButton).toHaveAttribute("aria-pressed", "true");
    expect(editorPane).not.toHaveClass("hidden");
    expect(preview).toBeVisible();

    const editorScroll = screen.getByTestId("mock-rule-editor-scroll");
    Object.defineProperties(editorScroll, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 175 },
    });
    Object.defineProperties(preview, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 400 },
    });
    const previewRect = { top: 0 } as DOMRect;
    vi.spyOn(preview, "getBoundingClientRect").mockReturnValue(previewRect);
    const firstHeading = within(preview).getByRole("heading", {
      name: "First section",
    });
    const secondHeading = within(preview).getByRole("heading", {
      name: "Second section",
    });
    vi.spyOn(firstHeading, "getBoundingClientRect").mockImplementation(
      () => ({ top: -preview.scrollTop }) as DOMRect,
    );
    vi.spyOn(secondHeading, "getBoundingClientRect").mockImplementation(
      () => ({ top: 300 - preview.scrollTop }) as DOMRect,
    );
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );

    editorScroll.scrollTop = 100;
    fireEvent.scroll(editorScroll);
    fireEvent.scroll(editorScroll);
    expect(preview.scrollTop).toBe(300);
    fireEvent.scroll(preview);
    expect(editorScroll.scrollTop).toBe(100);
    const scrollTo = vi.fn();
    Object.defineProperty(preview, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });
    await user.click(screen.getByRole("button", { name: "Back to top" }));
    expect(scrollTo).toHaveBeenCalledWith({
      behavior: "smooth",
      top: 0,
    });

    await new Promise((resolve) => requestAnimationFrame(resolve));
    preview.scrollTop = 150;
    fireEvent.scroll(preview);
    await waitFor(() => expect(editorScroll.scrollTop).toBe(50));

    await user.clear(editor);
    await user.type(editor, "# Updated preview");
    expect(
      within(preview).getByRole("heading", { name: "Updated preview" }),
    ).toBeVisible();

    fireEvent.click(editButton);
    expect(editButton).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.queryByRole("region", { name: "Markdown preview" }),
    ).not.toBeInTheDocument();
  });

  it("shows an empty preview and keeps the editor read-only while AI is rewriting", async () => {
    await act(async () => {
      await renderWithI18n(
        <WorkspaceHarness initialValue="  " isRewriting={true} />,
        { language: "en" },
      );
    });

    expect(screen.getByText("Generating draft...")).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: "Rule Content" }),
    ).toHaveAttribute("readonly");

    await userEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByText("Nothing to preview yet.")).toBeVisible();
  });

  it("returns a long preview to the top without animation when reduced motion is enabled", async () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });

    try {
      await act(async () => {
        await renderWithI18n(<WorkspaceHarness />, { language: "en" });
      });
      await userEvent.click(screen.getByRole("button", { name: "Preview" }));
      const preview = screen.getByRole("region", { name: "Markdown preview" });
      const scrollTo = vi.fn();
      Object.defineProperty(preview, "scrollTo", {
        configurable: true,
        value: scrollTo,
      });

      preview.scrollTop = 300;
      fireEvent.scroll(preview);
      await userEvent.click(
        screen.getByRole("button", { name: "Back to top" }),
      );

      expect(scrollTo).toHaveBeenCalledWith({ behavior: "auto", top: 0 });
    } finally {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: originalMatchMedia,
      });
    }
  });

  it("deduplicates nested rendered blocks that begin on the same source line", async () => {
    await act(async () => {
      await renderWithI18n(
        <WorkspaceHarness initialValue="> Quoted content" />,
        { language: "en" },
      );
    });

    await userEvent.click(screen.getByRole("button", { name: "Split" }));
    const preview = screen.getByRole("region", { name: "Markdown preview" });
    expect(preview.querySelectorAll('[data-source-line="1"]')).toHaveLength(2);
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });

  it("defines every Markdown view label in all seven locales", () => {
    const keys = [
      "viewModeLabel",
      "viewEdit",
      "viewPreview",
      "viewSplit",
      "previewCanvas",
      "previewEmpty",
      "backToTop",
    ] as const;
    const locales = { de, en, es, fr, ja, zh, zhTW };

    for (const [locale, messages] of Object.entries(locales)) {
      for (const key of keys) {
        expect(
          String(messages.rules[key]).trim(),
          `${locale}:rules.${key}`,
        ).not.toBe("");
      }
    }
  });
});
