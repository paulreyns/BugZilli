import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BugDetail } from "../shared/types.js";
import {
  readCachedBug,
  setBugCacheDirectory,
  writeCachedBug,
} from "./bug-cache.js";

function bug(id: number): BugDetail {
  return {
    id,
    summary: `Bug ${id}`,
    status: "NEW",
    resolution: "",
    product: "Browser",
    component: "UI",
    priority: "P3",
    severity: "normal",
    assignedTo: "dev@example.com",
    creator: "reporter@example.com",
    creationTime: "2026-01-01T00:00:00Z",
    lastChangeTime: "2026-10-18T10:00:00Z",
    description: "Steps",
    keywords: [],
    platform: "",
    version: "",
    comments: [],
    attachments: [],
    history: [],
    blocks: [],
    dependsOn: [],
    cc: [],
  };
}

describe("bug detail cache", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "bugzilli-bug-cache-"));
    setBugCacheDirectory(directory);
  });

  afterEach(async () => {
    setBugCacheDirectory(undefined);
    await rm(directory, { recursive: true, force: true });
  });

  it("round-trips a bug through disk after memory is cleared", async () => {
    await writeCachedBug("https://bugs.example.com", bug(42));
    setBugCacheDirectory(directory);

    await expect(
      readCachedBug("https://bugs.example.com", 42),
    ).resolves.toMatchObject({
      id: 42,
      summary: "Bug 42",
      description: "Steps",
    });
  });

  it("keeps instances separate", async () => {
    await writeCachedBug("https://bugs.example.com", bug(42));
    setBugCacheDirectory(directory);

    await expect(
      readCachedBug("https://other.example.com", 42),
    ).resolves.toBeUndefined();
  });

  it("ignores a cache file that is not a bug detail", async () => {
    await writeCachedBug("https://bugs.example.com", bug(42));
    const [instance] = await readdir(directory);
    expect(instance).toBeTruthy();
    await writeFile(path.join(directory, instance ?? "", "42.json"), "{", "utf8");
    setBugCacheDirectory(directory);

    await expect(
      readCachedBug("https://bugs.example.com", 42),
    ).resolves.toBeUndefined();
  });

  it("drops the oldest bugs once the cache is full", async () => {
    for (let id = 1; id <= 201; id += 1) {
      await writeCachedBug("https://bugs.example.com", bug(id));
    }
    setBugCacheDirectory(directory);

    await expect(readCachedBug("https://bugs.example.com", 1)).resolves.toBeUndefined();
    await expect(readCachedBug("https://bugs.example.com", 2)).resolves.toMatchObject({
      id: 2,
    });
    await expect(readCachedBug("https://bugs.example.com", 201)).resolves.toMatchObject({
      id: 201,
    });
  });
});
