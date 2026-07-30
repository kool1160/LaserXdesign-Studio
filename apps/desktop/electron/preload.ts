import { contextBridge, ipcRenderer } from "electron";

import {
  commandResultSchema,
  desktopStateSchema,
  IPC_CHANNELS,
  openRecentRequestSchema,
  resolveRecoveryRequestSchema,
  setDisplayUnitRequestSchema,
  type DesktopState,
  type LaserxDesktopApi,
  type OpenRecentRequest,
  type ResolveRecoveryRequest,
  type SetDisplayUnitRequest,
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
