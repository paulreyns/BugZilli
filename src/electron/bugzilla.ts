import {
  baseBugFields,
  bugzillaNameForKey,
  catalogFromBugRecord,
  keyForBugzillaField,
} from "../shared/detail-fields.js";
import {
  appendFilterParams,
  cleanFilterRules,
  isOpenResolutionRule,
} from "../shared/list-filters.js";
import { resolveListColumns } from "../shared/list-columns.js";
import {
  MAX_ATTACHMENT_BYTES,
  type Bug,
  type BugAttachment,
  type BugAttachmentDraft,
  type BugComment,
  type BugCommentDraft,
  type BugDetail,
  type DetailFieldOption,
  type BugSearch,
  type BugUpdate,
  type Project,
} from "../shared/types.js";
import { getConnection } from "./settings.js";

type JsonRecord = Record<string, unknown>;

interface BugzillaRequest {
  params?: URLSearchParams;
  method?: "GET" | "POST" | "PUT";
  body?: JsonRecord;
}

function includeFieldsForProject(project: Project): string {
  const fields = new Set<string>(baseBugFields);
  for (const key of resolveListColumns(project.listColumns)) {
    fields.add(bugzillaNameForKey(key));
  }
  return [...fields].join(",");
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function number(value: unknown): number {
  return typeof value === "number" ? value : Number(value) || 0;
}

const mappedBugzillaFields = new Set([
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
]);

function formatExtraValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function mapExtraFields(value: JsonRecord): Record<string, string> | undefined {
  const extras: Record<string, string> = {};
  for (const [name, raw] of Object.entries(value)) {
    if (mappedBugzillaFields.has(name)) continue;
    if (name.endsWith("_detail")) continue;
    if (
      raw !== null &&
      raw !== undefined &&
      typeof raw !== "string" &&
      typeof raw !== "number" &&
      typeof raw !== "boolean" &&
      !(
        Array.isArray(raw) &&
        raw.every(
          (item) =>
            typeof item === "string" ||
            typeof item === "number" ||
            typeof item === "boolean",
        )
      )
    ) {
      continue;
    }
    const formatted = formatExtraValue(raw).trim();
    if (!formatted) continue;
    extras[keyForBugzillaField(name)] = formatted;
  }
  return Object.keys(extras).length > 0 ? extras : undefined;
}

function mapBug(value: JsonRecord): Bug {
  const extraFields = mapExtraFields(value);
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
    assignedToName: text(
      (value.assigned_to_detail as JsonRecord | undefined)?.real_name,
    ),
    creator: text(value.creator),
    creationTime: text(value.creation_time),
    lastChangeTime: text(value.last_change_time),
    description: "",
    keywords: Array.isArray(value.keywords) ? value.keywords.map(String) : [],
    platform: text(value.platform),
    version: text(value.version),
    ...(extraFields ? { extraFields } : {}),
  };
}

async function request(path: string, init?: BugzillaRequest): Promise<JsonRecord> {
  const { baseUrl, apiKey } = await getConnection();
  const url = new URL(`${baseUrl}/rest/${path.replace(/^\//, "")}`);
  const requestParams = init?.params ?? new URLSearchParams();
  if (apiKey && !requestParams.has("api_key")) {
    requestParams.set("api_key", apiKey);
  }
  url.search = requestParams.toString();

  const response = await fetch(url, {
    method: init?.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(apiKey ? { "X-BUGZILLA-API-KEY": apiKey } : {}),
    },
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
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

  const filters = cleanFilterRules(search.filters);
  const resolutionFilters = filters.filter(
    ({ field }) => bugzillaNameForKey(field) === "resolution",
  );
  if (
    !project.showClosedBugs &&
    resolutionFilters.some((rule) => !isOpenResolutionRule(rule))
  ) {
    return [];
  }

  const params = new URLSearchParams({
    product: project.product,
    include_fields: includeFieldsForProject(project),
    limit: String(Math.min(Math.max(search.limit ?? 300, 1), 500)),
    order: "changeddate DESC",
  });
  if (!project.showClosedBugs) params.set("resolution", "---");
  if (search.query?.trim()) params.set("quicksearch", search.query.trim());
  appendFilterParams(
    params,
    project.showClosedBugs
      ? filters
      : filters.filter(({ field }) => bugzillaNameForKey(field) !== "resolution"),
  );

  const payload = await request("bug", { params });
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

function assertBugId(id: number): void {
  if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid bug number.");
}

export async function getBug(id: number): Promise<BugDetail> {
  assertBugId(id);
  // Fetch all scalar fields so product-configured Details fields (including
  // custom Bugzilla fields) are available without a second round-trip.
  const [bugPayload, commentPayload, attachmentPayload] = await Promise.all([
    request(`bug/${id}`),
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
  const comments = allComments.slice(1).sort(
    (left, right) =>
      Date.parse(right.creationTime) - Date.parse(left.creationTime),
  );

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
    comments,
    attachments,
  };
}

const requiredFields: Record<string, string> = {
  summary: "Summary",
  status: "Status",
  assignedTo: "Assignee",
  component: "Component",
};

function bugzillaUpdateBody(id: number, update: BugUpdate): JsonRecord {
  const body: JsonRecord = { ids: [id] };
  const fields: [keyof BugUpdate, string][] = [
    ["summary", "summary"],
    ["status", "status"],
    ["resolution", "resolution"],
    ["priority", "priority"],
    ["severity", "severity"],
    ["assignedTo", "assigned_to"],
    ["component", "component"],
    ["version", "version"],
    ["platform", "platform"],
  ];

  for (const [key, field] of fields) {
    const value = update[key];
    if (typeof value !== "string") continue;
    const trimmed =
      key === "resolution" && value.trim() === "---" ? "" : value.trim();
    if (!trimmed && requiredFields[key]) {
      throw new Error(`${requiredFields[key]} cannot be empty.`);
    }
    body[field] = trimmed;
  }

  if (update.keywords !== undefined) {
    if (!Array.isArray(update.keywords)) throw new Error("Keywords must be a list.");
    body.keywords = {
      set: update.keywords.map((keyword) => {
        if (typeof keyword !== "string") throw new Error("Keywords must be text.");
        return keyword.trim();
      }).filter(Boolean),
    };
  }

  if (update.extraFields !== undefined) {
    if (
      typeof update.extraFields !== "object" ||
      update.extraFields === null ||
      Array.isArray(update.extraFields)
    ) {
      throw new Error("Custom fields must be a map of text values.");
    }
    for (const [key, value] of Object.entries(update.extraFields)) {
      if (typeof value !== "string") {
        throw new Error("Custom field values must be text.");
      }
      const field = bugzillaNameForKey(key);
      if (!field || field === "ids") {
        throw new Error(`Invalid custom field "${key}".`);
      }
      body[field] = value.trim();
    }
  }

  if (Object.keys(body).length === 1) throw new Error("There is nothing to update.");
  return body;
}

async function refreshBug(id: number, action: string): Promise<BugDetail> {
  try {
    return await getBug(id);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The bug could not be refreshed.";
    throw new Error(`${action}, but the bug could not be refreshed. ${message}`);
  }
}

export async function getProductDetailFields(
  product: string,
): Promise<DetailFieldOption[]> {
  const trimmed = product.trim();
  if (!trimmed) {
    throw new Error("Set the Bugzilla product name before loading fields.");
  }

  // Ensure a Bugzilla connection is configured before searching.
  await getConnection();

  const params = new URLSearchParams({
    product: trimmed,
    limit: "1",
    order: "changeddate DESC",
  });
  const payload = await request("bug", { params });
  const bugValue = Array.isArray(payload.bugs)
    ? (payload.bugs[0] as JsonRecord | undefined)
    : undefined;
  if (!bugValue) {
    throw new Error(
      `No bugs found for product "${trimmed}". Create one in Bugzilla, then try again.`,
    );
  }

  return catalogFromBugRecord(bugValue).map(({ key, label }) => ({ key, label }));
}

export async function updateBug(id: number, update: BugUpdate): Promise<BugDetail> {
  assertBugId(id);
  await request(`bug/${id}`, {
    method: "PUT",
    body: bugzillaUpdateBody(id, update),
  });
  return refreshBug(id, "Saved");
}

export async function addComment(
  id: number,
  draft: BugCommentDraft,
): Promise<BugDetail> {
  assertBugId(id);
  const text = draft.text.trim();
  if (!text) throw new Error("Comment cannot be empty.");
  if (text.length > 65_535) {
    throw new Error("Comment must be 65,535 characters or fewer.");
  }
  await request(`bug/${id}/comment`, {
    method: "POST",
    body: {
      comment: text,
      is_private: draft.isPrivate === true,
    },
  });
  return refreshBug(id, "Comment added");
}

function stripBase64(value: string): string {
  const trimmed = value.trim();
  const marker = "base64,";
  const index = trimmed.lastIndexOf(marker);
  const payload = index >= 0 ? trimmed.slice(index + marker.length) : trimmed;
  return payload.replace(/\s/g, "");
}

export async function addAttachment(
  id: number,
  draft: BugAttachmentDraft,
): Promise<BugDetail> {
  assertBugId(id);
  const fileName = draft.fileName.trim().replace(/^.*[/\\]/, "");
  if (!fileName) throw new Error("Attachment needs a file name.");
  if (fileName.length > 255) {
    throw new Error("Attachment file name must be 255 characters or fewer.");
  }

  const data = stripBase64(draft.data);
  if (!data) throw new Error("Attachment is empty.");
  if (Math.floor((data.length * 3) / 4) > MAX_ATTACHMENT_BYTES + 4) {
    throw new Error("Attachments must be 10 MB or smaller.");
  }
  if (data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    throw new Error("Attachment data must be base64.");
  }
  const bytes = Buffer.from(data, "base64").byteLength;
  if (bytes === 0) throw new Error("Attachment is empty.");
  if (bytes > MAX_ATTACHMENT_BYTES) {
    throw new Error("Attachments must be 10 MB or smaller.");
  }

  const summary = (draft.summary?.trim() || fileName).slice(0, 255);
  const comment = draft.comment?.trim() ?? "";
  const body: JsonRecord = {
    ids: [id],
    file_name: fileName,
    summary,
    content_type: draft.contentType.trim() || "application/octet-stream",
    data,
    is_private: draft.isPrivate === true,
  };
  if (comment) body.comment = comment;
  if (/\.(patch|diff)$/i.test(fileName)) body.is_patch = true;

  await request(`bug/${id}/attachment`, { method: "POST", body });
  return refreshBug(id, "Attachment uploaded");
}

export interface AttachmentFile {
  fileName: string;
  contentType: string;
  data: Buffer;
}

function sanitizeFileName(value: string, fallbackId: number): string {
  const cleaned = value
    .trim()
    .replace(/^.*[/\\]/, "")
    .replace(/[\u0000-\u001f<>:"|?*]/g, "_")
    .replace(/\.+$/g, "");
  return cleaned || `attachment-${fallbackId}`;
}

export async function getAttachmentFile(id: number): Promise<AttachmentFile> {
  if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid attachment.");

  const payload = await request(`bug/attachment/${id}`);
  const attachments = payload.attachments as JsonRecord | undefined;
  const attachment = attachments?.[String(id)] as JsonRecord | undefined;
  if (!attachment) throw new Error(`Attachment ${id} was not found.`);

  const data = stripBase64(text(attachment.data));
  if (!data) throw new Error("Attachment has no data.");
  if (data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    throw new Error("Attachment data from Bugzilla was invalid.");
  }

  return {
    fileName: sanitizeFileName(text(attachment.file_name), id),
    contentType: text(attachment.content_type) || "application/octet-stream",
    data: Buffer.from(data, "base64"),
  };
}
