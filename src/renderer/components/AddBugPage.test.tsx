// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BugCreate, BugDetail, DetailFieldOption, Project } from "../../shared/types";
import { AddBugPage } from "./AddBugPage";
import { BugsPage } from "./BugsPage";

const catalog: DetailFieldOption[] = [
  {
    key: "status",
    label: "Status",
    type: "select",
    values: ["NEW", "ASSIGNED", "RESOLVED"],
    required: true,
  },
  {
    key: "component",
    label: "Component",
    type: "select",
    values: ["UI", "Networking"],
    required: true,
  },
  {
    key: "version",
    label: "Version",
    type: "select",
    values: ["1.0", "unspecified"],
    required: true,
  },
  {
    key: "priority",
    label: "Priority",
    type: "select",
    values: ["P1", "P2"],
    required: true,
  },
  {
    key: "cf_blocking",
    label: "Blocking",
    type: "select",
    values: ["yes", "no"],
    required: true,
  },
  {
    key: "severity",
    label: "Severity",
    type: "select",
    values: ["normal", "minor"],
  },
];

const project: Project = {
  id: "browser",
  name: "Browser",
  product: "Browser",
  detailFields: ["component", "version", "priority", "cf_blocking", "severity"],
};

function createdBug(): BugDetail {
  return {
    id: 77,
    summary: "Toolbar clips",
    status: "NEW",
    resolution: "",
    product: "Browser",
    component: "UI",
    priority: "P2",
    severity: "",
    assignedTo: "",
    creator: "me@example.com",
    creationTime: "2026-10-29T12:00:00Z",
    lastChangeTime: "2026-10-29T12:00:00Z",
    description: "The toolbar is cut off.",
    keywords: [],
    platform: "",
    version: "1.0",
    comments: [],
    attachments: [],
    history: [],
    blocks: [],
    dependsOn: [],
    cc: [],
  };
}

describe("add bug screen", () => {
  let container: HTMLDivElement;
  let root: Root;
  const createBug = vi.fn<(product: string, draft: BugCreate) => Promise<BugDetail>>();

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    createBug.mockReset();
    createBug.mockResolvedValue(createdBug());
    window.bugzilli = {
      getCurrentUser: vi.fn(async () => ({
        id: 1,
        name: "me@example.com",
        realName: "Me",
      })),
      getProductDetailFields: vi.fn(async () => catalog),
      createBug,
    } as unknown as Window["bugzilli"];
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
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  function click(selector: string) {
    const element = container.querySelector(selector);
    if (!element) throw new Error(`Missing ${selector}`);
    act(() => {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  }

  function setControl(selector: string, value: string) {
    const element = container.querySelector(selector);
    if (
      !(element instanceof HTMLInputElement) &&
      !(element instanceof HTMLSelectElement) &&
      !(element instanceof HTMLTextAreaElement)
    ) {
      throw new Error(`Missing control ${selector}`);
    }
    act(() => {
      const prototype =
        element instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : element instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
      setter?.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  it("puts New bug at the top right of the list and board headers", async () => {
    const onAddBug = vi.fn();
    await render(
      <BugsPage
        project={project}
        mode="list"
        bugs={[]}
        query=""
        selectedFilterId="all"
        loading={false}
        error=""
        onQueryChange={() => {}}
        onSearch={() => {}}
        onRefresh={() => {}}
        onSelectFilter={() => {}}
        onAddFilter={() => {}}
        onUpdateFilter={() => {}}
        onDeleteFilter={() => {}}
        onSelectBug={() => {}}
        onAddBug={onAddBug}
      />,
    );

    const header = container.querySelector("header.page-header");
    const buttons = [...(header?.querySelectorAll("button") ?? [])];
    expect(buttons.at(-1)?.textContent).toContain("New bug");
    expect(header?.querySelector(".page-header-actions .primary-button")?.textContent).toContain(
      "New bug",
    );

    click("header .primary-button");
    expect(onAddBug).toHaveBeenCalledOnce();

    await render(
      <BugsPage
        project={project}
        mode="board"
        bugs={[]}
        query=""
        selectedFilterId="all"
        loading={false}
        error=""
        onQueryChange={() => {}}
        onSearch={() => {}}
        onRefresh={() => {}}
        onSelectFilter={() => {}}
        onAddFilter={() => {}}
        onUpdateFilter={() => {}}
        onDeleteFilter={() => {}}
        onSelectBug={() => {}}
        onAddBug={() => {}}
      />,
    );
    expect(container.querySelector("header .primary-button")?.textContent).toContain("New bug");
  });

  it("lays out the configured detail fields and posts a valid bug", async () => {
    const onCreated = vi.fn();
    await render(
      <AddBugPage
        product="Browser"
        detailFields={project.detailFields}
        onBack={() => {}}
        onCreated={onCreated}
      />,
    );

    expect(container.querySelector(".detail-layout")).toBeTruthy();
    expect(container.querySelector(".detail-sidebar h2")?.textContent).toBe("Details");
    expect(container.querySelector(".description-section h2")?.textContent).toContain(
      "Description",
    );
    expect(container.querySelector(".detail-actions .primary-button")?.textContent).toBe("Save");
    expect(container.querySelector("#bug-summary")?.getAttribute("aria-required")).toBe("true");
    expect(container.querySelector("#bug-component .required-mark, label[for='bug-component'] .required-mark")).toBeTruthy();
    expect(container.querySelector("label[for='bug-version'] .required-mark")).toBeTruthy();
    expect(container.querySelector("label[for='bug-priority'] .required-mark")).toBeTruthy();
    expect(container.querySelector("label[for='bug-field-cf_blocking'] .required-mark")).toBeTruthy();
    expect(container.querySelector("label[for='bug-severity'] .required-mark")).toBeNull();

    click(".detail-actions .primary-button");

    expect(createBug).not.toHaveBeenCalled();
    expect(container.querySelector(".error-banner")?.textContent).toContain(
      "Some fields need attention.",
    );
    expect(container.querySelector("#bug-summary")?.getAttribute("aria-invalid")).toBe("true");
    expect(container.querySelector("#bug-summary")?.closest(".summary-edit")?.querySelector(".field-error-icon")).toBeTruthy();
    expect(container.querySelector("#bug-component")?.className).toContain("detail-control-invalid");
    expect(container.querySelector("#bug-version")?.className).toContain("detail-control-invalid");
    expect(container.querySelector("#bug-priority")?.className).toContain("detail-control-invalid");
    expect(container.querySelector("#bug-field-cf_blocking")?.className).toContain(
      "detail-control-invalid",
    );
    expect(container.querySelector("#bug-severity")?.className).not.toContain(
      "detail-control-invalid",
    );
    expect(container.textContent).toContain("Summary is required.");
    expect(container.textContent).toContain("Blocking is required.");

    setControl("#bug-summary", "Toolbar clips");
    setControl("#bug-description", "The toolbar is cut off.");
    setControl("#bug-status", "NEW");
    setControl("#bug-component", "UI");
    setControl("#bug-version", "1.0");
    setControl("#bug-priority", "P2");
    setControl("#bug-field-cf_blocking", "yes");

    expect(container.querySelector("#bug-summary")?.getAttribute("aria-invalid")).toBeNull();
    expect(container.querySelector("#bug-component")?.className).not.toContain(
      "detail-control-invalid",
    );

    await act(async () => {
      container
        .querySelector(".detail-actions .primary-button")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(createBug).toHaveBeenCalledOnce();
    expect(createBug.mock.calls[0]?.[0]).toBe("Browser");
    expect(createBug.mock.calls[0]?.[1]).toMatchObject({
      summary: "Toolbar clips",
      description: "The toolbar is cut off.",
      status: "NEW",
      component: "UI",
      version: "1.0",
      priority: "P2",
      extraFields: { cf_blocking: "yes" },
    });
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 77 }));
  });

  it("marks the field Bugzilla names when create fails", async () => {
    createBug.mockRejectedValueOnce(new Error("Severity must be one of the legal values."));
    await render(
      <AddBugPage
        product="Browser"
        detailFields={project.detailFields}
        onBack={() => {}}
        onCreated={() => {}}
      />,
    );

    setControl("#bug-summary", "Toolbar clips");
    setControl("#bug-status", "NEW");
    setControl("#bug-component", "UI");
    setControl("#bug-version", "1.0");
    setControl("#bug-priority", "P2");
    setControl("#bug-field-cf_blocking", "yes");

    await act(async () => {
      container
        .querySelector(".detail-actions .primary-button")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector(".error-banner")?.textContent).toContain(
      "Severity must be one of the legal values.",
    );
    expect(container.querySelector("#bug-severity")?.className).toContain("detail-control-invalid");
    expect(
      container.querySelector("label[for='bug-severity'] .field-error-icon"),
    ).toBeTruthy();
    expect(container.querySelector("#bug-component")?.className).not.toContain(
      "detail-control-invalid",
    );
  });
});
