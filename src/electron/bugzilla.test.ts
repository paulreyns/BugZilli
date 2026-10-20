import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./settings.js", () => ({
  getConnection: vi.fn().mockResolvedValue({
    baseUrl: "https://bugs.example.com",
    apiKey: "secret",
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
    ],
  }),
}));

import {
  addAttachment,
  addComment,
  getAttachmentFile,
  getBug,
  getProductDetailFields,
  searchBugs,
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

describe("Bugzilla API client", () => {
  beforeEach(() => {
    fetchMock.mockReset();
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
    expect(url.searchParams.getAll("resolution")).toEqual(["FIXED"]);
  });

  it("passes selected field filters through to the Bugzilla search", async () => {
    fetchMock.mockResolvedValue(response({ bugs: [] }));

    await searchBugs({
      projectId: "browser",
      filters: [
        { field: "status", value: "NEW" },
        { field: "assignedTo", value: "dev@example.com" },
      ],
    });

    const [url] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.searchParams.get("status")).toBe("NEW");
    expect(url.searchParams.get("assigned_to")).toBe("dev@example.com");
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
                  creator: "developer",
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
              },
            ],
          },
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
    expect(bug.attachments[0]?.fileName).toBe("screenshot.png");
    const [bugUrl] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(bugUrl.pathname).toContain("/rest/bug/42");
    expect(bugUrl.searchParams.has("include_fields")).toBe(false);
    for (const [url] of fetchMock.mock.calls as [URL, RequestInit][]) {
      expect(url.searchParams.get("api_key")).toBe("secret");
    }
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
      .mockResolvedValueOnce(response({ bugs: { "42": [] } }));

    const bug = await getBug(42);
    expect(bug.extraFields).toMatchObject({
      whiteboard: "[triaged]",
      cf_crash_signature: "nsFoo",
    });
  });

  it("loads detail field options from one product bug", async () => {
    fetchMock.mockResolvedValue(
      response({
        bugs: [
          {
            id: 9,
            summary: "Sample",
            product: "Browser",
            status: "NEW",
            assigned_to: "dev@example.com",
            whiteboard: "[triaged]",
            cf_blocking: "yes",
          },
        ],
      }),
    );

    const fields = await getProductDetailFields("Browser");
    const keys = fields.map(({ key }) => key);
    expect(keys).toContain("assignedTo");
    expect(keys).toContain("whiteboard");
    expect(keys).toContain("cf_blocking");

    const [url] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.searchParams.get("product")).toBe("Browser");
    expect(url.searchParams.get("limit")).toBe("1");
  });

  it("surfaces Bugzilla error messages", async () => {
    fetchMock.mockResolvedValue(
      response({ error: true, message: "Invalid API key" }, false),
    );

    await expect(searchBugs({ projectId: "browser" })).rejects.toThrow(
      "Invalid API key",
    );
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
      .mockResolvedValueOnce(response({ bugs: { "42": [] } }));

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
      .mockResolvedValueOnce(response({ bugs: { "42": [] } }));

    const bug = await addComment(42, { text: "  Looks fixed  ", isPrivate: true });

    expect(bug.comments[0]?.text).toBe("Looks fixed");
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
      );

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
});
