import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SkillFileTree } from "../../../src/renderer/components/skill/SkillFileTree";
import { getSkillFileIconUrl } from "../../../src/renderer/components/skill/skill-file-icons";

vi.mock("../../../src/renderer/components/skill/skill-file-icons", () => ({
  getSkillFileIconUrl: vi.fn(() => "file-icon.svg"),
}));

const tree = [
  {
    name: "docs",
    path: "docs",
    isDirectory: true,
    depth: 0,
    children: [
      {
        name: "guide.md",
        path: "docs/guide.md",
        isDirectory: false,
        depth: 1,
        children: [],
      },
    ],
  },
];

const baseProps = {
  canMutateStructure: true,
  expandedDirs: new Set(["docs"]),
  isLoading: false,
  modifiedFilePaths: new Set<string>(),
  noFilesLabel: "No files",
  onContextMenuChange: vi.fn(),
  onCreateFile: vi.fn(),
  onCreateFolder: vi.fn(),
  onDeleteFile: vi.fn(),
  onOpenInExplorer: vi.fn(),
  onRequestSelectFile: vi.fn(),
  onToggleDir: vi.fn(),
  selectedFile: "docs/guide.md",
  t: ((key: string, fallback: string) => fallback || key) as never,
  tree,
};

describe("SkillFileTree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves tree interactions after extraction", () => {
    render(<SkillFileTree {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /docs/u }));
    fireEvent.click(screen.getByRole("button", { name: /guide\.md/u }));
    fireEvent.click(screen.getByRole("button", { name: "Delete File" }));

    expect(baseProps.onToggleDir).toHaveBeenCalledWith("docs");
    expect(baseProps.onRequestSelectFile).toHaveBeenCalledWith("docs/guide.md");
    expect(baseProps.onDeleteFile).toHaveBeenCalledWith("docs/guide.md");
  });

  it("skips recursive tree work when stable props are rerendered", () => {
    const view = render(<SkillFileTree {...baseProps} />);
    const iconCalls = vi.mocked(getSkillFileIconUrl).mock.calls.length;

    view.rerender(<SkillFileTree {...baseProps} />);

    expect(getSkillFileIconUrl).toHaveBeenCalledTimes(iconCalls);
  });
});
