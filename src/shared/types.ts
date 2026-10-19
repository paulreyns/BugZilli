export interface Project {
  id: string;
  name: string;
  product: string;
  description?: string;
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

export interface BugzilliApi {
  getSettings(): Promise<AppSettings>;
  saveSettings(update: SettingsUpdate): Promise<AppSettings>;
  searchBugs(search: BugSearch): Promise<Bug[]>;
  getBug(id: number): Promise<BugDetail>;
  openAttachment(id: number): Promise<void>;
}
