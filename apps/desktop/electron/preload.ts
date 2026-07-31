import { contextBridge, ipcRenderer } from "electron";

import type { EditorActionRequest } from "@laserx/application";

import {
  commandResultSchema,
  createDocumentRequestSchema,
  desktopStateSchema,
  editorActionRequestSchema,
  IPC_CHANNELS,
  fontCatalogSchema,
  openRecentRequestSchema,
  resolveRecoveryRequestSchema,
  setDisplayUnitRequestSchema,
  setViewportPreferencesRequestSchema,
  textLayoutRequestSchema,
  textUpdateRequestSchema,
  type CreateDocumentRequest,
  type DesktopState,
  type LaserxDesktopApi,
  type OpenRecentRequest,
  type ResolveRecoveryRequest,
  type SetDisplayUnitRequest,
  type SetViewportPreferencesRequest,
  type TextLayoutRequestDto,
  type TextUpdateRequestDto,
} from "./ipc-contract.js";

const api: LaserxDesktopApi = Object.freeze({
  security: Object.freeze({
    contextIsolated: process.contextIsolated,
    sandboxed: process.sandboxed,
  }),
  async getState() {
    return desktopStateSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.getState),
    );
  },
  async newProject() {
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.newProject),
    );
  },
  async createDocument(request: CreateDocumentRequest) {
    const validated = createDocumentRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.createDocument, validated),
    );
  },
  async openProject() {
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.openProject),
    );
  },
  async openRecent(request: OpenRecentRequest) {
    const validated = openRecentRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.openRecent, validated),
    );
  },
  async saveProject() {
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.saveProject),
    );
  },
  async saveProjectAs() {
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.saveProjectAs),
    );
  },
  async setDisplayUnit(request: SetDisplayUnitRequest) {
    const validated = setDisplayUnitRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.setDisplayUnit, validated),
    );
  },
  async setViewportPreferences(request: SetViewportPreferencesRequest) {
    const validated = setViewportPreferencesRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(
        IPC_CHANNELS.setViewportPreferences,
        validated,
      ),
    );
  },
  async editorAction(request: EditorActionRequest) {
    const validated = editorActionRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.editorAction, validated),
    );
  },
  async getFontCatalog() {
    return fontCatalogSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.getFontCatalog),
    );
  },
  async createText(request: TextLayoutRequestDto) {
    const validated = textLayoutRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.createText, validated),
    );
  },
  async updateSelectedText(request: TextUpdateRequestDto) {
    const validated = textUpdateRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(
        IPC_CHANNELS.updateSelectedText,
        validated,
      ),
    );
  },
  async resolveRecovery(request: ResolveRecoveryRequest) {
    const validated = resolveRecoveryRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.resolveRecovery, validated),
    );
  },
  onStateChanged(listener: (state: DesktopState) => void) {
    const wrapped = (_event: Electron.IpcRendererEvent, value: unknown) => {
      listener(desktopStateSchema.parse(value));
    };
    ipcRenderer.on(IPC_CHANNELS.stateChanged, wrapped);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.stateChanged, wrapped);
    };
  },
});

contextBridge.exposeInMainWorld("laserx", api);
