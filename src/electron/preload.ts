import { contextBridge, ipcRenderer } from "electron";
import type {
  BugAttachmentDraft,
  BugCommentDraft,
  BugCreate,
  BugSearch,
  BugUpdate,
  BugzilliApi,
  DetailFieldType,
  SettingsUpdate,
} from "../shared/types.js";

const api: BugzilliApi = {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (update: SettingsUpdate) =>
    ipcRenderer.invoke("settings:save", update),
  searchBugs: (search: BugSearch) => ipcRenderer.invoke("bugs:search", search),
  searchLinkableBugs: (query: string) =>
    ipcRenderer.invoke("bugs:searchLinkable", query),
  getBug: (id: number) => ipcRenderer.invoke("bugs:get", id),
  getCurrentUser: () => ipcRenderer.invoke("user:current"),
  getProductDetailFields: (product: string) =>
    ipcRenderer.invoke("bugs:productFields", product),
  updateBug: (id: number, update: BugUpdate) =>
    ipcRenderer.invoke("bugs:update", id, update),
  createBug: (
    product: string,
    draft: BugCreate,
    fieldTypes?: Record<string, DetailFieldType>,
  ) => ipcRenderer.invoke("bugs:create", product, draft, fieldTypes),
  addComment: (id: number, comment: BugCommentDraft) =>
    ipcRenderer.invoke("bugs:comment", id, comment),
  addAttachment: (id: number, attachment: BugAttachmentDraft) =>
    ipcRenderer.invoke("bugs:attachment", id, attachment),
  openAttachment: (id: number) =>
    ipcRenderer.invoke("attachments:open", id),
  saveAttachment: (id: number) =>
    ipcRenderer.invoke("attachments:save", id),
  readClipboardText: () => ipcRenderer.invoke("clipboard:read-text"),
  writeClipboardText: (text: string) =>
    ipcRenderer.invoke("clipboard:write-text", text),
};

contextBridge.exposeInMainWorld("bugzilli", api);
