import { app, safeStorage } from "electron";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  cleanBoardColumns,
  resolveBoardGroupBy,
} from "../shared/board-statuses.js";
import { cleanSavedFilters } from "../shared/list-filters.js";
import type { AppSettings, Project, SettingsUpdate } from "../shared/types.js";

interface StoredSettings {
  baseUrl: string;
  projects: Project[];
  userEmail?: string;
  integrationUser?: string;
  apiKey?: string;
  keyStorage?: "secure" | "plain";
}

const defaults: StoredSettings = {
  baseUrl: "",
  projects: [],
};

function settingsPath(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

function cleanBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";

  const url = new URL(trimmed);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Bugzilla URL must use HTTP or HTTPS.");
  }
  return url.toString().replace(/\/$/, "");
}

function cleanFieldKeys(fields: string[] | undefined): string[] | undefined {
  if (!fields) return undefined;
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const field of fields) {
    if (typeof field !== "string") continue;
    const key = field.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(key);
  }
  return cleaned.length > 0 ? cleaned : undefined;
}

function cleanProjects(projects: Project[]): Project[] {
  return projects.map((project) => {
    const name = project.name.trim();
    const product = project.product.trim();
    if (!project.id || !name || !product) {
      throw new Error("Every project needs a name and Bugzilla product.");
    }
    const detailFields = cleanFieldKeys(project.detailFields);
    const listColumns = cleanFieldKeys(project.listColumns);
    const linkedColumns = cleanFieldKeys(project.linkedColumns);
    const boardGroupBy =
      typeof project.boardGroupBy === "string"
        ? project.boardGroupBy.trim()
        : "";
    const hasBoardColumns = Array.isArray(project.boardColumns);
    const boardColumns = hasBoardColumns
      ? cleanBoardColumns(project.boardColumns, resolveBoardGroupBy(boardGroupBy))
      : undefined;
    const boardStatuses = hasBoardColumns
      ? undefined
      : cleanFieldKeys(project.boardStatuses);
    const filters = cleanSavedFilters(project.filters);
    return {
      id: project.id,
      name,
      product,
      ...(project.description?.trim()
        ? { description: project.description.trim() }
        : {}),
      ...(project.showClosedBugs ? { showClosedBugs: true } : {}),
      ...(detailFields ? { detailFields } : {}),
      ...(listColumns ? { listColumns } : {}),
      ...(linkedColumns ? { linkedColumns } : {}),
      ...(boardGroupBy && boardGroupBy !== "status"
        ? { boardGroupBy }
        : {}),
      ...(hasBoardColumns ? { boardColumns: boardColumns ?? [] } : {}),
      ...(boardStatuses ? { boardStatuses } : {}),
      ...(filters ? { filters } : {}),
    };
  });
}

async function readStoredSettings(): Promise<StoredSettings> {
  try {
    const value = JSON.parse(await readFile(settingsPath(), "utf8")) as StoredSettings;
    return {
      baseUrl: typeof value.baseUrl === "string" ? value.baseUrl : "",
      projects: Array.isArray(value.projects) ? value.projects : [],
      ...(typeof value.userEmail === "string" && value.userEmail.trim()
        ? { userEmail: value.userEmail.trim() }
        : {}),
      ...(typeof value.integrationUser === "string" && value.integrationUser.trim()
        ? { integrationUser: value.integrationUser.trim() }
        : {}),
      ...(typeof value.apiKey === "string" ? { apiKey: value.apiKey } : {}),
      ...(value.keyStorage === "secure" || value.keyStorage === "plain"
        ? { keyStorage: value.keyStorage }
        : {}),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return defaults;
  }
}

function decryptKey(stored: StoredSettings): string {
  if (!stored.apiKey) return "";
  if (stored.keyStorage === "secure") {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("The system credential store is unavailable.");
    }
    return safeStorage.decryptString(Buffer.from(stored.apiKey, "base64"));
  }
  return Buffer.from(stored.apiKey, "base64").toString("utf8");
}

function publicSettings(stored: StoredSettings): AppSettings {
  return {
    baseUrl: stored.baseUrl,
    projects: stored.projects,
    userEmail: stored.userEmail ?? "",
    integrationUser: stored.integrationUser ?? "",
    hasApiKey: Boolean(stored.apiKey),
    keyStorage: stored.apiKey ? (stored.keyStorage ?? "plain") : "none",
  };
}

export async function getSettings(): Promise<AppSettings> {
  return publicSettings(await readStoredSettings());
}

export async function getConnection(): Promise<{
  baseUrl: string;
  apiKey: string;
  userEmail: string;
  projects: Project[];
}> {
  const stored = await readStoredSettings();
  if (!stored.baseUrl) throw new Error("Set your Bugzilla URL in Settings.");
  return {
    baseUrl: stored.baseUrl,
    apiKey: decryptKey(stored),
    userEmail: stored.userEmail ?? "",
    projects: stored.projects,
  };
}

export async function saveSettings(update: SettingsUpdate): Promise<AppSettings> {
  const current = await readStoredSettings();
  const next: StoredSettings = {
    baseUrl: cleanBaseUrl(update.baseUrl),
    projects: cleanProjects(update.projects),
  };
  const integrationUser =
    typeof update.integrationUser === "string"
      ? update.integrationUser.trim()
      : (current.integrationUser ?? "");
  if (integrationUser) next.integrationUser = integrationUser;

  const userEmail =
    typeof update.userEmail === "string"
      ? update.userEmail.trim()
      : (current.userEmail ?? "");
  if (userEmail) next.userEmail = userEmail;

  if (!update.clearApiKey && update.apiKey === undefined && current.apiKey) {
    next.apiKey = current.apiKey;
    next.keyStorage = current.keyStorage ?? "plain";
  } else if (!update.clearApiKey && update.apiKey?.trim()) {
    const key = update.apiKey.trim();
    if (safeStorage.isEncryptionAvailable()) {
      next.apiKey = safeStorage.encryptString(key).toString("base64");
      next.keyStorage = "secure";
    } else {
      next.apiKey = Buffer.from(key, "utf8").toString("base64");
      next.keyStorage = "plain";
    }
  }

  await writeFile(settingsPath(), JSON.stringify(next, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  return publicSettings(next);
}
