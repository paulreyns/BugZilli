import type {
  Bug,
  BugAttachment,
  BugComment,
  BugDetail,
  BugSearch,
} from "../shared/types.js";
import { getConnection } from "./settings.js";

type JsonRecord = Record<string, unknown>;

const bugFields = [
  "id",
  "summary",
  "status",
  "resolution",
  "product",
  "component",
  "priority",
  "severity",
  "assigned_to",
  "creator",
  "creation_time",
  "last_change_time",
  "keywords",
  "platform",
  "version",
].join(",");

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function number(value: unknown): number {
  return typeof value === "number" ? value : Number(value) || 0;
}

function mapBug(value: JsonRecord): Bug {
  return {
    id: number(value.id),
    summary: text(value.summary),
    status: text(value.status),
    resolution: text(value.resolution),
    product: text(value.product),
    component: text(value.component),
    priority: text(value.priority),
    severity: text(value.severity),
    assignedTo: text(value.assigned_to),
    creator: text(value.creator),
    creationTime: text(value.creation_time),
    lastChangeTime: text(value.last_change_time),
    description: "",
    keywords: Array.isArray(value.keywords) ? value.keywords.map(String) : [],
    platform: text(value.platform),
    version: text(value.version),
  };
}

async function request(path: string, params?: URLSearchParams): Promise<JsonRecord> {
  const { baseUrl, apiKey } = await getConnection();
  const url = new URL(`${baseUrl}/rest/${path.replace(/^\//, "")}`);
  const requestParams = params ?? new URLSearchParams();
  if (apiKey && !requestParams.has("api_key")) {
    requestParams.set("api_key", apiKey);
  }
  url.search = requestParams.toString();

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(apiKey ? { "X-BUGZILLA-API-KEY": apiKey } : {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as JsonRecord;
  if (!response.ok || payload.error === true) {
    const message =
      text(payload.message) || `Bugzilla request failed (${response.status}).`;
    throw new Error(message);
  }
  return payload;
}

export async function searchBugs(search: BugSearch): Promise<Bug[]> {
  const { projects } = await getConnection();
  const project = projects.find(({ id }) => id === search.projectId);
  if (!project) throw new Error("The selected project no longer exists.");

  const params = new URLSearchParams({
    product: project.product,
    include_fields: bugFields,
    limit: String(Math.min(Math.max(search.limit ?? 200, 1), 500)),
    order: "changeddate DESC",
  });
  if (!project.showClosedBugs) params.set("resolution", "---");
  if (search.query?.trim()) params.set("quicksearch", search.query.trim());

  const payload = await request("bug", params);
  return Array.isArray(payload.bugs)
    ? payload.bugs.map((bug) => mapBug(bug as JsonRecord))
    : [];
}

function mapComment(value: JsonRecord): BugComment {
  return {
    id: number(value.id),
    creator: text(value.creator),
    creationTime: text(value.creation_time),
    text: text(value.text),
    isPrivate: value.is_private === true,
  };
}

function mapAttachment(value: JsonRecord): BugAttachment {
  return {
    id: number(value.id),
    fileName: text(value.file_name),
    summary: text(value.summary),
    contentType: text(value.content_type),
    size: number(value.size),
    creator: text(value.creator),
    creationTime: text(value.creation_time),
    isObsolete: value.is_obsolete === true,
    isPrivate: value.is_private === true,
  };
}

export async function getBug(id: number): Promise<BugDetail> {
  if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid bug number.");
  const fields = new URLSearchParams({ include_fields: bugFields });
  const [bugPayload, commentPayload, attachmentPayload] = await Promise.all([
    request(`bug/${id}`, fields),
    request(`bug/${id}/comment`),
    request(`bug/${id}/attachment`),
  ]);

  const bugValue = Array.isArray(bugPayload.bugs)
    ? (bugPayload.bugs[0] as JsonRecord | undefined)
    : undefined;
  if (!bugValue) throw new Error(`Bug ${id} was not found.`);

  const commentBugs = commentPayload.bugs as JsonRecord | undefined;
  const commentContainer = commentBugs?.[String(id)] as JsonRecord | undefined;
  const allComments = Array.isArray(commentContainer?.comments)
    ? commentContainer.comments.map((comment) => mapComment(comment as JsonRecord))
    : [];

  const attachmentBugs = attachmentPayload.bugs as JsonRecord | undefined;
  const attachmentValues = attachmentBugs?.[String(id)];
  const attachments = Array.isArray(attachmentValues)
    ? attachmentValues.map((attachment) =>
        mapAttachment(attachment as JsonRecord),
      )
    : [];

  const bug = mapBug(bugValue);
  return {
    ...bug,
    description: allComments[0]?.text ?? "",
    comments: allComments.slice(1),
    attachments,
  };
}
