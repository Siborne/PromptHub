import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { EditorView } from "@codemirror/view";
import { describe, expect, it, vi } from "vitest";

import {
  SkillCodeEditor,
  getSkillCodeEditorLanguageName,
  loadSkillCodeEditorLanguage,
} from "../../../src/renderer/components/skill/SkillCodeEditor";

describe("SkillCodeEditor", () => {
  it("detects common editor languages from file paths", () => {
    expect(getSkillCodeEditorLanguageName("scripts/main.ts")).toBe(
      "typescript",
    );
    expect(getSkillCodeEditorLanguageName("scripts/tool.py")).toBe("python");
    expect(getSkillCodeEditorLanguageName("config/openai.yaml")).toBe("yaml");
    expect(getSkillCodeEditorLanguageName("README.md")).toBe("markdown");
    expect(getSkillCodeEditorLanguageName("unknown.asset")).toBe("plaintext");
  });

  it("loads syntax language extensions asynchronously", async () => {
    const typescriptLanguage =
      await loadSkillCodeEditorLanguage("scripts/main.ts");
    expect(typescriptLanguage).toBeTruthy();
    await expect(loadSkillCodeEditorLanguage("unknown.asset")).resolves.toEqual(
      [],
    );
  });

  it("renders a CodeMirror editor surface for code content", async () => {
    const { container } = render(
      <SkillCodeEditor
        path="scripts/main.ts"
        value="export const value: string = 'ok';"
        editable={false}
        onChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector(".cm-editor")).not.toBeNull();
    });

    expect(screen.getByTestId("skill-code-editor")).toHaveAttribute(
      "data-language",
      "typescript",
    );
    expect(container.querySelector(".cm-content")).toHaveTextContent(
      "export const value",
    );
    expect(container.querySelector(".cm-scroller")).not.toBeNull();
    expect(container.querySelector(".cm-content")).toHaveClass(
      "cm-lineWrapping",
    );
  });

  it("does not report parent-driven value updates as user edits", async () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <SkillCodeEditor
        path="scripts/main.py"
        value=""
        editable={true}
        onChange={onChange}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector(".cm-editor")).not.toBeNull();
    });

    rerender(
      <SkillCodeEditor
        path="scripts/main.py"
        value={"def run():\n    return 'ok'\n"}
        editable={true}
        onChange={onChange}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector(".cm-content")).toHaveTextContent(
        "def run",
      );
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("continues Markdown list markers and exposes the owning surface label", async () => {
    Object.defineProperty(Range.prototype, "getClientRects", {
      configurable: true,
      value: () => [],
    });
    const onChange = vi.fn();
    let editorView: EditorView | null = null;
    const { container } = render(
      <SkillCodeEditor
        path="CLAUDE.md"
        value="- first item"
        editable={true}
        ariaLabel="Rule Content"
        testId="rule-markdown-editor"
        onReady={(view) => {
          editorView = view;
        }}
        onChange={onChange}
      />,
    );

    await waitFor(() => {
      expect(editorView).not.toBeNull();
      expect(container.querySelector(".cm-editor")).not.toBeNull();
    });

    expect(screen.getByTestId("rule-markdown-editor")).toHaveAttribute(
      "data-language",
      "markdown",
    );
    expect(
      screen.getByRole("textbox", { name: "Rule Content" }),
    ).toBeInTheDocument();

    act(() => {
      editorView?.dispatch({
        selection: { anchor: editorView.state.doc.length },
      });
    });
    fireEvent.keyDown(editorView!.contentDOM, {
      key: "Enter",
      code: "Enter",
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith("- first item\n- ");
    });
  });

  it("centers Markdown fold controls within their gutter row", async () => {
    const { container } = render(
      <SkillCodeEditor
        path="AGENTS.md"
        value={"# Rules\n\n## Section\n\nContent"}
        editable={true}
        onChange={vi.fn()}
      />,
    );

    const foldControl = await waitFor(() => {
      const element = container.querySelector<HTMLElement>(
        ".cm-foldGutter span",
      );
      expect(element).not.toBeNull();
      return element!;
    });

    expect(getComputedStyle(foldControl).display).toBe("inline-flex");
    expect(getComputedStyle(foldControl).alignItems).toBe("center");
    expect(getComputedStyle(foldControl).justifyContent).toBe("center");
    expect(getComputedStyle(foldControl).transform).toBe("translateY(-1px)");
  });
});
