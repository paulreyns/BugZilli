import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./settings.js", () => ({
  getConnection: vi.fn().mockResolvedValue({
    baseUrl: "https://bugs.example.com",
    apiKey: "secret",
    projects: [{ id: "browser", name: "Browser", product: "Browser" }],
  }),
}));

import { getBug, searchBugs } from "./bugzilla.js";

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
    });
    const [url, options] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.searchParams.get("product")).toBe("Browser");
    expect(url.searchParams.get("quicksearch")).toBe("toolbar");
    expect(options.headers).toMatchObject({
      "X-BUGZILLA-API-KEY": "secret",
    });
  });

  it("uses the first comment as the description and keeps later comments", async () => {
    fetchMock
      .mockResolvedValueOnce(
        response({
          bugs: [{ id: 42, summary: "Toolbar is clipped", status: "NEW" }],
        }),
      )
      .mockResolvedValueOnce(
        response({
          bugs: {
            "42": {
              comments: [
                { id: 1, creator: "reporter", text: "Steps to reproduce" },
                { id: 2, creator: "developer", text: "Confirmed" },
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

    expect(bug.description).toBe("Steps to reproduce");
    expect(bug.comments).toHaveLength(1);
    expect(bug.attachments[0]?.fileName).toBe("screenshot.png");
  });

  it("surfaces Bugzilla error messages", async () => {
    fetchMock.mockResolvedValue(
      response({ error: true, message: "Invalid API key" }, false),
    );

    await expect(searchBugs({ projectId: "browser" })).rejects.toThrow(
      "Invalid API key",
    );
  });
});
