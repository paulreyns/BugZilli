import { contextBridge, ipcRenderer } from "electron";
import type {
  BugAttachmentDraft,
  BugCommentDraft,
  BugSearch,
  BugUpdate,
  BugzilliApi,
  SettingsUpdate,
} from "../shared/types.js";

const api: BugzilliApi = {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (update: SettingsUpdate) =>
    ipcRenderer.invoke("settings:save", update),
  searchBugs: (search: BugSearch) => ipcRenderer.invoke("bugs:search", search),
  getBug: (id: number) => ipcRenderer.invoke("bugs:get", id),
  getProductDetailFields: (product: string) =>
    ipcRenderer.invoke("bugs:productFields", product),
  updateBug: (id: number, update: BugUpdate) =>
    ipcRenderer.invoke("bugs:update", id, update),
  addComment: (id: number, comment: BugCommentDraft) =>
    ipcRenderer.invoke("bugs:comment", id, comment),
  addAttachment: (id: number, attachment: BugAttachmentDraft) =>
    ipcRenderer.invoke("bugs:attachment", id, attachment),
  openAttachment: (id: number) =>
    ipcRenderer.invoke("attachments:open", id),
  readClipboardText: () => ipcRenderer.invoke("clipboard:read-text"),
  writeClipboardText: (text: string) =>
    ipcRenderer.invoke("clipboard:write-text", text),
};

contextBridge.exposeInMainWorld("bugzilli", api);
