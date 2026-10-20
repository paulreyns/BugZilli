import { app, BrowserWindow, clipboard, dialog, ipcMain } from "electron";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  addAttachment,
  addComment,
  getAttachmentFile,
  getBug,
  getProductDetailFields,
  searchBugs,
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

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: "#f7f8fa",
    title: "Bugzilli",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.setMenuBarVisibility(false);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());

  const developmentUrl = process.env.VITE_DEV_SERVER_URL;
  if (developmentUrl) {
    void window.loadURL(developmentUrl);
  } else {
    void window.loadFile(path.join(__dirname, "../../dist/index.html"));
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
  ipcMain.handle("bugs:get", (_event, id: number) => getBug(id));
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
  ipcMain.handle("attachments:open", async (event, id: number) => {
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
}

void app.whenReady().then(() => {
  registerHandlers();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
