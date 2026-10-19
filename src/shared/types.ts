export interface Project {
  id: string;
  name: string;
  product: string;
  description?: string;
  showClosedBugs?: boolean;
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
  creator: string;
  creationTime: string;
  lastChangeTime: string;
  description: string;
  keywords: string[];
  platform: string;
  version: string;
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
  updateBug(id: number, update: BugUpdate): Promise<BugDetail>;
  addComment(id: number, comment: BugCommentDraft): Promise<BugDetail>;
  addAttachment(id: number, attachment: BugAttachmentDraft): Promise<BugDetail>;
  openAttachment(id: number): Promise<void>;
}
