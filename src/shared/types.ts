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
  /** Ordered Board status columns. Defaults to the standard Bugzilla workflow. */
  boardStatuses?: string[];
  /** User-defined list/board filters for this product. */
  filters?: SavedFilter[];
}

export interface DetailFieldOption {
  key: string;
  label: string;
}

export interface AppSettings {
  baseUrl: string;
  projects: Project[];
  hasApiKey: boolean;
  keyStorage: "secure" | "plain" | "none";
}

export interface SettingsUpdate {
  baseUrl: string;
  projects: Project[];
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
  creationTime: string;
  isObsolete: boolean;
  isPrivate: boolean;
}

export interface BugDetail extends Bug {
  comments: BugComment[];
  attachments: BugAttachment[];
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
  /** Custom / uncommon Bugzilla fields keyed by app field key (e.g. cf_team). */
  extraFields?: Record<string, string>;
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
  getProductDetailFields(product: string): Promise<DetailFieldOption[]>;
  updateBug(id: number, update: BugUpdate): Promise<BugDetail>;
  addComment(id: number, comment: BugCommentDraft): Promise<BugDetail>;
  addAttachment(id: number, attachment: BugAttachmentDraft): Promise<BugDetail>;
  openAttachment(id: number): Promise<void>;
  readClipboardText(): Promise<string>;
}
