import { contextBridge, ipcRenderer } from "electron";

import type { EditorActionRequest } from "@laserx/application";

import {
  commandResultSchema,
  bridgeProposalRequestSchema,
  cancelCutabilityAnalysisRequestSchema,
  cancelGeometryOperationRequestSchema,
  cancelRasterTraceRequestSchema,
  createDocumentRequestSchema,
  desktopStateSchema,
  editorActionRequestSchema,
  geometryOperationRequestSchema,
  cutabilityAnalysisRequestSchema,
  focusCutabilityIssueRequestSchema,
  IPC_CHANNELS,
  fontCatalogSchema,
  openRecentRequestSchema,
  rasterTraceRequestSchema,
  resolveRecoveryRequestSchema,
  setDisplayUnitRequestSchema,
  setManufacturingSettingsRequestSchema,
  setViewportPreferencesRequestSchema,
  textLayoutRequestSchema,
  textUpdateRequestSchema,
  vectorExportRequestSchema,
  vectorImportPreviewRequestSchema,
  type CreateDocumentRequest,
  type CancelGeometryOperationRequest,
  type CancelCutabilityAnalysisRequest,
  type CancelRasterTraceRequest,
  type DesktopState,
  type GeometryOperationRequestDto,
  type CutabilityAnalysisRequest,
  type FocusCutabilityIssueRequest,
  type BridgeProposalRequestDto,
  type LaserxDesktopApi,
  type OpenRecentRequest,
  type RasterTraceRequest,
  type ResolveRecoveryRequest,
  type SetDisplayUnitRequest,
  type SetManufacturingSettingsRequest,
  type SetViewportPreferencesRequest,
  type TextLayoutRequestDto,
  type TextUpdateRequestDto,
  type VectorExportRequest,
  type VectorImportPreviewRequest,
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
  async previewVectorImport(request: VectorImportPreviewRequest) {
    const validated = vectorImportPreviewRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.previewVectorImport, validated),
    );
  },
  async commitVectorImport() {
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.commitVectorImport),
    );
  },
  async cancelVectorImport() {
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.cancelVectorImport),
    );
  },
  async exportVector(request: VectorExportRequest) {
    const validated = vectorExportRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.exportVector, validated),
    );
  },
  async previewRasterTrace(request: RasterTraceRequest) {
    const validated = rasterTraceRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.previewRasterTrace, validated),
    );
  },
  async cancelRasterTrace(request: CancelRasterTraceRequest) {
    const validated = cancelRasterTraceRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.cancelRasterTrace, validated),
    );
  },
  async acceptRasterTrace() {
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.acceptRasterTrace),
    );
  },
  async rejectRasterTrace() {
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.rejectRasterTrace),
    );
  },
  async setDisplayUnit(request: SetDisplayUnitRequest) {
    const validated = setDisplayUnitRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.setDisplayUnit, validated),
    );
  },
  async setManufacturingSettings(request: SetManufacturingSettingsRequest) {
    const validated = setManufacturingSettingsRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.setManufacturingSettings, validated),
    );
  },
  async runCutabilityAnalysis(request: CutabilityAnalysisRequest) {
    const validated = cutabilityAnalysisRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.runCutabilityAnalysis, validated),
    );
  },
  async cancelCutabilityAnalysis(request: CancelCutabilityAnalysisRequest) {
    const validated = cancelCutabilityAnalysisRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.cancelCutabilityAnalysis, validated),
    );
  },
  async focusCutabilityIssue(request: FocusCutabilityIssueRequest) {
    const validated = focusCutabilityIssueRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.focusCutabilityIssue, validated),
    );
  },
  async previewBridge(request: BridgeProposalRequestDto) {
    const validated = bridgeProposalRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.previewBridge, validated),
    );
  },
  async acceptBridge() {
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.acceptBridge),
    );
  },
  async rejectBridge() {
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.rejectBridge),
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
  async geometryOperation(request: GeometryOperationRequestDto) {
    const validated = geometryOperationRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.geometryOperation, validated),
    );
  },
  async cancelGeometryOperation(request: CancelGeometryOperationRequest) {
    const validated = cancelGeometryOperationRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(
        IPC_CHANNELS.cancelGeometryOperation,
        validated,
      ),
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
