// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UNASSIGNED_BOARD_COLUMN_ID } from "../../shared/board-statuses";
import type { BoardColumnConfig, Bug } from "../../shared/types";
import { BoardColumnsEditor } from "./BoardColumnsEditor";
import { BugBoard } from "./BugBoard";

function bug(id: number, overrides: Partial<Bug> = {}): Bug {
  return {
    id,
    summary: `Bug ${id}`,
    status: "NEW",
    resolution: "",
    product: "Test",
    component: "Core",
    priority: "P2",
    severity: "normal",
    assignedTo: "dev@example.com",
    creator: "reporter@example.com",
    creationTime: "2026-01-01T00:00:00Z",
    lastChangeTime: "2026-01-02T00:00:00Z",
    description: "",
    keywords: [],
    platform: "All",
    version: "unspecified",
    ...overrides,
  };
}

describe("board column mapping editor", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render(node: ReactNode) {
    await act(async () => {
      root.render(node);
    });
  }

  function text(selector: string): string {
    return container.querySelector(selector)?.textContent ?? "";
  }

  function click(selector: string) {
    const element = container.querySelector(selector);
    if (!(element instanceof HTMLElement)) throw new Error(`Missing ${selector}`);
    act(() => {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  }

  function setControl(selector: string, value: string) {
    const element = container.querySelector(selector);
    if (
      !(element instanceof HTMLInputElement) &&
      !(element instanceof HTMLSelectElement)
    ) {
      throw new Error(`Missing control ${selector}`);
    }
    act(() => {
      const prototype =
        element instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
      setter?.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  it("starts every group-by value in New until it is mapped", async () => {
    await render(
      <BoardColumnsEditor
        product="Test"
        boardGroupBy="priority"
        boardColumns={[]}
        boardStatuses={["NEW"]}
        showClosedBugs={false}
        onChange={() => undefined}
      />,
    );

    const inbox = container.querySelector(
      `[data-column-id="${UNASSIGNED_BOARD_COLUMN_ID}"]`,
    );
    expect(inbox?.textContent).toContain("New");
    expect(inbox?.textContent).toContain("Unmapped values");
    for (const value of ["P1", "P2", "P3", "P4", "P5"]) {
      expect(inbox?.querySelector(`[data-value="${value}"]`)).not.toBeNull();
    }
    expect(container.querySelectorAll(".board-mapper-column")).toHaveLength(1);
  });

  it("adds a named column", async () => {
    const onChange = vi.fn();
    await render(
      <BoardColumnsEditor
        product="Test"
        boardGroupBy="status"
        boardColumns={[]}
        boardStatuses={undefined}
        showClosedBugs={false}
        onChange={onChange}
      />,
    );

    click(".board-mapper-add-button");
    setControl("[aria-label='New column name']", "Doing");
    click(".board-mapper-add-actions .secondary-button");

    expect(onChange).toHaveBeenCalledTimes(1);
    const update = onChange.mock.calls[0]?.[0] as {
      boardGroupBy: string;
      boardColumns: BoardColumnConfig[];
    };
    expect(update.boardGroupBy).toBe("status");
    expect(update.boardColumns).toHaveLength(1);
    expect(update.boardColumns[0]?.name).toBe("Doing");
    expect(update.boardColumns[0]?.values).toEqual([]);
  });

  it("drags a value from New into a named column", async () => {
    const onChange = vi.fn();
    await render(
      <BoardColumnsEditor
        product="Test"
        boardGroupBy="status"
        boardColumns={[{ id: "doing", name: "Doing", values: [] }]}
        boardStatuses={undefined}
        showClosedBugs={false}
        onChange={onChange}
      />,
    );

    const chip = container.querySelector("[data-value='UNCONFIRMED']");
    const column = container.querySelector("[data-column-id='doing']");
    if (!(chip instanceof HTMLElement) || !(column instanceof HTMLElement)) {
      throw new Error("Missing drag target");
    }

    await act(async () => {
      chip.dispatchEvent(new DragEvent("dragstart", { bubbles: true }));
    });
    await act(async () => {
      column.dispatchEvent(new DragEvent("dragover", { bubbles: true }));
      column.dispatchEvent(new DragEvent("drop", { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    const update = onChange.mock.calls[0]?.[0] as {
      boardColumns: BoardColumnConfig[];
    };
    expect(update.boardColumns).toEqual([
      { id: "doing", name: "Doing", values: ["UNCONFIRMED"] },
    ]);
  });

  it("keeps column names and clears values when the group-by field changes", async () => {
    const onChange = vi.fn();
    await render(
      <BoardColumnsEditor
        product="Test"
        boardGroupBy="status"
        boardColumns={[
          { id: "doing", name: "Doing", values: ["NEW", "ASSIGNED"] },
          { id: "done", name: "Done", values: ["RESOLVED"] },
        ]}
        boardStatuses={["NEW"]}
        showClosedBugs={false}
        onChange={onChange}
      />,
    );

    setControl("[aria-label='Group board by']", "priority");

    expect(onChange).toHaveBeenCalledWith({
      boardGroupBy: "priority",
      boardColumns: [
        { id: "doing", name: "Doing", values: [] },
        { id: "done", name: "Done", values: [] },
      ],
    });
  });

  it("moves and deletes named columns", async () => {
    const onChange = vi.fn();
    const columns: BoardColumnConfig[] = [
      { id: "doing", name: "Doing", values: ["NEW"] },
      { id: "done", name: "Done", values: ["RESOLVED"] },
    ];
    await render(
      <BoardColumnsEditor
        product="Test"
        boardGroupBy="status"
        boardColumns={columns}
        boardStatuses={undefined}
        showClosedBugs={false}
        onChange={onChange}
      />,
    );

    click("[aria-label='Move Done left']");
    expect(onChange).toHaveBeenLastCalledWith({
      boardGroupBy: "status",
      boardColumns: [columns[1], columns[0]],
    });

    click("[aria-label='Delete Doing']");
    expect(onChange).toHaveBeenLastCalledWith({
      boardGroupBy: "status",
      boardColumns: [columns[1]],
    });
  });

  it("shows named columns on the board and parks unmapped bugs in New", async () => {
    await render(
      <BugBoard
        bugs={[
          bug(1, { priority: "P1", summary: "First" }),
          bug(2, { priority: "P2", summary: "Second" }),
          bug(3, { priority: "P5", summary: "Fifth" }),
        ]}
        boardGroupBy="priority"
        boardColumns={[
          { id: "soon", name: "Soon", values: ["P1", "P2"] },
          { id: "later", name: "Later", values: [] },
        ]}
        showClosedBugs={false}
        onSelect={() => undefined}
      />,
    );

    const titles = [...container.querySelectorAll(".board-column-title")].map(
      (element) => element.textContent,
    );
    expect(titles).toEqual(["New", "Soon", "Later"]);
    expect(text("[data-column-id='soon']")).toContain("First");
    expect(text("[data-column-id='soon']")).toContain("Second");
    expect(text("[data-column-id='soon']")).toContain("P1");
    expect(text("[data-column-id='soon']")).toContain("P2");
    expect(text("[data-column-id='later']")).not.toContain("Fifth");
    expect(text(`[data-column-id='${UNASSIGNED_BOARD_COLUMN_ID}']`)).toContain(
      "Fifth",
    );
    expect(text(`[data-column-id='${UNASSIGNED_BOARD_COLUMN_ID}']`)).toContain(
      "P5",
    );
  });

  it("keeps a saved status board as one column per status", async () => {
    await render(
      <BugBoard
        bugs={[bug(7, { status: "ASSIGNED", summary: "Owned" })]}
        boardStatuses={["NEW", "ASSIGNED"]}
        showClosedBugs={false}
        onSelect={() => undefined}
      />,
    );

    expect(text("[data-column-id='legacy:ASSIGNED']")).toContain("Owned");
    expect(container.querySelector("[data-column-id='legacy:CLOSED']")).toBeNull();
    expect(
      container.querySelector(`[data-column-id='${UNASSIGNED_BOARD_COLUMN_ID}']`),
    ).toBeNull();
  });
});
