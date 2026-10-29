import { parseBugId } from "../shared/bugId.js";
import {
  baseBugFields,
  bugzillaNameForKey,
  catalogFromFieldApi,
  keyForBugzillaField,
  type BugzillaFieldApiRecord,
} from "../shared/detail-fields.js";
import {
  appendFilterParams,
  cleanFilterRules,
  isOpenResolutionRule,
} from "../shared/list-filters.js";
import {
  defaultLinkedColumns,
  resolveLinkedColumns,
} from "../shared/linked-columns.js";
import { resolveListColumns } from "../shared/list-columns.js";
import {
  MAX_ATTACHMENT_BYTES,
  type Bug,
  type BugAttachment,
  type BugAttachmentDraft,
  type BugComment,
  type BugCommentDraft,
  type BugDetail,
  type BugFollower,
  type BugHistoryChange,
  type BugHistoryEntry,
  type BugzillaUser,
  type DetailFieldOption,
  type LinkedBug,
  type BugSearch,
  type BugUpdate,
  type Project,
} from "../shared/types.js";
import { readCachedBug, writeCachedBug } from "./bug-cache.js";
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

/** REST include_fields for linked bug rows, driven by project column settings. */
function includeFieldsForLinkedBugs(
  product: string,
  projects: Project[],
): string {
  const fields = new Set<string>(["id"]);
  const matching = projects.filter(
    (project) => project.product.trim() === product.trim(),
  );
  const columnSets =
    matching.length > 0
      ? matching.map((project) => resolveLinkedColumns(project.linkedColumns))
      : [defaultLinkedColumns()];
  for (const columns of columnSets) {
    for (const key of columns) {
      fields.add(bugzillaNameForKey(key));
    }
  }
  if (fields.has("assigned_to")) fields.add("assigned_to_detail");
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

async function getCreatorNames(
  creators: string[],
): Promise<Map<string, string>> {
  const uniqueCreators = [...new Set(creators.filter(Boolean))];
  if (uniqueCreators.length === 0) return new Map();

  const params = new URLSearchParams();
  for (const creator of uniqueCreators) params.append("names", creator);
  const payload = await request("user", { params });
  const names = new Map<string, string>();
  if (!Array.isArray(payload.users)) return names;

  for (const value of payload.users) {
    const user = value as JsonRecord;
    const realName = text(user.real_name).trim();
    if (!realName) continue;
    for (const login of [text(user.name), text(user.email)]) {
      if (login) names.set(login.toLowerCase(), realName);
    }
  }
  return names;
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

function mapHistoryChange(value: JsonRecord): BugHistoryChange {
  const attachmentId = number(value.attachment_id);
  return {
    fieldName: text(value.field_name),
    removed: text(value.removed),
    added: text(value.added),
    ...(attachmentId > 0 ? { attachmentId } : {}),
  };
}

function mapHistoryEntry(value: JsonRecord): BugHistoryEntry {
  const changes = Array.isArray(value.changes)
    ? value.changes.map((change) => mapHistoryChange(change as JsonRecord))
    : [];
  return {
    when: text(value.when),
    who: text(value.who),
    changes,
  };
}

function bugIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const ids = value.map(number).filter((id) => Number.isInteger(id) && id > 0);
  return [...new Set(ids)];
}

async function getLinkedBugs(
  ids: number[],
  product: string,
): Promise<Map<number, LinkedBug>> {
  const linked = new Map<number, LinkedBug>();
  if (ids.length === 0) return linked;

  const { projects } = await getConnection();
  const params = new URLSearchParams({
    include_fields: includeFieldsForLinkedBugs(product, projects),
  });
  for (const id of ids) params.append("id", String(id));
  try {
    const payload = await request("bug", { params });
    if (!Array.isArray(payload.bugs)) return linked;
    for (const value of payload.bugs) {
      const bug = mapBug(value as JsonRecord);
      linked.set(bug.id, toLinkedBug(bug));
    }
  } catch {
    // Linked bug details are best-effort; the IDs are still shown.
  }
  return linked;
}

function emptyLinkedBug(id: number): LinkedBug {
  return {
    id,
    summary: "",
    status: "",
    resolution: "",
    product: "",
    component: "",
    priority: "",
    severity: "",
    assignedTo: "",
    creator: "",
    creationTime: "",
    lastChangeTime: "",
    keywords: [],
    platform: "",
    version: "",
  };
}

function linkedBugsFor(ids: number[], linked: Map<number, LinkedBug>): LinkedBug[] {
  return ids.map((id) => linked.get(id) ?? emptyLinkedBug(id));
}

function mapFollower(value: JsonRecord): BugFollower | undefined {
  const name = text(value.name) || text(value.email);
  if (!name) return undefined;
  const id = number(value.id);
  const realName = text(value.real_name).trim();
  const email = text(value.email).trim();
  return {
    ...(id ? { id } : {}),
    name,
    ...(realName ? { realName } : {}),
    ...(email && email !== name ? { email } : {}),
  };
}

function mapCc(bugValue: JsonRecord): BugFollower[] {
  if (Array.isArray(bugValue.cc_detail)) {
    const fromDetail = bugValue.cc_detail
      .map((entry) =>
        entry && typeof entry === "object"
          ? mapFollower(entry as JsonRecord)
          : undefined,
      )
      .filter((follower): follower is BugFollower => Boolean(follower));
    if (fromDetail.length > 0) return fromDetail;
  }
  if (!Array.isArray(bugValue.cc)) return [];
  return bugValue.cc
    .map((entry) => {
      if (typeof entry === "string" && entry.trim()) {
        return { name: entry.trim() };
      }
      if (entry && typeof entry === "object") {
        return mapFollower(entry as JsonRecord);
      }
      return undefined;
    })
    .filter((follower): follower is BugFollower => Boolean(follower));
}

function assertBugId(id: number): void {
  if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid bug number.");
}

export async function getCurrentUser(): Promise<BugzillaUser> {
  const { userEmail } = await getConnection();
  const email = userEmail.trim();
  if (!email) {
    throw new Error("Set your User Email Address in App Settings.");
  }
  return {
    id: 0,
    name: email,
    email,
  };
}

function sameChangeTime(cached: string, remote: string): boolean {
  if (cached === remote) return true;
  const cachedMs = Date.parse(cached);
  const remoteMs = Date.parse(remote);
  return Number.isFinite(cachedMs) && cachedMs === remoteMs;
}

/** Lightweight check used to decide whether a stored bug detail is still current. */
async function readRemoteChangeTime(id: number): Promise<string | undefined> {
  try {
    const params = new URLSearchParams({ include_fields: "last_change_time" });
    const payload = await request(`bug/${id}`, { params });
    const bugValue = Array.isArray(payload.bugs)
      ? (payload.bugs[0] as JsonRecord | undefined)
      : undefined;
    if (!bugValue) return undefined;
    const changed = text(bugValue.last_change_time);
    return changed || undefined;
  } catch {
    return undefined;
  }
}

export async function getBug(
  id: number,
  options?: { bypassCache: boolean },
): Promise<BugDetail> {
  assertBugId(id);
  const { baseUrl } = await getConnection();
  if (options?.bypassCache !== true) {
    const cached = await readCachedBug(baseUrl, id);
    if (cached?.lastChangeTime) {
      const remoteChangeTime = await readRemoteChangeTime(id);
      if (remoteChangeTime && sameChangeTime(cached.lastChangeTime, remoteChangeTime)) {
        return cached;
      }
    }
  }

  const detail = await loadBugDetail(id);
  try {
    await writeCachedBug(baseUrl, detail);
  } catch (error) {
    console.error(`Could not store bug ${id} locally.`, error);
  }
  return detail;
}

async function loadBugDetail(id: number): Promise<BugDetail> {
  // Fetch all scalar fields so product-configured Details fields (including
  // custom Bugzilla fields) are available without a second round-trip.
  const [bugPayload, commentPayload, attachmentPayload, historyPayload] =
    await Promise.all([
      request(`bug/${id}`),
      request(`bug/${id}/comment`),
      request(`bug/${id}/attachment`),
      request(`bug/${id}/history`),
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
  const visibleComments = allComments.slice(1);
  const attachmentBugs = attachmentPayload.bugs as JsonRecord | undefined;
  const attachmentValues = attachmentBugs?.[String(id)];
  const mappedAttachments = Array.isArray(attachmentValues)
    ? attachmentValues.map((attachment) =>
        mapAttachment(attachment as JsonRecord),
      )
    : [];
  const historyBugs = Array.isArray(historyPayload.bugs)
    ? historyPayload.bugs
    : [];
  const historyContainer = historyBugs.find(
    (entry) => number((entry as JsonRecord).id) === id,
  ) as JsonRecord | undefined;
  const mappedHistory = Array.isArray(historyContainer?.history)
    ? historyContainer.history.map((entry) =>
        mapHistoryEntry(entry as JsonRecord),
      )
    : [];
  const blockIds = bugIds(bugValue.blocks);
  const dependsOnIds = bugIds(bugValue.depends_on);
  const product = text(bugValue.product);
  const [creatorNames, linkedBugs] = await Promise.all([
    getCreatorNames([
      ...visibleComments.map(({ creator }) => creator),
      ...mappedAttachments.map(({ creator }) => creator),
      ...mappedHistory.map(({ who }) => who),
    ]),
    getLinkedBugs([...new Set([...blockIds, ...dependsOnIds])], product),
  ]);
  const comments = visibleComments
    .map((comment) => {
      const creatorName = creatorNames.get(comment.creator.toLowerCase());
      return creatorName ? { ...comment, creatorName } : comment;
    })
    .sort(
      (left, right) =>
        Date.parse(right.creationTime) - Date.parse(left.creationTime),
    );

  const attachments = mappedAttachments
    .map((attachment) => {
      const creatorName = creatorNames.get(attachment.creator.toLowerCase());
      return creatorName ? { ...attachment, creatorName } : attachment;
    })
    .sort(
      (left, right) =>
        Date.parse(right.creationTime) - Date.parse(left.creationTime),
    );

  const history = mappedHistory
    .map((entry) => {
      const whoName = creatorNames.get(entry.who.toLowerCase());
      return whoName ? { ...entry, whoName } : entry;
    })
    .sort((left, right) => Date.parse(right.when) - Date.parse(left.when));

  const bug = mapBug(bugValue);
  return {
    ...bug,
    description: allComments[0]?.text ?? "",
    comments,
    attachments,
    history,
    blocks: linkedBugsFor(blockIds, linkedBugs),
    dependsOn: linkedBugsFor(dependsOnIds, linkedBugs),
    cc: mapCc(bugValue),
  };
}

const requiredFields: Record<string, string> = {
  summary: "Summary",
  status: "Status",
  assignedTo: "Assignee",
  component: "Component",
};

function linkedBugIdChange(
  change: { add?: number[]; remove?: number[] } | undefined,
  fieldLabel: string,
): JsonRecord | undefined {
  if (change === undefined) return undefined;
  if (
    typeof change !== "object" ||
    change === null ||
    Array.isArray(change)
  ) {
    throw new Error(
      `${fieldLabel} changes must be an object with add/remove lists.`,
    );
  }
  const result: JsonRecord = {};
  for (const key of ["add", "remove"] as const) {
    const list = change[key];
    if (list === undefined) continue;
    if (!Array.isArray(list)) {
      throw new Error(`${fieldLabel} ${key} must be a list of bug IDs.`);
    }
    const ids = list.map((entry) => {
      if (!Number.isInteger(entry) || entry <= 0) {
        throw new Error(`${fieldLabel} ${key} entries must be bug IDs.`);
      }
      return entry;
    });
    if (ids.length > 0) result[key] = [...new Set(ids)];
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function toLinkedBug(bug: Bug): LinkedBug {
  return {
    id: bug.id,
    summary: bug.summary,
    status: bug.status,
    resolution: bug.resolution,
    product: bug.product,
    component: bug.component,
    priority: bug.priority,
    severity: bug.severity,
    assignedTo: bug.assignedTo,
    ...(bug.assignedToName ? { assignedToName: bug.assignedToName } : {}),
    creator: bug.creator,
    creationTime: bug.creationTime,
    lastChangeTime: bug.lastChangeTime,
    keywords: bug.keywords,
    platform: bug.platform,
    version: bug.version,
    ...(bug.extraFields ? { extraFields: bug.extraFields } : {}),
  };
}

/** Search bugs by numeric id or summary/quicksearch for the link picker. */
export async function searchLinkableBugs(query: string): Promise<LinkedBug[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  await getConnection();

  const params = new URLSearchParams({
    include_fields: "id,summary,assigned_to,assigned_to_detail",
    limit: "20",
    order: "changeddate DESC",
  });
  const bugId = parseBugId(trimmed);
  if (bugId !== undefined) {
    params.append("id", String(bugId));
  } else {
    params.set("quicksearch", trimmed);
  }

  const payload = await request("bug", { params });
  if (!Array.isArray(payload.bugs)) return [];
  return payload.bugs.map((value) => toLinkedBug(mapBug(value as JsonRecord)));
}

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

  if (update.cc !== undefined) {
    if (
      typeof update.cc !== "object" ||
      update.cc === null ||
      Array.isArray(update.cc)
    ) {
      throw new Error("CC changes must be an object with add/remove lists.");
    }
    const cc: JsonRecord = {};
    for (const key of ["add", "remove"] as const) {
      const list = update.cc[key];
      if (list === undefined) continue;
      if (!Array.isArray(list)) {
        throw new Error(`CC ${key} must be a list of login names.`);
      }
      const names = list.map((entry) => {
        if (typeof entry !== "string") {
          throw new Error(`CC ${key} entries must be login names.`);
        }
        return entry.trim();
      }).filter(Boolean);
      if (names.length > 0) cc[key] = names;
    }
    if (Object.keys(cc).length > 0) body.cc = cc;
  }

  const blocksChange = linkedBugIdChange(update.blocks, "blocks");
  if (blocksChange) body.blocks = blocksChange;
  const dependsOnChange = linkedBugIdChange(update.dependsOn, "depends_on");
  if (dependsOnChange) body.depends_on = dependsOnChange;

  if (update.extraFields !== undefined) {
    if (
      typeof update.extraFields !== "object" ||
      update.extraFields === null ||
      Array.isArray(update.extraFields)
    ) {
      throw new Error("Custom fields must be a map of text values.");
    }
    for (const [key, value] of Object.entries(update.extraFields)) {
      const field = bugzillaNameForKey(key);
      if (!field || field === "ids") {
        throw new Error(`Invalid custom field "${key}".`);
      }
      if (Array.isArray(value)) {
        body[field] = value.map((entry) => {
          if (typeof entry !== "string") {
            throw new Error("Custom field list values must be text.");
          }
          return entry.trim();
        }).filter(Boolean);
        continue;
      }
      if (typeof value !== "string") {
        throw new Error("Custom field values must be text.");
      }
      body[field] = value.trim();
    }
  }

  if (Object.keys(body).length === 1) throw new Error("There is nothing to update.");
  return body;
}

async function refreshBug(id: number, action: string): Promise<BugDetail> {
  try {
    // The mutation just changed the bug, so skip the timestamp check and
    // replace the stored copy with a full fetch.
    return await getBug(id, { bypassCache: true });
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

  // Ensure a Bugzilla connection is configured before fetching fields.
  await getConnection();

  const payload = await request("field/bug");
  const fields = Array.isArray(payload.fields)
    ? (payload.fields as BugzillaFieldApiRecord[])
    : [];
  if (fields.length === 0) {
    throw new Error("Bugzilla returned no bug fields.");
  }

  return catalogFromFieldApi(fields, trimmed);
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
