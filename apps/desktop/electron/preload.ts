import { contextBridge, ipcRenderer } from "electron";

import type { EditorActionRequest } from "@laserx/application";

import {
  commandResultSchema,
  bridgeProposalRequestSchema,
  aiGenerateRequestSchema,
  attachAiReferenceRequestSchema,
  cancelAiGenerationRequestSchema,
  cancelCutabilityAnalysisRequestSchema,
  cancelGeometryOperationRequestSchema,
  cancelRasterTraceRequestSchema,
  createDocumentRequestSchema,
  deleteSignTemplateRequestSchema,
  correctAiWordingRequestSchema,
  desktopStateSchema,
  editorActionRequestSchema,
  geometryOperationRequestSchema,
  cutabilityAnalysisRequestSchema,
  focusCutabilityIssueRequestSchema,
  IPC_CHANNELS,
  fontCatalogSchema,
  openRecentRequestSchema,
  openAiAccountPageRequestSchema,
  rasterTraceRequestSchema,
  resolveRecoveryRequestSchema,
  setDisplayUnitRequestSchema,
  setManufacturingSettingsRequestSchema,
  setViewportPreferencesRequestSchema,
  saveSignTemplateRequestSchema,
  selectAiConceptRequestSchema,
  signToolRequestSchema,
  textLayoutRequestSchema,
  textUpdateRequestSchema,
  vectorExportRequestSchema,
  productionExportRequestSchema,
  manufacturingLayerAnalysisRequestSchema,
  vectorImportPreviewRequestSchema,
  configureVectorImportRequestSchema,
  focusVectorImportFindingRequestSchema,
  type CreateDocumentRequest,
  type AiGenerateRequest,
  type AttachAiReferenceRequest,
  type CancelAiGenerationRequest,
  type DeleteSignTemplateRequest,
  type CorrectAiWordingRequest,
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
  type OpenAiAccountPageRequest,
  type RasterTraceRequest,
  type SaveSignTemplateRequest,
  type SelectAiConceptRequest,
  type ResolveRecoveryRequest,
  type SetDisplayUnitRequest,
  type SetManufacturingSettingsRequest,
  type SetViewportPreferencesRequest,
  type TextLayoutRequestDto,
  type TextUpdateRequestDto,
  type SignToolRequestDto,
  type VectorExportRequest,
  type ProductionExportRequest,
  type ManufacturingLayerAnalysisRequest,
  type VectorImportPreviewRequest,
  type ConfigureVectorImportRequest,
  type FocusVectorImportFindingRequest,
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
  async configureVectorImport(request: ConfigureVectorImportRequest) {
    const validated = configureVectorImportRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.configureVectorImport, validated),
    );
  },
  async focusVectorImportFinding(request: FocusVectorImportFindingRequest) {
    const validated = focusVectorImportFindingRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.focusVectorImportFinding, validated),
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
  async exportProductionPackage(request: ProductionExportRequest) {
    const validated = productionExportRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.exportProductionPackage, validated),
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
  async previewSignTool(request: SignToolRequestDto) {
    const validated = signToolRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.previewSignTool, validated),
    );
  },
  async acceptSignTool() {
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.acceptSignTool),
    );
  },
  async rejectSignTool() {
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.rejectSignTool),
    );
  },
  async saveSignTemplate(request: SaveSignTemplateRequest) {
    const validated = saveSignTemplateRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.saveSignTemplate, validated),
    );
  },
  async deleteSignTemplate(request: DeleteSignTemplateRequest) {
    const validated = deleteSignTemplateRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.deleteSignTemplate, validated),
    );
  },
  async openAiAccountPage(request: OpenAiAccountPageRequest) {
    const validated = openAiAccountPageRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.openAiAccountPage, validated),
    );
  },
  async connectAi() {
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.connectAi),
    );
  },
  async cancelAiConnection() {
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.cancelAiConnection),
    );
  },
  async replaceAiCredential() {
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.replaceAiCredential),
    );
  },
  async testAiConnection() {
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.testAiConnection),
    );
  },
  async disconnectAi() {
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.disconnectAi),
    );
  },
  async attachAiReference(request: AttachAiReferenceRequest) {
    const validated = attachAiReferenceRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.attachAiReference, validated),
    );
  },
  async removeAiReference() {
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.removeAiReference),
    );
  },
  async generateAiConcepts(request: AiGenerateRequest) {
    const validated = aiGenerateRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.generateAiConcepts, validated),
    );
  },
  async cancelAiGeneration(request: CancelAiGenerationRequest) {
    const validated = cancelAiGenerationRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.cancelAiGeneration, validated),
    );
  },
  async selectAiConcept(request: SelectAiConceptRequest) {
    const validated = selectAiConceptRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.selectAiConcept, validated),
    );
  },
  async correctAiWording(request: CorrectAiWordingRequest) {
    const validated = correctAiWordingRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.correctAiWording, validated),
    );
  },
  async acceptAiConcept() {
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.acceptAiConcept),
    );
  },
  async discardAiConcepts() {
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.discardAiConcepts),
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
  async runManufacturingLayerAnalysis(request: ManufacturingLayerAnalysisRequest) {
    const validated = manufacturingLayerAnalysisRequestSchema.parse(request);
    return commandResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.runManufacturingLayerAnalysis, validated),
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
