import { fireEvent, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import {
  BoundedListPager,
  useBoundedPage,
} from "../../../src/renderer/components/agent/BoundedListPager";
import { renderWithI18n } from "../../helpers/i18n";

function PagerHarness({
  initialItems,
  pageSize = 2,
}: {
  initialItems: string[];
  pageSize?: number;
}) {
  const [items, setItems] = useState(initialItems);
  const [resetToken, setResetToken] = useState<object>({});
  const page = useBoundedPage(items, pageSize, resetToken);
  return (
    <div>
      <div data-testid="page-items">{page.items.join("|")}</div>
      <div data-testid="page-index">{page.pageIndex}</div>
      <BoundedListPager page={page} />
      <button
        type="button"
        onClick={() => {
          setItems(["replacement-a", "replacement-b", "replacement-c"]);
          setResetToken({});
        }}
      >
        Replace source
      </button>
      <button type="button" onClick={() => setItems(["only-one"])}>
        Shrink same source
      </button>
    </div>
  );
}

describe("BoundedListPager", () => {
  it("renders nothing when all rows fit on one page", async () => {
    await renderWithI18n(<PagerHarness initialItems={[]} pageSize={0} />);

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.getByTestId("page-items")).toHaveTextContent("");
    expect(screen.getByTestId("page-index")).toHaveTextContent("0");
  });

  it("moves between bounded pages and disables both boundaries", async () => {
    await renderWithI18n(
      <PagerHarness initialItems={["a", "b", "c", "d", "e"]} />,
    );

    expect(screen.getByTestId("page-items")).toHaveTextContent("a|b");
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("1-2 / 5");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByTestId("page-items")).toHaveTextContent("e");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("5-5 / 5");

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByTestId("page-items")).toHaveTextContent("c|d");
  });

  it("resets a replaced source and clamps a shrinking source", async () => {
    await renderWithI18n(
      <PagerHarness initialItems={["a", "b", "c", "d", "e"]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByTestId("page-index")).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "Replace source" }));
    expect(screen.getByTestId("page-index")).toHaveTextContent("0");
    expect(screen.getByTestId("page-items")).toHaveTextContent(
      "replacement-a|replacement-b",
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Shrink same source" }));
    expect(screen.getByTestId("page-index")).toHaveTextContent("0");
    expect(screen.getByTestId("page-items")).toHaveTextContent("only-one");
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
