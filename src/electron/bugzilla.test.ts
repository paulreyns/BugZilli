import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./settings.js", () => ({
  getConnection: vi.fn().mockResolvedValue({
    baseUrl: "https://bugs.example.com",
    apiKey: "secret",
    userEmail: "me@example.com",
    projects: [
      { id: "browser", name: "Browser", product: "Browser" },
      {
        id: "all-browser",
        name: "All Browser bugs",
        product: "Browser",
        showClosedBugs: true,
      },
      {
        id: "custom-list",
        name: "Custom list",
        product: "Browser",
        listColumns: ["id", "summary", "whiteboard", "severity"],
      },
      {
        id: "custom-linked",
        name: "Custom linked",
        product: "Browser",
        linkedColumns: ["id", "summary", "status", "whiteboard", "priority"],
      },
    ],
  }),
}));

import { setBugCacheDirectory } from "./bug-cache.js";
import { getConnection } from "./settings.js";
import type { LinkedBug } from "../shared/types.js";
import {
  addAttachment,
  addComment,
  getAttachmentFile,
  getBug,
  getCurrentUser,
  createBug,
  getProductDetailFields,
  searchBugs,
  searchLinkableBugs,
  updateBug,
} from "./bugzilla.js";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function response(value: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 400,
    json: vi.fn().mockResolvedValue(value),
  } as unknown as Response;
}

function emptyHistory(id = 42): Response {
  return response({ bugs: [{ id, history: [] }] });
}

function linkedBug(
  partial: Pick<LinkedBug, "id" | "summary" | "assignedTo"> &
    Partial<LinkedBug>,
): LinkedBug {
  const { id, summary, assignedTo, ...rest } = partial;
  return {
    id,
    summary,
    status: "",
    resolution: "",
    product: "",
    component: "",
    priority: "",
    severity: "",
    assignedTo,
    creator: "",
    creationTime: "",
    lastChangeTime: "",
    keywords: [],
    platform: "",
    version: "",
    ...rest,
  };
}

const getConnectionMock = vi.mocked(getConnection);

function mockFullBug(options?: {
  id?: number;
  summary?: string;
  lastChangeTime?: string;
  comment?: string;
}): void {
  const id = options?.id ?? 42;
  const summary = options?.summary ?? "Toolbar is clipped";
  const lastChangeTime = options?.lastChangeTime ?? "2026-10-18T10:00:00Z";
  fetchMock
    .mockResolvedValueOnce(
      response({
        bugs: [
          {
            id,
            summary,
            status: "NEW",
            last_change_time: lastChangeTime,
          },
        ],
      }),
    )
    .mockResolvedValueOnce(
      response({
        bugs: {
          [String(id)]: {
            comments: [
              {
                id: 1,
                creator: "reporter",
                creation_time: "2024-01-01T09:00:00Z",
                text: "Steps",
              },
              ...(options?.comment
                ? [
                    {
                      id: 2,
                      creator: "dev",
                      creation_time: "2024-01-02T09:00:00Z",
                      text: options.comment,
                    },
                  ]
                : []),
            ],
          },
        },
      }),
    )
    .mockResolvedValueOnce(response({ bugs: { [String(id)]: [] } }))
    .mockResolvedValueOnce(emptyHistory(id));
  if (options?.comment) {
    fetchMock.mockResolvedValueOnce(
      response({ users: [{ name: "dev", real_name: "Dev Name" }] }),
    );
  }
}

describe("Bugzilla API client", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    setBugCacheDirectory(undefined);
  });

  it("searches within the configured product and maps Bugzilla fields", async () => {
    fetchMock.mockResolvedValue(
      response({
        bugs: [
          {
            id: 42,
            summary: "Toolbar is clipped",
            status: "NEW",
            product: "Browser",
            component: "UI",
            assigned_to: "dev@example.com",
            assigned_to_detail: { real_name: "Dev Name" },
            last_change_time: "2026-10-18T10:00:00Z",
          },
        ],
      }),
    );

    const bugs = await searchBugs({ projectId: "browser", query: "toolbar" });

    expect(bugs[0]).toMatchObject({
      id: 42,
      summary: "Toolbar is clipped",
      assignedTo: "dev@example.com",
      assignedToName: "Dev Name",
    });
    const [url, options] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.searchParams.get("product")).toBe("Browser");
    expect(url.searchParams.get("quicksearch")).toBe("toolbar");
    expect(url.searchParams.get("resolution")).toBe("---");
    expect(url.searchParams.get("include_fields")).toContain(
      "assigned_to_detail",
    );
    expect(options.headers).toMatchObject({
      "X-BUGZILLA-API-KEY": "secret",
    });
  });

  it("includes resolved bugs when enabled for the project", async () => {
    fetchMock.mockResolvedValue(response({ bugs: [] }));

    await searchBugs({ projectId: "all-browser" });

    const [url] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.searchParams.has("resolution")).toBe(false);
  });

  it("keeps the project closed-bug setting authoritative over resolution filters", async () => {
    expect(
      await searchBugs({
        projectId: "browser",
        filters: [{ field: "resolution", value: "FIXED" }],
      }),
    ).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValue(response({ bugs: [] }));
    await searchBugs({
      projectId: "browser",
      filters: [{ field: "resolution", value: "---" }],
    });

    const [url] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.searchParams.getAll("resolution")).toEqual(["---"]);
  });

  it("applies resolution filters when the project includes closed bugs", async () => {
    fetchMock.mockResolvedValue(response({ bugs: [] }));

    await searchBugs({
      projectId: "all-browser",
      filters: [{ field: "resolution", value: "FIXED" }],
    });

    const [url] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.searchParams.get("f1")).toBe("resolution");
    expect(url.searchParams.get("o1")).toBe("equals");
    expect(url.searchParams.get("v1")).toBe("FIXED");
  });

  it("passes selected field filters through Bugzilla advanced search params", async () => {
    fetchMock.mockResolvedValue(response({ bugs: [] }));

    await searchBugs({
      projectId: "browser",
      filters: [
        { field: "status", value: "NEW" },
        {
          field: "assignedTo",
          operator: "notequals",
          value: "dev@example.com",
        },
        { field: "summary", operator: "anywords", value: "crash hang" },
      ],
    });

    const [url] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.searchParams.get("f1")).toBe("bug_status");
    expect(url.searchParams.get("o1")).toBe("equals");
    expect(url.searchParams.get("v1")).toBe("NEW");
    expect(url.searchParams.get("f2")).toBe("assigned_to");
    expect(url.searchParams.get("o2")).toBe("notequals");
    expect(url.searchParams.get("v2")).toBe("dev@example.com");
    expect(url.searchParams.get("f3")).toBe("short_desc");
    expect(url.searchParams.get("o3")).toBe("anywords");
    expect(url.searchParams.get("v3")).toBe("crash hang");
    expect(url.searchParams.get("status")).toBeNull();
    expect(url.searchParams.get("assigned_to")).toBeNull();
  });

  it("requests configured list column fields when searching", async () => {
    fetchMock.mockResolvedValue(
      response({
        bugs: [
          {
            id: 7,
            summary: "Custom columns",
            severity: "major",
            whiteboard: "[triaged]",
          },
        ],
      }),
    );

    const bugs = await searchBugs({ projectId: "custom-list" });
    expect(bugs[0]?.extraFields).toMatchObject({ whiteboard: "[triaged]" });

    const [url] = fetchMock.mock.calls[0] as [URL, RequestInit];
    const includeFields = url.searchParams.get("include_fields") ?? "";
    expect(includeFields).toContain("whiteboard");
    expect(includeFields).toContain("severity");
    expect(includeFields).toContain("assigned_to_detail");
  });

  it("uses the first comment as the description and keeps later comments", async () => {
    fetchMock
      .mockResolvedValueOnce(
        response({
          bugs: [
            {
              id: 42,
              summary: "Toolbar is clipped",
              status: "NEW",
              assigned_to: "dev@example.com",
              assigned_to_detail: { real_name: "Dev Name" },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        response({
          bugs: {
            "42": {
              comments: [
                {
                  id: 1,
                  creator: "reporter",
                  creation_time: "2024-01-01T09:00:00Z",
                  text: "Steps to reproduce",
                },
                {
                  id: 2,
                  creator: "developer",
                  creation_time: "2024-01-02T09:00:00Z",
                  text: "Confirmed",
                },
                {
                  id: 3,
                  creator: "qa@example.com",
                  creation_time: "2024-01-03T09:00:00Z",
                  text: "Follow-up",
                },
              ],
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        response({
          bugs: {
            "42": [
              {
                id: 7,
                file_name: "screenshot.png",
                content_type: "image/png",
                size: 2048,
                creator: "qa@example.com",
                creation_time: "2024-01-04T09:00:00Z",
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(emptyHistory())
      .mockResolvedValueOnce(
        response({
          users: [
            { name: "developer", real_name: "Dev Name" },
            {
              name: "qa",
              email: "qa@example.com",
              real_name: "QA Name",
            },
          ],
        }),
      );

    const bug = await getBug(42);

    expect(bug.assignedTo).toBe("dev@example.com");
    expect(bug.assignedToName).toBe("Dev Name");
    expect(bug.description).toBe("Steps to reproduce");
    expect(bug.comments.map((comment) => comment.text)).toEqual([
      "Follow-up",
      "Confirmed",
    ]);
    expect(bug.comments[1]).toMatchObject({
      creator: "developer",
      creatorName: "Dev Name",
    });
    expect(bug.comments[0]?.creatorName).toBe("QA Name");
    expect(bug.attachments[0]).toMatchObject({
      fileName: "screenshot.png",
      creator: "qa@example.com",
      creatorName: "QA Name",
      creationTime: "2024-01-04T09:00:00Z",
    });
    expect(bug.history).toEqual([]);
    expect(bug.cc).toEqual([]);
    const [bugUrl] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(bugUrl.pathname).toContain("/rest/bug/42");
    expect(bugUrl.searchParams.has("include_fields")).toBe(false);
    for (const [url] of fetchMock.mock.calls as [URL, RequestInit][]) {
      expect(url.searchParams.get("api_key")).toBe("secret");
    }
  });

  it("maps CC followers from cc_detail", async () => {
    fetchMock
      .mockResolvedValueOnce(
        response({
          bugs: [
            {
              id: 42,
              summary: "Toolbar is clipped",
              cc: ["dev@example.com", "qa@example.com"],
              cc_detail: [
                {
                  id: 7,
                  name: "dev@example.com",
                  real_name: "Dev Name",
                  email: "dev@example.com",
                },
                {
                  id: 8,
                  name: "qa",
                  real_name: "QA Name",
                  email: "qa@example.com",
                },
              ],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(response({ bugs: { "42": { comments: [] } } }))
      .mockResolvedValueOnce(response({ bugs: { "42": [] } }))
      .mockResolvedValueOnce(emptyHistory());

    const bug = await getBug(42);

    expect(bug.cc).toEqual([
      { id: 7, name: "dev@example.com", realName: "Dev Name" },
      {
        id: 8,
        name: "qa",
        realName: "QA Name",
        email: "qa@example.com",
      },
    ]);
  });

  it("uses the configured User Email Address for the current user", async () => {
    await expect(getCurrentUser()).resolves.toEqual({
      id: 0,
      name: "me@example.com",
      email: "me@example.com",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps bug history from /rest/bug/:id/history", async () => {
    fetchMock
      .mockResolvedValueOnce(
        response({ bugs: [{ id: 42, summary: "Toolbar is clipped", status: "ASSIGNED" }] }),
      )
      .mockResolvedValueOnce(response({ bugs: { "42": { comments: [] } } }))
      .mockResolvedValueOnce(response({ bugs: { "42": [] } }))
      .mockResolvedValueOnce(
        response({
          bugs: [
            {
              id: 42,
              history: [
                {
                  when: "2024-01-01T10:00:00Z",
                  who: "reporter@example.com",
                  changes: [
                    {
                      field_name: "status",
                      removed: "NEW",
                      added: "ASSIGNED",
                    },
                  ],
                },
                {
                  when: "2024-01-02T12:00:00Z",
                  who: "qa@example.com",
                  changes: [
                    {
                      field_name: "priority",
                      removed: "P3",
                      added: "P1",
                    },
                    {
                      field_name: "isobsolete",
                      removed: "0",
                      added: "1",
                      attachment_id: 7,
                    },
                  ],
                },
              ],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        response({
          users: [
            {
              name: "qa",
              email: "qa@example.com",
              real_name: "QA Name",
            },
          ],
        }),
      );

    const bug = await getBug(42);

    expect(bug.history).toEqual([
      {
        when: "2024-01-02T12:00:00Z",
        who: "qa@example.com",
        whoName: "QA Name",
        changes: [
          { fieldName: "priority", removed: "P3", added: "P1" },
          {
            fieldName: "isobsolete",
            removed: "0",
            added: "1",
            attachmentId: 7,
          },
        ],
      },
      {
        when: "2024-01-01T10:00:00Z",
        who: "reporter@example.com",
        changes: [{ fieldName: "status", removed: "NEW", added: "ASSIGNED" }],
      },
    ]);
    const historyUrl = (fetchMock.mock.calls as [URL][])
      .map(([url]) => url)
      .find((url) => url.pathname === "/rest/bug/42/history");
    expect(historyUrl).toBeTruthy();
  });

  it("maps extra Bugzilla fields onto the bug detail", async () => {
    fetchMock
      .mockResolvedValueOnce(
        response({
          bugs: [
            {
              id: 42,
              summary: "Toolbar is clipped",
              status: "NEW",
              whiteboard: "[triaged]",
              cf_crash_signature: "nsFoo",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(response({ bugs: { "42": { comments: [] } } }))
      .mockResolvedValueOnce(response({ bugs: { "42": [] } }))
      .mockResolvedValueOnce(emptyHistory());

    const bug = await getBug(42);
    expect(bug.extraFields).toMatchObject({
      whiteboard: "[triaged]",
      cf_crash_signature: "nsFoo",
    });
  });

  it("resolves blocks and depends_on into linked bugs", async () => {
    fetchMock.mockImplementation(async (url: URL) => {
      if (url.pathname === "/rest/bug/42") {
        return response({
          bugs: [{ id: 42, summary: "Toolbar", blocks: [50, 51], depends_on: [7] }],
        });
      }
      if (url.pathname === "/rest/bug/42/comment") {
        return response({ bugs: { "42": { comments: [] } } });
      }
      if (url.pathname === "/rest/bug/42/attachment") {
        return response({ bugs: { "42": [] } });
      }
      if (url.pathname === "/rest/bug/42/history") {
        return emptyHistory();
      }
      return response({
        bugs: [
          {
            id: 7,
            summary: "Layout engine",
            assigned_to: "dev@example.com",
            assigned_to_detail: { real_name: "Dev Name" },
          },
          { id: 50, summary: "Release", assigned_to: "lead@example.com" },
        ],
      });
    });

    const bug = await getBug(42);

    expect(bug.blocks).toEqual([
      linkedBug({ id: 50, summary: "Release", assignedTo: "lead@example.com" }),
      linkedBug({ id: 51, summary: "", assignedTo: "" }),
    ]);
    expect(bug.dependsOn).toEqual([
      linkedBug({
        id: 7,
        summary: "Layout engine",
        assignedTo: "dev@example.com",
        assignedToName: "Dev Name",
      }),
    ]);
    const linkedUrl = (fetchMock.mock.calls as [URL][])
      .map(([url]) => url)
      .find((url) => url.pathname === "/rest/bug");
    expect(linkedUrl?.searchParams.getAll("id")).toEqual(["50", "51", "7"]);
    expect(linkedUrl?.searchParams.get("include_fields")).toContain("assigned_to");
  });

  it("requests project-configured linked columns for Blocks and Depends On", async () => {
    fetchMock.mockImplementation(async (url: URL) => {
      if (url.pathname === "/rest/bug/42") {
        return response({
          bugs: [
            {
              id: 42,
              summary: "Toolbar",
              product: "Browser",
              blocks: [50],
              depends_on: [],
            },
          ],
        });
      }
      if (url.pathname === "/rest/bug/42/comment") {
        return response({ bugs: { "42": { comments: [] } } });
      }
      if (url.pathname === "/rest/bug/42/attachment") {
        return response({ bugs: { "42": [] } });
      }
      if (url.pathname === "/rest/bug/42/history") {
        return emptyHistory();
      }
      return response({
        bugs: [
          {
            id: 50,
            summary: "Release",
            status: "NEW",
            priority: "P1",
            whiteboard: "[tracked]",
            assigned_to: "lead@example.com",
          },
        ],
      });
    });

    const bug = await getBug(42);

    expect(bug.blocks).toEqual([
      linkedBug({
        id: 50,
        summary: "Release",
        status: "NEW",
        priority: "P1",
        assignedTo: "lead@example.com",
        extraFields: { whiteboard: "[tracked]" },
      }),
    ]);
    const linkedUrl = (fetchMock.mock.calls as [URL][])
      .map(([url]) => url)
      .find((url) => url.pathname === "/rest/bug");
    const includeFields = linkedUrl?.searchParams.get("include_fields") ?? "";
    expect(includeFields.split(",")).toEqual(
      expect.arrayContaining([
        "id",
        "summary",
        "status",
        "whiteboard",
        "priority",
        "assigned_to",
        "assigned_to_detail",
      ]),
    );
  });

  it("keeps linked bug IDs when their details cannot be loaded", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ bugs: [{ id: 42, blocks: [], depends_on: [9] }] }))
      .mockResolvedValueOnce(response({ bugs: { "42": { comments: [] } } }))
      .mockResolvedValueOnce(response({ bugs: { "42": [] } }))
      .mockResolvedValueOnce(emptyHistory())
      .mockResolvedValueOnce(response({ error: true, message: "denied" }, false));

    const bug = await getBug(42);

    expect(bug.blocks).toEqual([]);
    expect(bug.dependsOn).toEqual([
      linkedBug({ id: 9, summary: "", assignedTo: "" }),
    ]);
  });

  it("loads detail field options from /rest/field/bug", async () => {
    fetchMock.mockResolvedValue(
      response({
        fields: [
          {
            name: "assigned_to",
            display_name: "Assignee",
            type: 1,
          },
          {
            name: "bug_status",
            display_name: "Status",
            type: 2,
            values: [
              { name: "NEW", sort_key: 1 },
              { name: "ASSIGNED", sort_key: 2 },
            ],
          },
          {
            name: "status_whiteboard",
            display_name: "Whiteboard",
            type: 1,
          },
          {
            name: "cf_blocking",
            display_name: "Blocking",
            type: 2,
            values: [
              { name: "yes", sort_key: 1 },
              { name: "no", sort_key: 2 },
            ],
          },
          {
            name: "summary",
            display_name: "Summary",
            type: 1,
          },
        ],
      }),
    );

    const fields = await getProductDetailFields("Browser");
    const byKey = new Map(fields.map((field) => [field.key, field]));
    expect(byKey.has("assignedTo")).toBe(true);
    expect(byKey.get("status")).toMatchObject({
      type: "select",
      values: ["NEW", "ASSIGNED"],
    });
    expect(byKey.has("bug_status")).toBe(false);
    expect(byKey.get("whiteboard")).toMatchObject({
      label: "Whiteboard",
      type: "text",
    });
    expect(byKey.get("cf_blocking")).toMatchObject({
      label: "Blocking",
      type: "select",
      values: ["yes", "no"],
    });
    expect(byKey.get("summary")?.label).toBe("Summary");

    const [url] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/rest/field/bug");
  });

  it("surfaces Bugzilla error messages", async () => {
    fetchMock.mockResolvedValue(
      response({ error: true, message: "Invalid API key" }, false),
    );

    await expect(searchBugs({ projectId: "browser" })).rejects.toThrow(
      "Invalid API key",
    );
  });

  it("files a bug with POST and returns the created bug", async () => {
    fetchMock.mockResolvedValueOnce(response({ id: 99 }));
    mockFullBug({ id: 99, summary: "Toolbar clips" });

    const bug = await createBug("Browser", {
      summary: "Toolbar clips",
      description: "Steps",
      status: "NEW",
      resolution: "",
      assignedTo: "dev@example.com",
      priority: "P2",
      severity: "",
      component: "UI",
      version: "1.0",
      platform: "",
      keywords: "regression, crash",
      extraFields: { whiteboard: "triage", cf_flags: "a, b" },
    }, { cf_flags: "multiselect" });

    expect(bug.id).toBe(99);
    expect(bug.summary).toBe("Toolbar clips");
    expect(bug.description).toBe("Steps");
    const [url, options] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/rest/bug");
    expect(url.searchParams.get("api_key")).toBe("secret");
    expect(options.method).toBe("POST");
    expect(JSON.parse(String(options.body))).toEqual({
      product: "Browser",
      summary: "Toolbar clips",
      description: "Steps",
      status: "NEW",
      assigned_to: "dev@example.com",
      priority: "P2",
      component: "UI",
      version: "1.0",
      keywords: ["regression", "crash"],
      whiteboard: "triage",
      cf_flags: ["a", "b"],
    });
  });

  it("names the Bugzilla field when a create error identifies one", async () => {
    fetchMock.mockResolvedValue(
      response(
        { error: true, message: "A value is required.", field: "cf_blocking" },
        false,
      ),
    );

    await expect(
      createBug("Browser", {
        summary: "Toolbar clips",
        description: "",
        status: "",
        resolution: "",
        assignedTo: "",
        priority: "",
        severity: "",
        component: "UI",
        version: "1.0",
        platform: "",
        keywords: "",
        extraFields: {},
      }),
    ).rejects.toThrow("A value is required. (cf_blocking)");
  });

  it("updates a bug with PUT and returns the refreshed bug", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ bugs: [{ id: 42, changes: {} }] }))
      .mockResolvedValueOnce(
        response({
          bugs: [
            {
              id: 42,
              summary: "Toolbar clips on resize",
              status: "ASSIGNED",
              assigned_to: "dev@example.com",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        response({ bugs: { "42": { comments: [{ id: 1, text: "Steps" }] } } }),
      )
      .mockResolvedValueOnce(response({ bugs: { "42": [] } }))
      .mockResolvedValueOnce(emptyHistory());

    const bug = await updateBug(42, {
      summary: "Toolbar clips on resize",
      status: "ASSIGNED",
      assignedTo: "dev@example.com",
      resolution: "---",
      keywords: ["regression", " crash "],
    });

    expect(bug.summary).toBe("Toolbar clips on resize");
    expect(bug.description).toBe("Steps");
    const [url, options] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/rest/bug/42");
    expect(url.searchParams.get("api_key")).toBe("secret");
    expect(options.method).toBe("PUT");
    expect(options.headers).toMatchObject({
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-BUGZILLA-API-KEY": "secret",
    });
    expect(JSON.parse(String(options.body))).toEqual({
      ids: [42],
      summary: "Toolbar clips on resize",
      status: "ASSIGNED",
      assigned_to: "dev@example.com",
      resolution: "",
      keywords: { set: ["regression", "crash"] },
    });
  });

  it("rejects an empty bug update before calling Bugzilla", async () => {
    await expect(updateBug(42, {})).rejects.toThrow("There is nothing to update.");
    await expect(updateBug(42, { summary: "  " })).rejects.toThrow(
      "Summary cannot be empty.",
    );
    await expect(updateBug(0, { summary: "Toolbar" })).rejects.toThrow(
      "Invalid bug number.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends custom fields through the Bugzilla update body", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ bugs: [{ id: 42 }] }))
      .mockResolvedValueOnce(
        response({
          bugs: [
            {
              id: 42,
              summary: "Toolbar is clipped",
              status: "NEW",
              assigned_to: "dev@example.com",
              creator: "reporter@example.com",
              product: "Browser",
              component: "UI",
              priority: "P3",
              severity: "normal",
              version: "unspecified",
              platform: "All",
              resolution: "",
              keywords: [],
              creation_time: "2026-10-01T00:00:00Z",
              last_change_time: "2026-10-02T00:00:00Z",
              cf_team: "Apps",
              whiteboard: "[ready]",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        response({ bugs: { "42": { comments: [{ id: 1, text: "Steps" }] } } }),
      )
      .mockResolvedValueOnce(response({ bugs: { "42": [] } }))
      .mockResolvedValueOnce(emptyHistory());

    await updateBug(42, {
      extraFields: {
        cf_team: " Apps ",
        whiteboard: "[ready]",
        cf_tags: ["alpha", " beta "],
      },
    });

    const [, options] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(JSON.parse(String(options.body))).toEqual({
      ids: [42],
      cf_team: "Apps",
      whiteboard: "[ready]",
      cf_tags: ["alpha", "beta"],
    });
  });

  it("adds and removes CC followers through the update body", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ bugs: [{ id: 42 }] }))
      .mockResolvedValueOnce(
        response({
          bugs: [
            {
              id: 42,
              summary: "Toolbar is clipped",
              cc: ["me@example.com"],
              cc_detail: [
                {
                  name: "me@example.com",
                  real_name: "Me",
                  email: "me@example.com",
                },
              ],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(response({ bugs: { "42": { comments: [] } } }))
      .mockResolvedValueOnce(response({ bugs: { "42": [] } }))
      .mockResolvedValueOnce(emptyHistory());

    const bug = await updateBug(42, {
      cc: { add: [" me@example.com "], remove: ["other@example.com"] },
    });

    expect(bug.cc).toEqual([{ name: "me@example.com", realName: "Me" }]);
    const [, options] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(JSON.parse(String(options.body))).toEqual({
      ids: [42],
      cc: {
        add: ["me@example.com"],
        remove: ["other@example.com"],
      },
    });
  });

  it("adds blocks and depends_on links through the update body", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ bugs: [{ id: 42 }] }))
      .mockResolvedValueOnce(
        response({
          bugs: [
            {
              id: 42,
              summary: "Toolbar is clipped",
              blocks: [50],
              depends_on: [7],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(response({ bugs: { "42": { comments: [] } } }))
      .mockResolvedValueOnce(response({ bugs: { "42": [] } }))
      .mockResolvedValueOnce(emptyHistory())
      .mockResolvedValueOnce(
        response({
          bugs: [
            { id: 50, summary: "Release", assigned_to: "lead@example.com" },
            { id: 7, summary: "Layout", assigned_to: "dev@example.com" },
          ],
        }),
      );

    const bug = await updateBug(42, {
      blocks: { add: [50] },
      dependsOn: { add: [7], remove: [9] },
    });

    expect(bug.blocks).toEqual([
      linkedBug({ id: 50, summary: "Release", assignedTo: "lead@example.com" }),
    ]);
    expect(bug.dependsOn).toEqual([
      linkedBug({ id: 7, summary: "Layout", assignedTo: "dev@example.com" }),
    ]);
    const [, options] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(JSON.parse(String(options.body))).toEqual({
      ids: [42],
      blocks: { add: [50] },
      depends_on: { add: [7], remove: [9] },
    });
  });

  it("searches linkable bugs by id or quicksearch", async () => {
    fetchMock.mockResolvedValueOnce(
      response({
        bugs: [
          {
            id: 50,
            summary: "Release blocker",
            assigned_to: "lead@example.com",
            assigned_to_detail: { real_name: "Lead" },
          },
        ],
      }),
    );

    await expect(searchLinkableBugs("50")).resolves.toEqual([
      linkedBug({
        id: 50,
        summary: "Release blocker",
        assignedTo: "lead@example.com",
        assignedToName: "Lead",
      }),
    ]);
    const [idUrl] = fetchMock.mock.calls[0] as [URL];
    expect(idUrl.pathname).toBe("/rest/bug");
    expect(idUrl.searchParams.getAll("id")).toEqual(["50"]);
    expect(idUrl.searchParams.get("quicksearch")).toBeNull();
    expect(idUrl.searchParams.get("limit")).toBe("20");

    fetchMock.mockResolvedValueOnce(
      response({
        bugs: [{ id: 7, summary: "Toolbar crash", assigned_to: "dev@example.com" }],
      }),
    );
    await expect(searchLinkableBugs("toolbar")).resolves.toEqual([
      linkedBug({
        id: 7,
        summary: "Toolbar crash",
        assignedTo: "dev@example.com",
      }),
    ]);
    const [textUrl] = fetchMock.mock.calls[1] as [URL];
    expect(textUrl.searchParams.get("quicksearch")).toBe("toolbar");
    expect(textUrl.searchParams.getAll("id")).toEqual([]);

    await expect(searchLinkableBugs("  ")).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports a failed refresh after a successful update", async () => {
    fetchMock.mockResolvedValueOnce(response({ bugs: [{ id: 42 }] }));
    fetchMock.mockResolvedValue(
      response({ error: true, message: "unavailable" }, false),
    );

    await expect(updateBug(42, { summary: "Updated" })).rejects.toThrow(
      "Saved, but the bug could not be refreshed. unavailable",
    );
  });

  it("adds a comment with POST", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ id: 9 }))
      .mockResolvedValueOnce(
        response({ bugs: [{ id: 42, summary: "Toolbar is clipped" }] }),
      )
      .mockResolvedValueOnce(
        response({
          bugs: {
            "42": {
              comments: [
                { id: 1, text: "Steps" },
                { id: 9, creator: "dev", text: "Looks fixed" },
              ],
            },
          },
        }),
      )
      .mockResolvedValueOnce(response({ bugs: { "42": [] } }))
      .mockResolvedValueOnce(emptyHistory());
    fetchMock.mockResolvedValueOnce(
      response({ users: [{ name: "dev", real_name: "Dev Name" }] }),
    );

    const bug = await addComment(42, { text: "  Looks fixed  ", isPrivate: true });

    expect(bug.comments[0]?.text).toBe("Looks fixed");
    expect(bug.comments[0]?.creatorName).toBe("Dev Name");
    const [url, options] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/rest/bug/42/comment");
    expect(options.method).toBe("POST");
    expect(JSON.parse(String(options.body))).toEqual({
      comment: "Looks fixed",
      is_private: true,
    });
  });

  it("rejects a blank comment", async () => {
    await expect(addComment(42, { text: "   " })).rejects.toThrow(
      "Comment cannot be empty.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uploads an attachment as base64", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ ids: [7] }))
      .mockResolvedValueOnce(response({ bugs: [{ id: 42, summary: "Toolbar" }] }))
      .mockResolvedValueOnce(response({ bugs: { "42": { comments: [] } } }))
      .mockResolvedValueOnce(
        response({
          bugs: {
            "42": [
              {
                id: 7,
                file_name: "notes.txt",
                summary: "notes.txt",
                content_type: "text/plain",
                size: 5,
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(emptyHistory());

    const bug = await addAttachment(42, {
      fileName: "notes.txt",
      contentType: "text/plain",
      data: "data:text/plain;base64,aGVsbG8=",
      comment: " See notes ",
    });

    expect(bug.attachments[0]?.fileName).toBe("notes.txt");
    const [url, options] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/rest/bug/42/attachment");
    expect(options.method).toBe("POST");
    expect(JSON.parse(String(options.body))).toEqual({
      ids: [42],
      file_name: "notes.txt",
      summary: "notes.txt",
      content_type: "text/plain",
      data: "aGVsbG8=",
      comment: "See notes",
      is_private: false,
    });
  });

  it("marks patch files and keeps a provided summary", async () => {
    fetchMock.mockResolvedValueOnce(response({ ids: [8] }));
    fetchMock.mockResolvedValue(response({ error: true, message: "refresh failed" }, false));

    await expect(
      addAttachment(42, {
        fileName: "fix.patch",
        contentType: "text/x-patch",
        data: "aGVsbG8=",
        summary: "Fix the toolbar",
        isPrivate: true,
      }),
    ).rejects.toThrow("Attachment uploaded, but the bug could not be refreshed.");

    const [, options] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(JSON.parse(String(options.body))).toMatchObject({
      file_name: "fix.patch",
      summary: "Fix the toolbar",
      is_patch: true,
      is_private: true,
    });
  });

  it("rejects empty, invalid, and oversized attachments", async () => {
    await expect(
      addAttachment(42, {
        fileName: " ",
        contentType: "text/plain",
        data: "aGVsbG8=",
      }),
    ).rejects.toThrow("Attachment needs a file name.");
    await expect(
      addAttachment(42, {
        fileName: "notes.txt",
        contentType: "text/plain",
        data: "not base64",
      }),
    ).rejects.toThrow("Attachment data must be base64.");
    await expect(
      addAttachment(42, {
        fileName: "huge.bin",
        contentType: "application/octet-stream",
        data: Buffer.alloc(10 * 1024 * 1024 + 1).toString("base64"),
      }),
    ).rejects.toThrow("Attachments must be 10 MB or smaller.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("downloads attachment bytes through the REST API", async () => {
    fetchMock.mockResolvedValue(
      response({
        attachments: {
          "7": {
            id: 7,
            file_name: "notes.txt",
            content_type: "text/plain",
            data: "aGVsbG8=",
          },
        },
      }),
    );

    const file = await getAttachmentFile(7);

    expect(file).toEqual({
      fileName: "notes.txt",
      contentType: "text/plain",
      data: Buffer.from("hello"),
    });
    const [url, options] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/rest/bug/attachment/7");
    expect(options.method ?? "GET").toBe("GET");
    expect(
      (options.headers as Record<string, string>)["X-BUGZILLA-API-KEY"],
    ).toBe("secret");
  });

  it("sanitizes attachment file names and rejects missing data", async () => {
    fetchMock.mockResolvedValueOnce(
      response({
        attachments: {
          "8": {
            id: 8,
            file_name: "../../evil:name?.txt",
            content_type: "text/plain",
            data: "YQ==",
          },
        },
      }),
    );

    await expect(getAttachmentFile(8)).resolves.toMatchObject({
      fileName: "evil_name_.txt",
      data: Buffer.from("a"),
    });

    fetchMock.mockResolvedValueOnce(
      response({
        attachments: {
          "9": {
            id: 9,
            file_name: "empty.bin",
            content_type: "application/octet-stream",
            data: "",
          },
        },
      }),
    );
    await expect(getAttachmentFile(9)).rejects.toThrow("Attachment has no data.");

    await expect(getAttachmentFile(0)).rejects.toThrow("Invalid attachment.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stores a fetched bug and reuses it when last_change_time matches", async () => {
    mockFullBug({ summary: "Cached summary", comment: "Confirmed" });

    const first = await getBug(42);
    expect(first.summary).toBe("Cached summary");
    expect(first.description).toBe("Steps");
    expect(first.comments.map((comment) => comment.text)).toEqual(["Confirmed"]);
    const fetchesForFullBug = fetchMock.mock.calls.length;

    fetchMock.mockResolvedValueOnce(
      response({
        bugs: [{ id: 42, last_change_time: "2026-10-18T10:00:00Z" }],
      }),
    );
    const second = await getBug(42);

    expect(second).toEqual(first);
    expect(fetchMock.mock.calls.length).toBe(fetchesForFullBug + 1);
    const [url] = fetchMock.mock.calls.at(-1) as [URL, RequestInit];
    expect(url.pathname).toBe("/rest/bug/42");
    expect(url.searchParams.get("include_fields")).toBe("last_change_time");
  });

  it("treats an equivalent timestamp as unchanged", async () => {
    mockFullBug({ lastChangeTime: "2026-10-18T10:00:00Z" });
    const first = await getBug(42);
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      response({
        bugs: [{ id: 42, last_change_time: "2026-10-18T10:00:00.000Z" }],
      }),
    );

    await expect(getBug(42)).resolves.toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fetches a new copy when the cached bug is out of date", async () => {
    mockFullBug({
      summary: "Old summary",
      lastChangeTime: "2026-10-18T10:00:00Z",
      comment: "Old",
    });
    await getBug(42);
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      response({
        bugs: [{ id: 42, last_change_time: "2026-10-19T08:00:00Z" }],
      }),
    );
    mockFullBug({
      summary: "New summary",
      lastChangeTime: "2026-10-19T08:00:00Z",
      comment: "New",
    });

    const bug = await getBug(42);

    expect(bug.summary).toBe("New summary");
    expect(bug.lastChangeTime).toBe("2026-10-19T08:00:00Z");
    expect(bug.comments.map((comment) => comment.text)).toEqual(["New"]);
    const [freshnessUrl] = fetchMock.mock.calls[0] as [URL];
    expect(freshnessUrl.pathname).toBe("/rest/bug/42");
    expect(freshnessUrl.searchParams.get("include_fields")).toBe(
      "last_change_time",
    );
    const [fullUrl] = fetchMock.mock.calls[1] as [URL];
    expect(fullUrl.pathname).toBe("/rest/bug/42");
    expect(fullUrl.searchParams.has("include_fields")).toBe(false);
  });

  it("fetches a full copy when the freshness check fails", async () => {
    mockFullBug({ summary: "Cached" });
    await getBug(42);
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      response({ error: true, message: "unavailable" }, false),
    );
    mockFullBug({
      summary: "Fresh",
      lastChangeTime: "2026-10-20T00:00:00Z",
    });

    await expect(getBug(42)).resolves.toMatchObject({ summary: "Fresh" });
  });

  it("reads a cached bug from disk after the in-memory copy is dropped", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "bugzilli-bug-cache-"));
    setBugCacheDirectory(directory);
    try {
      mockFullBug({ summary: "From disk", comment: "Kept" });
      const first = await getBug(42);
      setBugCacheDirectory(directory);
      fetchMock.mockReset();
      fetchMock.mockResolvedValueOnce(
        response({
          bugs: [{ id: 42, last_change_time: "2026-10-18T10:00:00Z" }],
        }),
      );

      await expect(getBug(42)).resolves.toEqual(first);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      setBugCacheDirectory(undefined);
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("does not reuse a cached bug from a different Bugzilla instance", async () => {
    mockFullBug({ summary: "First instance" });
    await getBug(42);
    const current = await getConnection();
    getConnectionMock.mockResolvedValue({
      ...current,
      baseUrl: "https://other.example.com",
    });
    try {
      fetchMock.mockReset();
      mockFullBug({ summary: "Other instance", comment: "Elsewhere" });
      const bug = await getBug(42);
      expect(bug.summary).toBe("Other instance");
      expect(bug.comments.map((comment) => comment.text)).toEqual(["Elsewhere"]);
      const [url] = fetchMock.mock.calls[0] as [URL];
      expect(url.origin).toBe("https://other.example.com");
      expect(url.searchParams.has("include_fields")).toBe(false);
    } finally {
      getConnectionMock.mockResolvedValue(current);
    }
  });

  it("replaces the cached bug after an update", async () => {
    mockFullBug({ summary: "Old", lastChangeTime: "2026-10-18T10:00:00Z" });
    await getBug(42);
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(response({ bugs: [{ id: 42, changes: {} }] }));
    mockFullBug({ summary: "Edited", lastChangeTime: "2026-10-19T12:00:00Z" });

    const edited = await updateBug(42, { summary: "Edited" });

    expect(edited.summary).toBe("Edited");
    const detailGets = (fetchMock.mock.calls as [URL, RequestInit | undefined][])
      .filter(
        ([url, init]) =>
          (init?.method ?? "GET") === "GET" && url.pathname === "/rest/bug/42",
      );
    expect(detailGets[0]?.[0].searchParams.has("include_fields")).toBe(false);

    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      response({
        bugs: [{ last_change_time: "2026-10-19T12:00:00Z" }],
      }),
    );
    const opened = await getBug(42);
    expect(opened.summary).toBe("Edited");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
