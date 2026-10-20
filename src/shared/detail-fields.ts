import type {
  Bug,
  BugUpdate,
  DetailFieldOption,
  DetailFieldType,
} from "./types.js";

/** Bugzilla `GET /rest/field/bug` field type integers. */
export const BUGZILLA_FIELD_TYPE = {
  unknown: 0,
  text: 1,
  select: 2,
  multiselect: 3,
  textarea: 4,
  datetime: 5,
  bugid: 6,
  seealso: 7,
  keywords: 8,
  date: 9,
  integer: 10,
} as const;

const FIELD_TYPE_BY_NUMBER: Record<number, DetailFieldType> = {
  [BUGZILLA_FIELD_TYPE.unknown]: "unknown",
  [BUGZILLA_FIELD_TYPE.text]: "text",
  [BUGZILLA_FIELD_TYPE.select]: "select",
  [BUGZILLA_FIELD_TYPE.multiselect]: "multiselect",
  [BUGZILLA_FIELD_TYPE.textarea]: "textarea",
  [BUGZILLA_FIELD_TYPE.datetime]: "datetime",
  [BUGZILLA_FIELD_TYPE.bugid]: "bugid",
  [BUGZILLA_FIELD_TYPE.seealso]: "seealso",
  [BUGZILLA_FIELD_TYPE.keywords]: "keywords",
  [BUGZILLA_FIELD_TYPE.date]: "date",
  [BUGZILLA_FIELD_TYPE.integer]: "integer",
};

export function detailFieldTypeFromBugzilla(type: unknown): DetailFieldType {
  if (typeof type !== "number") return "unknown";
  return FIELD_TYPE_BY_NUMBER[type] ?? "unknown";
}

/** Raw field object from `GET /rest/field/bug`. */
export interface BugzillaFieldApiRecord {
  name?: unknown;
  display_name?: unknown;
  type?: unknown;
  is_custom?: unknown;
  visibility_field?: unknown;
  visibility_values?: unknown;
  value_field?: unknown;
  values?: unknown;
}

/**
 * Core Bugzilla REST field names always requested/mapped onto first-class
 * `Bug` properties (rather than `extraFields`).
 */
export const baseBugFields = [
  "id",
  "summary",
  "status",
  "resolution",
  "product",
  "component",
  "priority",
  "severity",
  "assigned_to",
  "assigned_to_detail",
  "creator",
  "creation_time",
  "last_change_time",
  "keywords",
  "platform",
  "version",
] as const;

const baseBugFieldSet = new Set<string>(baseBugFields);

/** Fields shown in the Bug Details sidebar by default (current layout). */
export const DEFAULT_DETAIL_FIELDS = [
  "assignedTo",
  "creator",
  "priority",
  "severity",
  "component",
  "version",
  "platform",
  "creationTime",
  "lastChangeTime",
  "resolution",
  "keywords",
] as const;

export type KnownDetailField = (typeof DEFAULT_DETAIL_FIELDS)[number] | "status";

export interface DetailFieldDefinition {
  /** Stable key stored in project settings and used in the UI. */
  key: string;
  label: string;
  /** Bugzilla REST field name when different from `key`. */
  bugzilla?: string;
  /** When set, the field can be edited through BugUpdate. */
  editable?: keyof BugUpdate;
  /** Format used when rendering the value. */
  format?: "text" | "date" | "keywords" | "resolution";
}

const KNOWN_FIELDS: DetailFieldDefinition[] = [
  {
    key: "status",
    label: "Status",
    bugzilla: "status",
    editable: "status",
  },
  {
    key: "assignedTo",
    label: "Assignee",
    bugzilla: "assigned_to",
    editable: "assignedTo",
  },
  {
    key: "creator",
    label: "Reporter",
    bugzilla: "creator",
  },
  {
    key: "priority",
    label: "Priority",
    bugzilla: "priority",
    editable: "priority",
  },
  {
    key: "severity",
    label: "Severity",
    bugzilla: "severity",
    editable: "severity",
  },
  {
    key: "component",
    label: "Component",
    bugzilla: "component",
    editable: "component",
  },
  {
    key: "version",
    label: "Version",
    bugzilla: "version",
    editable: "version",
  },
  {
    key: "platform",
    label: "Platform",
    bugzilla: "platform",
    editable: "platform",
  },
  {
    key: "creationTime",
    label: "Created",
    bugzilla: "creation_time",
    format: "date",
  },
  {
    key: "lastChangeTime",
    label: "Updated",
    bugzilla: "last_change_time",
    format: "date",
  },
  {
    key: "resolution",
    label: "Resolution",
    bugzilla: "resolution",
    editable: "resolution",
    format: "resolution",
  },
  {
    key: "keywords",
    label: "Keywords",
    bugzilla: "keywords",
    editable: "keywords",
    format: "keywords",
  },
  {
    key: "qaContact",
    label: "QA contact",
    bugzilla: "qa_contact",
  },
  {
    key: "url",
    label: "URL",
    bugzilla: "url",
  },
  {
    key: "whiteboard",
    label: "Whiteboard",
    bugzilla: "whiteboard",
  },
  {
    key: "opSys",
    label: "OS",
    bugzilla: "op_sys",
  },
  {
    key: "alias",
    label: "Alias",
    bugzilla: "alias",
  },
  {
    key: "targetMilestone",
    label: "Target milestone",
    bugzilla: "target_milestone",
  },
  {
    key: "deadline",
    label: "Deadline",
    bugzilla: "deadline",
  },
  {
    key: "classification",
    label: "Classification",
    bugzilla: "classification",
  },
];

const knownByKey = new Map(KNOWN_FIELDS.map((field) => [field.key, field]));
const knownByBugzilla = new Map(
  KNOWN_FIELDS.map((field) => [field.bugzilla ?? field.key, field]),
);

/** Bugzilla / internal fields that should not appear in the Details picker. */
const EXCLUDED_BUGZILLA_FIELDS = new Set([
  "id",
  "summary",
  "product",
  "description",
  "is_open",
  "is_cc_accessible",
  "is_creator_accessible",
  "is_confirmed",
  "cc",
  "cc_detail",
  "assigned_to_detail",
  "creator_detail",
  "qa_contact_detail",
  "flags",
  "groups",
  "depends_on",
  "blocks",
  "dupe_of",
  "duplicates",
  "see_also",
  "regressed_by",
  "regressions",
  "comment_count",
  "votes",
  "remaining_time",
  "estimated_time",
  "actual_time",
  "work_time",
  "percentage_complete",
  "type",
]);

export function defaultDetailFields(): string[] {
  return [...DEFAULT_DETAIL_FIELDS];
}

export function resolveDetailFields(fields: string[] | undefined): string[] {
  if (!fields || fields.length === 0) return defaultDetailFields();
  const seen = new Set<string>();
  const resolved: string[] = [];
  for (const field of fields) {
    const key = field.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    resolved.push(key);
  }
  return resolved.length > 0 ? resolved : defaultDetailFields();
}

export function detailFieldDefinition(key: string): DetailFieldDefinition {
  const known = knownByKey.get(key);
  if (known) return known;
  return {
    key,
    label: humanizeFieldKey(key),
  };
}

export function bugzillaNameForKey(key: string): string {
  return detailFieldDefinition(key).bugzilla ?? key;
}

/**
 * Bugzilla Custom Search / boolean-chart field names (`fN`) that differ from
 * REST `include_fields` / simple search parameter names.
 */
const CHART_FIELD_BY_BUGZILLA: Record<string, string> = {
  status: "bug_status",
  summary: "short_desc",
  creator: "reporter",
  creation_time: "creation_ts",
  last_change_time: "delta_ts",
  severity: "bug_severity",
  platform: "rep_platform",
  url: "bug_file_loc",
  whiteboard: "status_whiteboard",
};

/** Field name to use in Bugzilla advanced search `fN` parameters. */
export function bugzillaChartNameForKey(key: string): string {
  const bugzilla = bugzillaNameForKey(key);
  return CHART_FIELD_BY_BUGZILLA[bugzilla] ?? bugzilla;
}

/** Invert chart / field-API names (e.g. bug_status) back to REST names (status). */
const REST_NAME_BY_FIELD_API = new Map(
  Object.entries(CHART_FIELD_BY_BUGZILLA).map(([rest, api]) => [api, rest]),
);

export function keyForBugzillaField(bugzillaName: string): string {
  const known = knownByBugzilla.get(bugzillaName);
  if (known) return known.key;

  // `/rest/field/bug` and advanced search use chart names for some fields
  // (bug_status, bug_severity, rep_platform, …) that differ from REST bug keys.
  const restName = REST_NAME_BY_FIELD_API.get(bugzillaName);
  if (restName) {
    return knownByBugzilla.get(restName)?.key ?? restName;
  }

  return bugzillaName;
}

function humanizeFieldKey(key: string): string {
  const withoutPrefix = key.replace(/^cf_/, "").replace(/^custom_/, "");
  return withoutPrefix
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isDisplayableValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(
      (item) =>
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean",
    );
  }
  return false;
}

export function catalogFromBugRecord(
  bug: Record<string, unknown>,
): DetailFieldDefinition[] {
  const catalog = new Map<string, DetailFieldDefinition>();

  for (const field of KNOWN_FIELDS) {
    catalog.set(field.key, field);
  }

  for (const [name, value] of Object.entries(bug)) {
    if (EXCLUDED_BUGZILLA_FIELDS.has(name)) continue;
    if (!isDisplayableValue(value)) continue;
    const key = keyForBugzillaField(name);
    if (!catalog.has(key)) {
      catalog.set(key, {
        key,
        label: humanizeFieldKey(key),
        ...(name === key ? {} : { bugzilla: name }),
      });
    }
  }

  return orderCatalogKeys([...catalog.keys()]).map((key) => catalog.get(key)!).filter(Boolean);
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function fieldVisibleForProduct(
  field: BugzillaFieldApiRecord,
  product: string,
): boolean {
  const visibilityField =
    typeof field.visibility_field === "string" ? field.visibility_field : "";
  if (!visibilityField) return true;
  if (visibilityField !== "product") return true;
  return stringList(field.visibility_values).includes(product);
}

function valuesForProduct(
  field: BugzillaFieldApiRecord,
  product: string,
): string[] {
  if (!Array.isArray(field.values)) return [];
  const valueField =
    typeof field.value_field === "string" ? field.value_field : "";

  const entries: { name: string; sortKey: number }[] = [];
  for (const raw of field.values) {
    if (!raw || typeof raw !== "object") continue;
    const value = raw as Record<string, unknown>;
    const name = typeof value.name === "string" ? value.name : "";
    if (!name) continue;
    if (value.is_active === false) continue;
    if (
      valueField === "product" &&
      !stringList(value.visibility_values).includes(product)
    ) {
      continue;
    }
    const sortKey =
      typeof value.sort_key === "number"
        ? value.sort_key
        : typeof value.sortkey === "number"
          ? value.sortkey
          : 0;
    entries.push({ name, sortKey });
  }

  entries.sort(
    (left, right) =>
      left.sortKey - right.sortKey || left.name.localeCompare(right.name),
  );
  return entries.map(({ name }) => name);
}

function orderCatalogKeys(keys: string[]): string[] {
  const preferred = defaultDetailFields();
  const preferredSet = new Set(preferred);
  const rest = keys
    .filter((key) => !preferredSet.has(key) && key !== "status")
    .sort((a, b) =>
      detailFieldDefinition(a).label.localeCompare(detailFieldDefinition(b).label),
    );
  const ordered = ["status", ...preferred, ...rest];
  const keySet = new Set(keys);
  return ordered.filter((key) => keySet.has(key));
}

/**
 * Build the Details / filter field catalog from `GET /rest/field/bug`,
 * filtered to fields (and legal values) that apply to `product`.
 */
export function catalogFromFieldApi(
  fields: BugzillaFieldApiRecord[],
  product: string,
): DetailFieldOption[] {
  const trimmedProduct = product.trim();
  const catalog = new Map<string, DetailFieldOption>();

  for (const known of KNOWN_FIELDS) {
    catalog.set(known.key, { key: known.key, label: known.label });
  }

  for (const field of fields) {
    const name = typeof field.name === "string" ? field.name.trim() : "";
    if (!name || EXCLUDED_BUGZILLA_FIELDS.has(name)) continue;
    if (!fieldVisibleForProduct(field, trimmedProduct)) continue;

    const key = keyForBugzillaField(name);
    // Chart / field-API aliases (e.g. short_desc → summary) must still be excluded.
    if (
      EXCLUDED_BUGZILLA_FIELDS.has(key) ||
      EXCLUDED_BUGZILLA_FIELDS.has(bugzillaNameForKey(key))
    ) {
      continue;
    }
    const known = knownByKey.get(key);
    const displayName =
      typeof field.display_name === "string" ? field.display_name.trim() : "";
    const type = detailFieldTypeFromBugzilla(field.type);
    const values = valuesForProduct(field, trimmedProduct);
    const option: DetailFieldOption = {
      key,
      label: known?.label || displayName || humanizeFieldKey(key),
      type,
      ...(values.length > 0 ? { values } : {}),
    };
    catalog.set(key, option);
  }

  return orderCatalogKeys([...catalog.keys()])
    .map((key) => catalog.get(key)!)
    .filter(Boolean);
}

/** True when the field is stored on `Bug.extraFields` rather than a first-class property. */
export function isExtraDetailField(key: string): boolean {
  return !baseBugFieldSet.has(bugzillaNameForKey(key));
}

export function readBugFieldValue(bug: Bug, key: string): unknown {
  switch (key) {
    case "id":
      return bug.id;
    case "summary":
      return bug.summary;
    case "status":
      return bug.status;
    case "assignedTo":
      return bug.assignedTo;
    case "creator":
      return bug.creator;
    case "priority":
      return bug.priority;
    case "severity":
      return bug.severity;
    case "component":
      return bug.component;
    case "version":
      return bug.version;
    case "platform":
      return bug.platform;
    case "creationTime":
      return bug.creationTime;
    case "lastChangeTime":
      return bug.lastChangeTime;
    case "resolution":
      return bug.resolution;
    case "keywords":
      return bug.keywords;
    default:
      return bug.extraFields?.[key];
  }
}

export function formatExtraFieldValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
