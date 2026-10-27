/** Bugzilla Custom Search / boolean-chart operator (`oN` query param). */
export type FilterOperator =
  | "equals"
  | "notequals"
  | "anyexact"
  | "substring"
  | "casesubstring"
  | "notsubstring"
  | "anywords"
  | "allwords"
  | "nowords"
  | "anywordssubstr"
  | "allwordssubstr"
  | "nowordssubstr"
  | "regexp"
  | "notregexp"
  | "lessthan"
  | "lessthaneq"
  | "greaterthan"
  | "greaterthaneq"
  | "isempty"
  | "isnotempty";

export interface FilterRule {
  /** App field key (e.g. status, assignedTo, cf_team). */
  field: string;
  /** Comparison operator; defaults to equals when omitted (legacy saved filters). */
  operator?: FilterOperator;
  /** Compared value; unused for isempty / isnotempty. */
  value: string;
}

export interface SavedFilter {
  id: string;
  /** Display name in the filter dropdown. */
  name: string;
  rules: FilterRule[];
}

export interface Project {
  id: string;
  name: string;
  product: string;
  description?: string;
  showClosedBugs?: boolean;
  /** Ordered Bug Details sidebar fields. Defaults to the built-in layout when omitted. */
  detailFields?: string[];
  /** Ordered Issues table columns. Defaults to the built-in layout when omitted. */
  listColumns?: string[];
  /**
   * Bug field used to group Board columns (select / combo / lookup with
   * defined values). Defaults to status.
   */
  boardGroupBy?: string;
  /**
   * Ordered Board column values for `boardGroupBy`. Defaults to the standard
   * Bugzilla status workflow when grouping by status.
   */
  boardStatuses?: string[];
  /** User-defined list/board filters for this product. */
  filters?: SavedFilter[];
}

/**
 * Bugzilla field types from `GET /rest/field/bug` (`type` integer),
 * mapped to stable app names for UI and updates.
 */
export type DetailFieldType =
  | "unknown"
  | "text"
  | "select"
  | "multiselect"
  | "textarea"
  | "datetime"
  | "bugid"
  | "seealso"
  | "keywords"
  | "date"
  | "integer";

export interface DetailFieldOption {
  key: string;
  label: string;
  /** Bugzilla field type; omitted when type is unknown. */
  type?: DetailFieldType;
  /** Legal values for select / multiselect fields (product-filtered when possible). */
  values?: string[];
}

export interface AppSettings {
  baseUrl: string;
  projects: Project[];
  /** Bugzilla login whose comments appear under the Integrations tab. */
  integrationUser: string;
  hasApiKey: boolean;
  keyStorage: "secure" | "plain" | "none";
}

export interface SettingsUpdate {
  baseUrl: string;
  projects: Project[];
  /** Omit to keep the saved value; an empty string clears it. */
  integrationUser?: string;
  apiKey?: string;
  clearApiKey?: boolean;
}

export interface BugSearch {
  projectId: string;
  query?: string;
  limit?: number;
  /** Field filters passed through to Bugzilla advanced search (fN/oN/vN). */
  filters?: FilterRule[];
}

export interface Bug {
  id: number;
  summary: string;
  status: string;
  resolution: string;
  product: string;
  component: string;
  priority: string;
  severity: string;
  assignedTo: string;
  assignedToName?: string;
  creator: string;
  creationTime: string;
  lastChangeTime: string;
  description: string;
  keywords: string[];
  platform: string;
  version: string;
  /** Additional Bugzilla fields (custom or uncommon) for the Details sidebar. */
  extraFields?: Record<string, string>;
}

export interface BugComment {
  id: number;
  creator: string;
  creatorName?: string;
  creationTime: string;
  text: string;
  isPrivate: boolean;
}

export interface BugAttachment {
  id: number;
  fileName: string;
  summary: string;
  contentType: string;
  size: number;
  creator: string;
  creatorName?: string;
  creationTime: string;
  isObsolete: boolean;
  isPrivate: boolean;
}

/** One field change within a Bugzilla history event. */
export interface BugHistoryChange {
  fieldName: string;
  removed: string;
  added: string;
  /** Present when the change was to an attachment. */
  attachmentId?: number;
}

/** One activity event from `GET /rest/bug/:id/history`. */
export interface BugHistoryEntry {
  when: string;
  who: string;
  whoName?: string;
  changes: BugHistoryChange[];
}

export interface LinkedBug {
  id: number;
  /** Empty when Bugzilla did not return the bug (e.g. no access). */
  summary: string;
  assignedTo: string;
  assignedToName?: string;
}

/** A user on a bug's CC (followers) list. */
export interface BugFollower {
  /** Bugzilla login name (used when adding/removing from CC). */
  name: string;
  realName?: string;
  email?: string;
}

/** The authenticated Bugzilla account for the configured API key. */
export interface BugzillaUser {
  id: number;
  /** Login name; also the value used in CC add/remove. */
  name: string;
  realName?: string;
  nick?: string;
}

export interface BugDetail extends Bug {
  comments: BugComment[];
  attachments: BugAttachment[];
  /** Field-change history from Bugzilla, newest first. */
  history: BugHistoryEntry[];
  /** Bugs listed in the Bugzilla `blocks` field. */
  blocks: LinkedBug[];
  /** Bugs listed in the Bugzilla `depends_on` field. */
  dependsOn: LinkedBug[];
  /** Users on the Bugzilla CC list (followers). */
  cc: BugFollower[];
}

export interface BugUpdate {
  summary?: string;
  status?: string;
  resolution?: string;
  priority?: string;
  severity?: string;
  assignedTo?: string;
  component?: string;
  version?: string;
  platform?: string;
  keywords?: string[];
  /**
   * Custom / uncommon Bugzilla fields keyed by app field key (e.g. cf_team).
   * Multiselect fields use a string array; others use a single string.
   */
  extraFields?: Record<string, string | string[]>;
  /** Add and/or remove login names on the Bugzilla CC list. */
  cc?: {
    add?: string[];
    remove?: string[];
  };
}

export interface BugCommentDraft {
  text: string;
  isPrivate?: boolean;
}

export interface BugAttachmentDraft {
  fileName: string;
  contentType: string;
  data: string;
  summary?: string;
  comment?: string;
  isPrivate?: boolean;
}

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export interface BugzilliApi {
  getSettings(): Promise<AppSettings>;
  saveSettings(update: SettingsUpdate): Promise<AppSettings>;
  searchBugs(search: BugSearch): Promise<Bug[]>;
  getBug(id: number): Promise<BugDetail>;
  /** Authenticated user for the configured API key (`GET /rest/whoami`). */
  getCurrentUser(): Promise<BugzillaUser>;
  getProductDetailFields(product: string): Promise<DetailFieldOption[]>;
  updateBug(id: number, update: BugUpdate): Promise<BugDetail>;
  addComment(id: number, comment: BugCommentDraft): Promise<BugDetail>;
  addAttachment(id: number, attachment: BugAttachmentDraft): Promise<BugDetail>;
  /** Downloads to the default downloads folder and opens with the system app. */
  openAttachment(id: number): Promise<void>;
  /** Prompts for a save location. */
  saveAttachment(id: number): Promise<void>;
  readClipboardText(): Promise<string>;
  writeClipboardText(text: string): Promise<void>;
}
