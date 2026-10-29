import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BugDetail } from "../shared/types.js";

/** Newest bugs are kept; older files are removed after this many per instance. */
const MAX_CACHED_BUGS = 200;

const stringFields = [
  "summary",
  "status",
  "resolution",
  "product",
  "component",
  "priority",
  "severity",
  "assignedTo",
  "creator",
  "creationTime",
  "lastChangeTime",
  "description",
  "platform",
  "version",
] as const;

interface StoredBug {
  baseUrl: string;
  savedAt: number;
  bug: BugDetail;
}

let cacheDirectory: string | undefined;
const memory = new Map<string, BugDetail>();
let lastSavedAt = 0;

export function setBugCacheDirectory(directory: string | undefined): void {
  cacheDirectory = directory;
  memory.clear();
  lastSavedAt = 0;
}

function cacheKey(baseUrl: string, id: number): string {
  return `${baseUrl}\0${id}`;
}

function instanceDirectory(baseUrl: string): string | undefined {
  if (!cacheDirectory) return undefined;
  const hash = createHash("sha256").update(baseUrl).digest("hex");
  return path.join(cacheDirectory, hash);
}

function bugFile(baseUrl: string, id: number): string | undefined {
  const directory = instanceDirectory(baseUrl);
  if (!directory) return undefined;
  return path.join(directory, `${id}.json`);
}

function remember(baseUrl: string, bug: BugDetail): void {
  const key = cacheKey(baseUrl, bug.id);
  if (memory.has(key)) memory.delete(key);
  memory.set(key, bug);
  while (memory.size > MAX_CACHED_BUGS) {
    const oldest = memory.keys().next().value;
    if (oldest === undefined) break;
    memory.delete(oldest);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBugDetail(value: unknown, id: number): value is BugDetail {
  if (!isRecord(value) || value.id !== id) return false;
  for (const field of stringFields) {
    if (typeof value[field] !== "string") return false;
  }
  return (
    Array.isArray(value.keywords) &&
    Array.isArray(value.comments) &&
    Array.isArray(value.attachments) &&
    Array.isArray(value.history) &&
    Array.isArray(value.blocks) &&
    Array.isArray(value.dependsOn) &&
    Array.isArray(value.cc)
  );
}

function parseStoredBug(value: unknown, baseUrl: string, id: number): StoredBug | undefined {
  if (!isRecord(value) || value.baseUrl !== baseUrl) return undefined;
  if (typeof value.savedAt !== "number" || !Number.isFinite(value.savedAt)) return undefined;
  if (!isBugDetail(value.bug, id)) return undefined;
  return { baseUrl, savedAt: value.savedAt, bug: value.bug };
}

function nextSavedAt(): number {
  const now = Date.now();
  lastSavedAt = now > lastSavedAt ? now : lastSavedAt + 1;
  return lastSavedAt;
}

async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  const temporary = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  await writeFile(temporary, JSON.stringify(value), "utf8");
  try {
    await rename(temporary, file);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EEXIST" && code !== "EPERM") {
      await rm(temporary, { force: true });
      throw error;
    }
    await rm(file, { force: true });
    try {
      await rename(temporary, file);
    } catch (renameError) {
      await rm(temporary, { force: true });
      throw renameError;
    }
  }
}

async function prune(baseUrl: string, directory: string): Promise<void> {
  const names = (await readdir(directory)).filter((name) => name.endsWith(".json"));
  if (names.length <= MAX_CACHED_BUGS) return;

  const stored = await Promise.all(
    names.map(async (name) => {
      const file = path.join(directory, name);
      const id = Number(name.slice(0, -".json".length));
      try {
        const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
        const savedAt =
          isRecord(parsed) && typeof parsed.savedAt === "number" ? parsed.savedAt : 0;
        return { file, id, savedAt };
      } catch {
        return { file, id, savedAt: 0 };
      }
    }),
  );
  stored.sort((left, right) => right.savedAt - left.savedAt);
  await Promise.all(
    stored.slice(MAX_CACHED_BUGS).map(async ({ file, id }) => {
      if (Number.isInteger(id) && id > 0) memory.delete(cacheKey(baseUrl, id));
      await rm(file, { force: true });
    }),
  );
}

export async function readCachedBug(
  baseUrl: string,
  id: number,
): Promise<BugDetail | undefined> {
  const cached = memory.get(cacheKey(baseUrl, id));
  if (cached) return cached;

  const file = bugFile(baseUrl, id);
  if (!file) return undefined;
  try {
    const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
    const stored = parseStoredBug(parsed, baseUrl, id);
    if (!stored) return undefined;
    remember(baseUrl, stored.bug);
    return stored.bug;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`Could not read the cached copy of bug ${id}.`, error);
    }
    return undefined;
  }
}

export async function writeCachedBug(baseUrl: string, bug: BugDetail): Promise<void> {
  remember(baseUrl, bug);
  const directory = instanceDirectory(baseUrl);
  const file = bugFile(baseUrl, bug.id);
  if (!directory || !file) return;

  await mkdir(directory, { recursive: true });
  await writeJsonAtomic(file, {
    baseUrl,
    savedAt: nextSavedAt(),
    bug,
  } satisfies StoredBug);
  await prune(baseUrl, directory);
}
