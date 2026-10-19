import { contextBridge, ipcRenderer } from "electron";
import type {
  BugSearch,
  BugzilliApi,
  SettingsUpdate,
} from "../shared/types.js";

const api: BugzilliApi = {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (update: SettingsUpdate) =>
    ipcRenderer.invoke("settings:save", update),
  searchBugs: (search: BugSearch) => ipcRenderer.invoke("bugs:search", search),
  getBug: (id: number) => ipcRenderer.invoke("bugs:get", id),
  openAttachment: (id: number) =>
    ipcRenderer.invoke("attachments:open", id),
  readClipboardText: () => ipcRenderer.invoke("clipboard:read-text"),
};

contextBridge.exposeInMainWorld("bugzilli", api);
