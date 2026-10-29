import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from "electron";
import { access, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  addAttachment,
  addComment,
  getAttachmentFile,
  getBug,
  getCurrentUser,
  getProductDetailFields,
  searchBugs,
  searchLinkableBugs,
  updateBug,
} from "./bugzilla.js";
import { getSettings, saveSettings } from "./settings.js";
import type {
  BugAttachmentDraft,
  BugCommentDraft,
  BugSearch,
  BugUpdate,
  SettingsUpdate,
} from "../shared/types.js";

/** Matches the sidebar brand-mark (Lucide Bug on the blue→purple gradient). */
function getAppIconPath(): string {
  return path.join(__dirname, "../../build/icon.png");
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: "#f7f8fa",
    title: "Bugzilli",
    icon: getAppIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.setMenuBarVisibility(false);
  window.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const externalUrl = new URL(url);
      if (externalUrl.protocol === "http:" || externalUrl.protocol === "https:") {
        void shell.openExternal(externalUrl.toString()).catch((error: unknown) => {
          console.error("Failed to open external URL:", error);
        });
      }
    } catch (error) {
      console.error("Failed to parse external URL:", error);
    }

    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event) => event.preventDefault());

  const developmentUrl = process.env.VITE_DEV_SERVER_URL;
  if (developmentUrl) {
    void window.loadURL(developmentUrl);
  } else {
    void window.loadFile(path.join(__dirname, "../../dist/index.html"));
  }
}

async function uniqueDownloadPath(fileName: string): Promise<string> {
  const directory = app.getPath("downloads");
  const safeName = path.basename(fileName.replace(/\\/g, "/")) || "attachment";
  const extension = path.extname(safeName);
  const stem = safeName.slice(0, safeName.length - extension.length);
  for (let index = 0; ; index += 1) {
    const candidate = path.join(
      directory,
      index === 0 ? safeName : `${stem} (${index})${extension}`,
    );
    try {
      await access(candidate);
    } catch {
      return candidate;
    }
  }
}

function registerHandlers(): void {
  ipcMain.handle("settings:get", () => getSettings());
  ipcMain.handle("settings:save", (_event, update: SettingsUpdate) =>
    saveSettings(update),
  );
  ipcMain.handle("bugs:search", (_event, search: BugSearch) =>
    searchBugs(search),
  );
  ipcMain.handle("bugs:searchLinkable", (_event, query: string) =>
    searchLinkableBugs(query),
  );
  ipcMain.handle("bugs:get", (_event, id: number) => getBug(id));
  ipcMain.handle("user:current", () => getCurrentUser());
  ipcMain.handle("bugs:productFields", (_event, product: string) =>
    getProductDetailFields(product),
  );
  ipcMain.handle("bugs:update", (_event, id: number, update: BugUpdate) =>
    updateBug(id, update),
  );
  ipcMain.handle("bugs:comment", (_event, id: number, comment: BugCommentDraft) =>
    addComment(id, comment),
  );
  ipcMain.handle(
    "bugs:attachment",
    (_event, id: number, attachment: BugAttachmentDraft) =>
      addAttachment(id, attachment),
  );
  ipcMain.handle("attachments:open", async (_event, id: number) => {
    const attachment = await getAttachmentFile(id);
    const filePath = await uniqueDownloadPath(attachment.fileName);
    await writeFile(filePath, attachment.data, { flag: "wx" });
    const error = await shell.openPath(filePath);
    if (error) throw new Error(`Saved to ${filePath} but could not open it: ${error}`);
  });
  ipcMain.handle("attachments:save", async (event, id: number) => {
    const attachment = await getAttachmentFile(id);
    const window = BrowserWindow.fromWebContents(event.sender);
    const options = {
      title: "Save attachment",
      defaultPath: attachment.fileName,
    };
    const result = window
      ? await dialog.showSaveDialog(window, options)
      : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return;
    await writeFile(result.filePath, attachment.data);
  });
  ipcMain.handle("clipboard:read-text", () => clipboard.readText());
  ipcMain.handle("clipboard:write-text", (_event, text: string) =>
    clipboard.writeText(text),
  );
}

void app.whenReady().then(() => {
  if (process.platform === "darwin") {
    app.dock?.setIcon(getAppIconPath());
  }
  registerHandlers();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
