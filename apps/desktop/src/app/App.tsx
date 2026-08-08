import {
  previewSelectedPathJoin,
  type EditorActionRequest,
} from "@laserx/application";
import {
  MILLIMETERS_PER_INCH,
  formatStockThickness,
  isRegistrationCircleObject,
  stockThicknessChoicesForMaterial,
  type PathObject,
  type ManufacturingSettingField,
  type ManufacturingSettings,
  type ManufacturingLayerMetadata,
  type RasterTracePreset,
  type RasterTraceSettings,
} from "@laserx/domain";
import {
  MANUFACTURING_PRESETS,
  settingsForManufacturingPreset,
} from "@laserx/cutability";
import { settingsForRasterTracePreset } from "@laserx/import-raster";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  type SyntheticEvent,
} from "react";

import type {
  CommandResult,
  DesktopState,
  OnboardingActionRequest,
} from "../../electron/ipc-contract.js";
import { Viewport } from "../components/Viewport.js";
import { TextPanel } from "../components/TextPanel.js";
import { SignToolsPanel } from "../components/SignToolsPanel.js";
import { AiGenerationPanel } from "../components/AiGenerationPanel.js";
import { PhysicalPreviewErrorBoundary } from "../features/physical-preview/PhysicalPreviewErrorBoundary.js";
import {
  guidedGoal,
  guidedStep,
} from "../features/onboarding/guidedWorkflowDefinitions.js";
import {
  canCompleteResolution,
  isStepSkippable,
  resolutionPrimaryAction,
} from "../features/onboarding/guidedWorkflowState.js";
import {
  centerGuideCommand,
  displayScalar,
  exactBoundsCommand,
  formatDimensions,
  gridSpacingForDisplay,
  gridSpacingToMillimeters,
  keyboardMoveCommand,
  mirrorSelectionCommand,
  rotateSelectionCommand,
  selectionBoundsForDisplay,
} from "../lib/viewport-adapter.js";

type Command = () => Promise<CommandResult>;
type OnboardingAdvanceCompletion = Extract<
  OnboardingActionRequest,
  { type: "advance" }
>["completion"];
type GeometryUiRequest =
  | {
      kind: "boolean";
      operation: "union" | "subtract" | "intersect" | "xor";
    }
  | {
      kind: "offset";
      distanceMm: number;
      join: "miter" | "round" | "square";
    };

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement)
  );
}

function scrollToWorkflow(id: string): void {
  window.document.getElementById(id)?.scrollIntoView({
    block: "start",
    behavior: "auto",
  });
}

/**
 * Loaded only when the user opens the physical preview -- keeps Three.js and
 * React Three Fiber out of the main editor bundle (ADR 0024 section 5).
 * Declared at module scope, not inside `App`, so the dynamic import is
 * requested once rather than on every render.
 */
const PhysicalPreviewScreenLazy = lazy(
  () => import("../features/physical-preview/PhysicalPreviewScreen.js"),
);

export function App() {
  const [state, setState] = useState<DesktopState | null>(null);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeGeometryOperationId, setActiveGeometryOperationId] =
    useState<string | null>(null);
  const [activeRasterOperationId, setActiveRasterOperationId] =
    useState<string | null>(null);
  const [activeCutabilityOperationId, setActiveCutabilityOperationId] =
    useState<string | null>(null);
  const [physicalPreviewOpen, setPhysicalPreviewOpen] = useState(false);
  const [physicalPreviewBuildFailed, setPhysicalPreviewBuildFailed] =
    useState(false);
  const [activePhysicalPreviewOperationId, setActivePhysicalPreviewOperationId] =
    useState<string | null>(null);
  const [manufacturingSettings, setManufacturingSettings] =
    useState<ManufacturingSettings>(() =>
      settingsForManufacturingPreset("laser-mild-steel-3mm"),
    );
  const [manufacturingPreviewVisible, setManufacturingPreviewVisible] =
    useState(true);
  const [excludedProductionLayerIds, setExcludedProductionLayerIds] =
    useState<string[]>([]);
  const [replaceProductionPackage, setReplaceProductionPackage] =
    useState(false);
  const [issueSeverityFilter, setIssueSeverityFilter] = useState<
    "all" | "error" | "warning"
  >("all");
  const [bridgeDirection, setBridgeDirection] = useState<
    "left" | "right" | "up" | "down"
  >("right");
  const [rasterSettings, setRasterSettings] = useState<RasterTraceSettings>(
    () => settingsForRasterTracePreset("balanced"),
  );
  const [rasterPreviewMode, setRasterPreviewMode] = useState<
    "original" | "blackWhite" | "edges" | "trace" | "overlay"
  >("overlay");
  const [rasterOverlayOpacity, setRasterOverlayOpacity] = useState(0.45);
  const [width, setWidth] = useState("24");
  const [height, setHeight] = useState("12");
  const [inputUnit, setInputUnit] = useState<
    "millimeters" | "inches"
  >("inches");
  const [unitlessDxfUnit, setUnitlessDxfUnit] = useState<
    "millimeters" | "inches"
  >("millimeters");
  const [gridSpacing, setGridSpacing] = useState("10");
  const [simplifyTolerance, setSimplifyTolerance] = useState("0.1");
  const [cleanupTolerance, setCleanupTolerance] = useState("0.01");
  const [joinTolerance, setJoinTolerance] = useState("0.1");
  const [offsetDistance, setOffsetDistance] = useState("1");
  const [offsetJoin, setOffsetJoin] = useState<"miter" | "round" | "square">(
    "round",
  );
  const [aspectLocked, setAspectLocked] = useState(true);
  const [lockedDimension, setLockedDimension] = useState<
    "width" | "height"
  >("width");
  const [inspector, setInspector] = useState({
    x: "",
    y: "",
    width: "",
    height: "",
    angle: "15",
  });

  const loadInitialState = useCallback(async () => {
    setStartupError(null);
    try {
      setState(await window.laserx.getState());
    } catch {
      setStartupError(
        "LaserX could not load the project state. Your files were not changed.",
      );
    }
  }, []);

  useEffect(() => {
    void loadInitialState();
    return window.laserx.onStateChanged((nextState) => {
      setState(nextState);
    });
  }, [loadInitialState]);

  useEffect(() => {
    if (state !== null) {
      setGridSpacing(
        String(gridSpacingForDisplay(state.project.document)),
      );
    }
  }, [
    state?.project.document.settings.displayUnit,
    state?.project.document.settings.viewport.gridSpacingMm,
  ]);

  const savedManufacturingSettingsKey =
    state === null
      ? null
      : JSON.stringify(state.project.document.settings.manufacturing);

  useEffect(() => {
    if (state !== null) {
      setManufacturingSettings({
        ...state.project.document.settings.manufacturing,
        customizedFields: [
          ...state.project.document.settings.manufacturing.customizedFields,
        ],
      });
    }
  }, [savedManufacturingSettingsKey, state?.project.id]);

  useEffect(() => {
    if (state?.editor.selectionBounds === null || state === null) {
      setInspector((current) => ({
        ...current,
        x: "",
        y: "",
        width: "",
        height: "",
      }));
      return;
    }
    const bounds = state.editor.selectionBounds;
    const unit = state.project.document.settings.displayUnit;
    setInspector((current) => ({
      ...current,
      ...selectionBoundsForDisplay(bounds, unit),
    }));
  }, [
    state?.editor.selectionBounds,
    state?.project.document.settings.displayUnit,
  ]);

  const run = useCallback(async (command: Command) => {
    setBusy(true);
    setError(null);
    try {
      const result = await command();
      setState(result.state);
      if (!result.ok) {
        setError(result.error);
      }
    } catch {
      setError("The desktop service returned an invalid response.");
    } finally {
      setBusy(false);
    }
  }, []);

  const dispatchEditorAction = useCallback(
    (request: EditorActionRequest) => {
      void run(() => window.laserx.editorAction(request));
    },
    [run],
  );

  const runGeometry = useCallback(async (request: GeometryUiRequest) => {
    const operationId = window.crypto.randomUUID();
    setActiveGeometryOperationId(operationId);
    setBusy(true);
    setError(null);
    try {
      const result = await window.laserx.geometryOperation({
        operationId,
        ...request,
      });
      setState(result.state);
      if (!result.ok) {
        setError(result.error);
      }
    } catch {
      setError("The geometry worker returned an invalid response.");
    } finally {
      setActiveGeometryOperationId(null);
      setBusy(false);
    }
  }, []);

  const runRasterTrace = useCallback(async () => {
    const operationId = window.crypto.randomUUID();
    setActiveRasterOperationId(operationId);
    setBusy(true);
    setError(null);
    try {
      const result = await window.laserx.previewRasterTrace({
        operationId,
        settings: rasterSettings,
      });
      setState(result.state);
      if (!result.ok) setError(result.error);
    } catch {
      setError("The raster worker returned an invalid response.");
    } finally {
      setActiveRasterOperationId(null);
      setBusy(false);
    }
  }, [rasterSettings]);

  const chooseRasterPreset = useCallback((preset: RasterTracePreset) => {
    setRasterSettings((current) => ({
      ...settingsForRasterTracePreset(preset),
      outputWidthMm: current.outputWidthMm,
      crop: { ...current.crop },
      rotationDeg: current.rotationDeg,
      background: current.background,
    }));
  }, []);

  const runCutability = useCallback(async (objectIds: readonly string[]) => {
    const operationId = window.crypto.randomUUID();
    setActiveCutabilityOperationId(operationId);
    setBusy(true);
    setError(null);
    try {
      const result = await window.laserx.runCutabilityAnalysis({
        operationId,
        objectIds: [...objectIds],
      });
      setState(result.state);
      if (!result.ok) setError(result.error);
    } catch {
      setError("The manufacturing analysis worker returned an invalid response.");
    } finally {
      setActiveCutabilityOperationId(null);
      setBusy(false);
    }
  }, []);

  const openPhysicalPreview = useCallback(async () => {
    setPhysicalPreviewOpen(true);
    setPhysicalPreviewBuildFailed(false);
    const operationId = window.crypto.randomUUID();
    setActivePhysicalPreviewOperationId(operationId);
    setBusy(true);
    setError(null);
    try {
      const result = await window.laserx.runPhysicalPreview({ operationId });
      setState(result.state);
      if (!result.ok) {
        setPhysicalPreviewBuildFailed(true);
        setError(result.error);
      }
    } catch {
      setPhysicalPreviewBuildFailed(true);
      setError("The physical preview worker returned an invalid response.");
    } finally {
      setActivePhysicalPreviewOperationId(null);
      setBusy(false);
    }
  }, []);

  const savePhysicalPreviewCapture = useCallback(
    (capture: {
      filename: string;
      pngBase64: string;
      widthPx: number;
      heightPx: number;
      assemblyFingerprint: string;
    }) => {
      void (async () => {
        setError(null);
        try {
          // The destination is chosen in the main process, so this call
          // deliberately carries no path -- only bytes and a flat filename.
          const result = await window.laserx.savePhysicalPreviewCapture({
            filename: capture.filename,
            pngBase64: capture.pngBase64,
            overwrite: true,
            widthPx: capture.widthPx,
            heightPx: capture.heightPx,
            assemblyFingerprint: capture.assemblyFingerprint,
          });
          setState(result.state);
          if (!result.ok) setError(result.error);
        } catch {
          setError("The preview capture could not be saved.");
        }
      })();
    },
    [],
  );

  const closePhysicalPreview = useCallback(() => {
    setPhysicalPreviewOpen(false);
    setPhysicalPreviewBuildFailed(false);
    const operationId =
      state?.physicalPreview.job?.operationId ?? activePhysicalPreviewOperationId;
    if (operationId !== null) {
      void window.laserx.cancelPhysicalPreview({ operationId });
    }
  }, [state?.physicalPreview.job?.operationId, activePhysicalPreviewOperationId]);

  const reportGuidedPhysicalPreviewOutcome = useCallback(
    async (
      expectedStepId: string,
      runToken: string,
      completion: OnboardingAdvanceCompletion,
    ) => {
      setBusy(true);
      setError(null);
      try {
        const result = await window.laserx.onboardingAction({
          type: "advance",
          expectedStepId,
          runToken,
          completion,
        });
        setState(result.state);
        if (result.ok) {
          setPhysicalPreviewOpen(false);
          setPhysicalPreviewBuildFailed(false);
        } else {
          setError(result.error);
        }
      } catch {
        setError("The 3D preview outcome could not be recorded.");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const chooseManufacturingPreset = useCallback((presetId: string) => {
    setManufacturingSettings(settingsForManufacturingPreset(presetId));
  }, []);

  const updateManufacturingField = useCallback(
    <Field extends ManufacturingSettingField,>(
      field: Field,
      value: ManufacturingSettings[Field],
    ) => {
      setManufacturingSettings((current) => ({
        ...current,
        [field]: value,
        customizedFields: current.customizedFields.includes(field)
          ? [...current.customizedFields]
          : [...current.customizedFields, field],
      }));
    },
    [],
  );

  useEffect(() => {
    if (state === null) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }
      const primary = event.ctrlKey || event.metaKey;
      const selectionIds = state.editor.selectionIds;
      const pathSelection = state.editor.pathSelection;
      let request: EditorActionRequest | null = null;
      if (primary && event.key.toLowerCase() === "z") {
        request = event.shiftKey
          ? { type: "history.redo" }
          : { type: "history.undo" };
      } else if (primary && event.key.toLowerCase() === "y") {
        request = { type: "history.redo" };
      } else if (primary && event.key.toLowerCase() === "c") {
        request = { type: "clipboard.copy" };
      } else if (primary && event.key.toLowerCase() === "v") {
        request = { type: "clipboard.paste" };
      } else if (primary && event.key.toLowerCase() === "d") {
        request = { type: "objects.duplicate-selection" };
      } else if (primary && event.key.toLowerCase() === "g") {
        request = event.shiftKey
          ? { type: "objects.ungroup", objectIds: selectionIds }
          : { type: "objects.group-selection" };
      } else if (primary && event.key.toLowerCase() === "a") {
        request = { type: "selection.all" };
      } else if (
        (event.key === "Delete" || event.key === "Backspace") &&
        pathSelection !== null &&
        pathSelection.nodeIndices.length > 0
      ) {
        request = {
          type: "path.delete-nodes",
          objectId: pathSelection.objectId,
          nodeIndices: pathSelection.nodeIndices,
        };
      } else if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
          event.key,
        ) &&
        pathSelection !== null &&
        pathSelection.nodeIndices.length > 0
      ) {
        const stepMm = event.shiftKey ? 10 : 1;
        request = {
          type: "path.move-nodes",
          objectId: pathSelection.objectId,
          nodeIndices: pathSelection.nodeIndices,
          deltaXmm:
            event.key === "ArrowLeft"
              ? -stepMm
              : event.key === "ArrowRight"
                ? stepMm
                : 0,
          deltaYmm:
            event.key === "ArrowDown"
              ? -stepMm
              : event.key === "ArrowUp"
                ? stepMm
                : 0,
        };
      } else if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selectionIds.length > 0
      ) {
        request = { type: "objects.delete", objectIds: selectionIds };
      } else if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
          event.key,
        ) &&
        selectionIds.length > 0
      ) {
        const stepMm = event.shiftKey ? 10 : 1;
        request = keyboardMoveCommand(
          selectionIds,
          event.key === "ArrowLeft"
            ? -stepMm
            : event.key === "ArrowRight"
              ? stepMm
              : 0,
          event.key === "ArrowDown"
            ? -stepMm
            : event.key === "ArrowUp"
              ? stepMm
              : 0,
        );
      } else if (event.key === "Escape") {
        request = { type: "selection.clear" };
      }
      if (request !== null) {
        event.preventDefault();
        dispatchEditorAction(request);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatchEditorAction, state]);

  if (state === null) {
    if (startupError !== null) {
      return (
        <main className="startup-error" role="alert">
          <img className="startup-mark" src="./laserx-mark.svg" alt="" />
          <span className="eyebrow">Startup problem</span>
          <h1>LaserX could not finish loading.</h1>
          <p data-testid="startup-error">{startupError}</p>
          <button
            type="button"
            data-testid="retry-startup"
            onClick={() => void loadInitialState()}
          >
            Retry
          </button>
        </main>
      );
    }
    return (
      <main className="loading" role="status" aria-live="polite">
        <img className="startup-mark" src="./laserx-mark.svg" alt="" />
        <span className="loading-spinner" aria-hidden="true" />
        <strong>Starting LaserX Design Studio</strong>
        <span>Preparing your precision design workspace.</span>
      </main>
    );
  }

  const document = state.project.document;
  const activeLayer = document.layers.find(
    (layer) => layer.id === document.activeLayerId,
  );
  const manufacturingThicknessChoices = stockThicknessChoicesForMaterial(
    manufacturingSettings.material,
  );
  const selectedManufacturingThicknessChoice = manufacturingThicknessChoices.find(
    (choice) =>
      choice.designation.kind === manufacturingSettings.stockThicknessDesignation?.kind &&
      choice.designation.label === manufacturingSettings.stockThicknessDesignation.label &&
      choice.designation.material === manufacturingSettings.stockThicknessDesignation.material,
  )?.id ?? "custom";
  const activeLayerThicknessChoices = activeLayer?.manufacturing === undefined
    ? []
    : stockThicknessChoicesForMaterial(activeLayer.manufacturing.material);
  const activeLayerThicknessDesignation =
    activeLayer?.manufacturing?.stockThicknessDesignation;
  const selectedLayerThicknessChoice = activeLayerThicknessChoices.find(
    (choice) =>
      choice.designation.kind === activeLayerThicknessDesignation?.kind &&
      choice.designation.label === activeLayerThicknessDesignation.label &&
      choice.designation.material === activeLayerThicknessDesignation.material,
  )?.id ?? "custom";
  const physicalProductionLayers = document.layers.filter(
    (layer) =>
      layer.manufacturing !== undefined &&
      layer.manufacturing.role !== "non-cut-preview",
  );
  const selectedProductionLayerIds = physicalProductionLayers
    .filter((layer) => !excludedProductionLayerIds.includes(layer.id))
    .map((layer) => layer.id);
  const viewportPreferences = document.settings.viewport;
  const selectionIds = state.editor.selectionIds;
  const selectedRegistrationHoleIds = selectionIds.filter((objectId) => {
    const object = document.objects.find((candidate) => candidate.id === objectId);
    return (
      object !== undefined &&
      object.layerId === activeLayer?.id &&
      isRegistrationCircleObject(object)
    );
  });
  const selectionBounds = state.editor.selectionBounds;
  const pathSelection = state.editor.pathSelection;
  const selectedPaths = selectionIds
    .map((id) => document.objects.find((object) => object.id === id))
    .filter(
      (object): object is PathObject => object?.type === "path",
    );
  const selectedPath =
    selectedPaths.length === 1 ? selectedPaths[0] : undefined;
  const joinPreview = previewSelectedPathJoin(
    selectedPaths,
    Number(joinTolerance),
  );
  const unit = document.settings.displayUnit;
  const stockThicknessInputUnit = unit === "inches" ? "in" : "mm";
  const stockThicknessForDisplay = (thicknessMm: number): number =>
    unit === "inches"
      ? Number((thicknessMm / MILLIMETERS_PER_INCH).toFixed(6))
      : thicknessMm;
  const stockThicknessFromDisplay = (thickness: number): number =>
    unit === "inches" ? thickness * MILLIMETERS_PER_INCH : thickness;
  const unitLabel = unit === "inches" ? "in" : "mm";
  const cutability = state.analysis.cutability;
  const repairGroups = state.analysis.repairGroups;
  const focusedCutabilityIssue = cutability?.issues.find(
    (issue) => issue.id === state.analysis.focusedIssueId,
  ) ?? null;
  const cutabilityIssueById = new Map(
    (cutability?.issues ?? []).map((issue) => [issue.id, issue]),
  );
  const repairFindingGroups = repairGroups === null
    ? []
    : [
        repairGroups.safeToFix,
        repairGroups.suggestedFix,
        repairGroups.needsYourDecision,
      ].map((group) => ({
        ...group,
        issues: group.findingIds
          .map((id) => cutabilityIssueById.get(id))
          .filter(
            (issue): issue is NonNullable<typeof issue> =>
              issue !== undefined &&
              (issueSeverityFilter === "all" ||
                issue.severity === issueSeverityFilter),
          ),
      }));
  const workspaceIsEmpty =
    document.objects.length === 0 &&
    state.editor.importPreview === null &&
    state.editor.rasterTracePreview === null &&
    state.editor.signToolPreview === null &&
    state.editor.aiConceptPreview === null &&
    state.interchange.sourceSelection === null;
  const guidance = state.onboarding.workflow;
  const guidanceActive = guidance.status === "active";
  const guidanceGoal = guidance.goal === null ? null : guidedGoal(guidance.goal);
  const guidanceStep =
    guidance.goal === null || guidance.currentStepId === null
      ? null
      : guidedStep(guidance.goal, guidance.currentStepId);
  const guidanceStepIndex =
    guidanceGoal === null || guidance.currentStepId === null
      ? -1
      : guidanceGoal.definition.stepIds.indexOf(guidance.currentStepId);
  const guidanceCanSkip =
    guidanceGoal !== null &&
    isStepSkippable(guidanceGoal.definition, guidance.currentStepId);
  const guidanceResolutionCounts = {
    safeFixableCount: repairGroups?.safeToFix.findingCount ?? 0,
    needsDecisionCount:
      (repairGroups?.suggestedFix.findingCount ?? 0) +
      (repairGroups?.needsYourDecision.findingCount ?? 0),
    blockingCount: cutability?.errorCount ?? 0,
  };
  const guidanceResolutionPrimaryAction = resolutionPrimaryAction(
    guidanceResolutionCounts,
  );
  const guidanceIsCreateFirstSign =
    guidanceActive && guidance.goal === "create-first-sign";
  const guidanceIsImportOwnDesign =
    guidanceActive && guidance.goal === "import-own-design";
  const guidedImportSource = guidanceIsImportOwnDesign
    ? state.interchange.sourceSelection
    : null;
  const guidedImportSourceKind = guidedImportSource?.kind ?? null;
  const guidedPhysicalLayerIds = new Set(
    document.layers
      .filter(
        (layer) =>
          layer.manufacturing !== undefined &&
          layer.manufacturing.role !== "non-cut-preview" &&
          Number.isFinite(layer.manufacturing.thicknessMm) &&
          layer.manufacturing.thicknessMm > 0,
      )
      .map((layer) => layer.id),
  );
  const guidedPhysicalStockReady =
    document.dimensions.widthMm > 0 &&
    document.dimensions.heightMm > 0 &&
    guidedPhysicalLayerIds.size > 0;
  const guidedPhysicalContentReady = document.objects.some((object) =>
    guidedPhysicalLayerIds.has(object.layerId),
  );
  const guidedWholeDesignAnalysisReady =
    state.analysis.scope?.kind === "whole-design" && cutability !== null;
  const guidedOutcomeConfirmation = guidanceIsCreateFirstSign
    ? guidanceStep?.id === "choose-size-material" && guidedPhysicalStockReady
      ? "Use current size and material"
      : guidanceStep?.id === "add-content" && guidedPhysicalContentReady
        ? "Use current sign content"
        : guidanceStep?.id === "analyze-cutability" && guidedWholeDesignAnalysisReady
          ? "Use current whole-design check"
          : guidanceStep?.id === "resolve-findings"
            ? guidanceResolutionPrimaryAction === "fix-safe-problems"
              ? "Fix safe problems"
              : guidanceResolutionPrimaryAction === "review-decisions"
                ? "Review decisions"
                : "Continue"
            : null
    : guidanceIsImportOwnDesign
      ? guidanceStep?.id === "assign-physical" &&
        guidedPhysicalStockReady &&
        guidedPhysicalContentReady
        ? "Use imported physical setup"
        : guidanceStep?.id === "analyze-cutability" && guidedWholeDesignAnalysisReady
          ? "Use current whole-design check"
          : guidanceStep?.id === "resolve-findings"
            ? guidanceResolutionPrimaryAction === "fix-safe-problems"
              ? "Fix safe problems"
              : guidanceResolutionPrimaryAction === "review-decisions"
                ? "Review decisions"
                : "Continue"
            : null
      : "Continue";
  const guidedPhysicalPreviewIdentity =
    (guidanceIsCreateFirstSign || guidanceIsImportOwnDesign) &&
    guidanceStep?.id === "physical-preview" &&
    guidance.runToken !== null
      ? {
          expectedStepId: guidanceStep.id,
          runToken: guidance.runToken,
        }
      : null;
  const showGoalChooser =
    workspaceIsEmpty &&
    guidance.status === "idle" &&
    !state.onboarding.preferences.dismissed &&
    state.onboarding.resumeEligibility !== "available";
  const showResumeGuidance =
    guidance.status === "idle" &&
    state.onboarding.resumeEligibility === "available";

  const updateActiveLayerManufacturing = (
    updates: Partial<ManufacturingLayerMetadata>,
  ) => {
    if (activeLayer?.manufacturing === undefined) return;
    dispatchEditorAction({
      type: "layer.set-manufacturing",
      layerId: activeLayer.id,
      manufacturing: { ...activeLayer.manufacturing, ...updates },
    });
  };

  const createExactDocument = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(() =>
      window.laserx.createDocument({
        width: Number(width),
        height: Number(height),
        inputUnit,
      }),
    );
  };

  const applyInspector = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectionIds.length === 0) {
      return;
    }
    const request = exactBoundsCommand(
      selectionIds,
      inspector,
      unit,
      aspectLocked,
      lockedDimension,
    );
    if (request !== null) {
      dispatchEditorAction(request);
    }
  };

  const rotateSelection = () => {
    const request = rotateSelectionCommand(
      selectionIds,
      selectionBounds,
      inspector.angle,
    );
    if (request !== null) {
      dispatchEditorAction(request);
    }
  };

  const setSelectedNodeHandle = (
    handle: "incoming" | "outgoing",
    remove: boolean,
  ) => {
    const nodeIndex = pathSelection?.nodeIndices[0];
    if (
      selectedPath === undefined ||
      pathSelection === null ||
      pathSelection.nodeIndices.length !== 1 ||
      nodeIndex === undefined
    ) {
      return;
    }
    const anchor = selectedPath.points[nodeIndex];
    if (anchor === undefined) {
      return;
    }
    const worldAnchor = {
      xMm:
        selectedPath.transform.a * anchor.xMm +
        selectedPath.transform.c * anchor.yMm +
        selectedPath.transform.eMm,
      yMm:
        selectedPath.transform.b * anchor.xMm +
        selectedPath.transform.d * anchor.yMm +
        selectedPath.transform.fMm,
    };
    dispatchEditorAction({
      type: "path.set-handle",
      objectId: selectedPath.id,
      nodeIndex,
      handle,
      point: remove
        ? null
        : {
            xMm: worldAnchor.xMm + (handle === "incoming" ? -5 : 5),
            yMm: worldAnchor.yMm,
          },
    });
  };

  return (
    <div
      className={`app-shell${guidanceActive ? ` guidance-active guidance-${guidanceStep?.surface ?? "create"} guidance-step-${guidanceStep?.id ?? "unknown"} guidance-source-${guidedImportSourceKind ?? "unknown"}` : ""}`}
      aria-busy={busy}
    >
      <a className="skip-link" href="#design-workspace">
        Skip to design workspace
      </a>
      <header className="topbar">
        <div className="brand">
          <img className="brand-mark" src="./laserx-mark.svg" alt="" />
          <div>
            <span className="brand-name">LaserX</span>
            <span className="brand-product">Design Studio</span>
            <div className="project-title" data-testid="project-title">
              {state.project.name}
              {state.dirty && (
                <span
                  className="dirty-dot"
                  title="Unsaved changes"
                  data-testid="dirty-indicator"
                />
              )}
            </div>
          </div>
        </div>
        <div className="project-location">
          <span className={`save-state${state.dirty ? " dirty" : ""}`}>
            <span aria-hidden="true">{state.dirty ? "●" : "✓"}</span>
            {state.dirty ? "Unsaved changes" : "Saved"}
          </span>
          <div
            className="file-location"
            title={state.filePath ?? "New project — not saved yet"}
          >
            {state.filePath ?? "New project — not saved yet"}
          </div>
        </div>
      </header>

      <nav className="commandbar" aria-label="Project and edit commands">
        <div className="command-group project-command-group">
          <span className="command-group-label">Project</span>
          <div className="command-group-actions">
            <div className="project-replacement-controls" hidden={guidanceActive}>
            <button type="button" className="command-primary" disabled={busy} title="Start a new LaserX project" onClick={() => void run(() => window.laserx.newProject())}>
              <span className="command-icon" aria-hidden="true">+</span><span>New Design</span>
            </button>
            <button type="button" disabled={busy} title="Open an existing .laserx project" onClick={() => void run(() => window.laserx.openProject())}>
              <span className="command-icon" aria-hidden="true">↗</span><span>Open Project</span>
            </button>
            </div>
            <button type="button" disabled={busy} title="Save this .laserx project" onClick={() => void run(() => window.laserx.saveProject())}>
              <span className="command-icon" aria-hidden="true">↓</span><span>Save</span>
            </button>
            <button type="button" aria-label="Save as" disabled={busy} title="Save this project to a different .laserx file" onClick={() => void run(() => window.laserx.saveProjectAs())}>Save As</button>
          </div>
        </div>
        <div className="command-group edit-command-group">
          <span className="command-group-label">Edit</span>
          <div className="command-group-actions">
            <button type="button" disabled={busy || state.editor.history.undoDepth === 0} data-testid="undo" title="Undo (Ctrl+Z)" aria-keyshortcuts="Control+Z" onClick={() => dispatchEditorAction({ type: "history.undo" })}>Undo</button>
            <button type="button" disabled={busy || state.editor.history.redoDepth === 0} data-testid="redo" title="Redo (Ctrl+Y)" aria-keyshortcuts="Control+Y" onClick={() => dispatchEditorAction({ type: "history.redo" })}>Redo</button>
            <button type="button" disabled={busy || selectionIds.length === 0} title="Copy selection (Ctrl+C)" aria-keyshortcuts="Control+C" onClick={() => dispatchEditorAction({ type: "clipboard.copy" })}>Copy</button>
            <button type="button" disabled={busy || !state.editor.clipboardHasContent} title="Paste (Ctrl+V)" aria-keyshortcuts="Control+V" onClick={() => dispatchEditorAction({ type: "clipboard.paste" })}>Paste</button>
          </div>
        </div>
        {(!guidanceActive ||
          (guidanceIsImportOwnDesign && guidanceStep?.id === "choose-file")) && (
          <div className="command-group artwork-command-group">
            <span className="command-group-label">Bring in artwork</span>
            <div className="command-group-actions">
              {guidanceIsImportOwnDesign ? (
                <button
                  type="button"
                  data-testid="select-import-source"
                  disabled={busy}
                  title="Choose SVG, DXF, PNG, or JPEG artwork"
                  onClick={() => void run(() =>
                    window.laserx.selectImportSource({ unitlessDxfUnit }))}
                >
                  <span className="command-icon" aria-hidden="true">↘</span>
                  <span>Choose Artwork</span>
                  <small>SVG / DXF / PNG / JPEG</small>
                </button>
              ) : (
                <>
                  <button type="button" data-testid="preview-vector-import" disabled={busy} title="Import SVG or DXF as editable paths" onClick={() => void run(() => window.laserx.previewVectorImport({ unitlessDxfUnit }))}>
                    <span className="command-icon" aria-hidden="true">↘</span><span>Import Artwork</span><small>SVG / DXF</small>
                  </button>
                  <button type="button" data-testid="trace-raster" disabled={busy} title="Trace a PNG or JPEG into editable paths" onClick={() => void runRasterTrace()}>
                    <span className="command-icon" aria-hidden="true">◇</span><span>Trace Image</span><small>PNG / JPEG</small>
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        {(!guidanceActive || guidance.surface === "preview" || guidance.surface === "output") && (
          <div className="command-group output-command-group">
            <span className="command-group-label">Output</span>
            <div className="command-group-actions">
              {(!guidanceActive || guidance.surface === "output") && (
                <>
                  <button type="button" data-testid="export-svg" disabled={busy} title="Export editable artwork as SVG" onClick={() => void run(() => window.laserx.exportVector({ format: "svg" }))}>Export SVG</button>
                  <button type="button" data-testid="export-dxf" disabled={busy} title="Export editable artwork as DXF" onClick={() => void run(() => window.laserx.exportVector({ format: "dxf" }))}>Export DXF</button>
                </>
              )}
              {(!guidanceActive || guidance.surface === "preview") && (
                <button type="button" data-testid="open-physical-preview" disabled={busy} title="Open a read-only 3D preview of the physical layers" onClick={() => void openPhysicalPreview()}>
                  <span className="command-icon" aria-hidden="true">▦</span><span>3D Preview</span>
                </button>
              )}
            </div>
          </div>
        )}
        <span className="shell-badge">Precision workspace</span>
      </nav>

      <div className="activity-status" role="status" aria-live="polite">
        {busy ? <><span className="loading-spinner" aria-hidden="true" />Working… controls are temporarily unavailable.</> : null}
      </div>

      {state.recovery !== null && (
        <section className="recovery-banner" data-testid="recovery-banner" role="status">
          <div>
            <strong><span aria-hidden="true">↺</span> Recovered work is available</strong>
            <span>
              Autosaved {new Date(state.recovery.capturedAt).toLocaleString()}.
              Your original file has not been overwritten.
            </span>
          </div>
          <div className="recovery-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  window.laserx.resolveRecovery({ action: "recover" }),
                )
              }
            >
              Recover
            </button>
            <button
              type="button"
              className="quiet"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  window.laserx.resolveRecovery({ action: "discard" }),
                )
              }
            >
              Discard
            </button>
          </div>
        </section>
      )}

      {error !== null && (
        <div className="error-strip" role="alert" data-testid="error-message">
          <span><strong>Action could not be completed.</strong> {error}</span>
          <button type="button" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {state.onboarding.recoveryNotice !== null && (
        <div className="guidance-notice" role="status" data-testid="guidance-recovery-notice">
          {state.onboarding.recoveryNotice}
        </div>
      )}

      {guidanceActive && guidanceGoal !== null && guidanceStep !== null && guidance.runToken !== null && (
        <section className="guidance-shell" aria-labelledby="guidance-step-title" data-testid="guidance-shell">
          <div className="guidance-orientation">
            <span className="eyebrow">{guidanceGoal.title}</span>
            <strong>
              Step {String(guidanceStepIndex + 1)} of {String(guidanceGoal.steps.length)}
            </strong>
            <progress max={guidanceGoal.steps.length} value={guidanceStepIndex + 1} />
          </div>
          <div className="guidance-copy">
            <h2 id="guidance-step-title">{guidanceStep.title}</h2>
            <p>{guidanceStep.description}</p>
            {guidanceIsCreateFirstSign && guidanceStep.id === "choose-size-material" && (
              <small data-testid="guidance-outcome-hint">
                Create the real-size document, then assign a physical role, material, and thickness in Layers.
              </small>
            )}
            {guidanceIsCreateFirstSign && guidanceStep.id === "add-content" && (
              <small data-testid="guidance-outcome-hint">
                Add at least one editable object to a physical manufacturing layer.
              </small>
            )}
            {guidanceIsCreateFirstSign && guidanceStep.id === "analyze-cutability" && (
              <small data-testid="guidance-outcome-hint">
                Choose Analyze all. A selection-only or layer-only check cannot complete this checkpoint.
              </small>
            )}
            {guidanceIsCreateFirstSign && guidanceStep.id === "physical-preview" && (
              <small data-testid="guidance-outcome-hint">
                Open 3D Preview. This required checkpoint advances only after a rendered frame or an explicit unavailable result.
              </small>
            )}
            {guidanceIsCreateFirstSign && guidanceStep.id === "save-export" && (
              <small data-testid="guidance-outcome-hint">
                Export SVG or DXF. The goal completes only after the file is written successfully.
              </small>
            )}
            {guidanceIsImportOwnDesign && guidanceStep.id === "choose-file" && (
              <small data-testid="guidance-outcome-hint">
                Choose one artwork file. LaserX will show vector import or raster tracing only after it knows the source type.
              </small>
            )}
            {guidanceIsImportOwnDesign && guidanceStep.id === "prepare-source" && (
              <small data-testid="guidance-outcome-hint">
                {guidedImportSourceKind === "vector"
                  ? "Review real units, stock fit, layers, repairs, and findings, then accept or cancel the vector preview."
                  : "Choose trace settings, create a preview, then accept editable paths or reject the image."}
              </small>
            )}
            {guidanceIsImportOwnDesign && guidanceStep.id === "assign-physical" && (
              <small data-testid="guidance-outcome-hint">
                In Layers, activate an imported layer and assign its physical role, material, and thickness.
              </small>
            )}
            {guidanceIsImportOwnDesign && guidanceStep.id === "analyze-cutability" && (
              <small data-testid="guidance-outcome-hint">
                Choose Analyze all. A selection-only or layer-only check cannot complete this checkpoint.
              </small>
            )}
            {guidanceIsImportOwnDesign && guidanceStep.id === "physical-preview" && (
              <small data-testid="guidance-outcome-hint">
                Open 3D Preview. Continue only after a rendered frame or an explicit unavailable result.
              </small>
            )}
            {guidanceIsImportOwnDesign && guidanceStep.id === "export-result" && (
              <small data-testid="guidance-outcome-hint">
                Export SVG or DXF. This goal completes only after the file is written successfully.
              </small>
            )}
            {guidanceStep.id === "resolve-findings" && !guidedWholeDesignAnalysisReady && (
              <small>Run Analyze all on the current design before continuing.</small>
            )}
          </div>
          <div className="guidance-actions">
            {guidanceStepIndex > 0 && (
              <button
                type="button"
                className="quiet"
                disabled={busy}
                data-testid="guidance-back"
                onClick={() => void run(() => window.laserx.onboardingAction({
                  type: "back",
                  expectedStepId: guidanceStep.id,
                  runToken: guidance.runToken as string,
                }))}
              >
                Back
              </button>
            )}
            {guidanceCanSkip && (
              <button
                type="button"
                className="quiet"
                disabled={busy}
                data-testid="guidance-skip"
                onClick={() => void run(() => window.laserx.onboardingAction({
                  type: "skip",
                  expectedStepId: guidanceStep.id,
                  runToken: guidance.runToken as string,
                }))}
              >
                Skip
              </button>
            )}
            {guidedOutcomeConfirmation !== null && (
              <button
                type="button"
                disabled={
                  busy ||
                  (guidanceStep.id === "resolve-findings" &&
                    !guidedWholeDesignAnalysisReady)
                }
                data-testid="guidance-continue"
                onClick={() => {
                  if (
                    guidanceStep.id === "resolve-findings" &&
                    guidanceResolutionPrimaryAction === "fix-safe-problems"
                  ) {
                    void run(() => window.laserx.previewSafeRepairs());
                    globalThis.document
                      .getElementById("workflow-analyze")
                      ?.scrollIntoView({ behavior: "smooth" });
                    return;
                  }
                  if (
                    guidanceStep.id === "resolve-findings" &&
                    guidanceResolutionPrimaryAction === "review-decisions"
                  ) {
                    globalThis.document
                      .getElementById("workflow-analyze")
                      ?.scrollIntoView({ behavior: "smooth" });
                    return;
                  }
                  void run(() => window.laserx.onboardingAction({
                    type: "advance",
                    expectedStepId: guidanceStep.id,
                    runToken: guidance.runToken as string,
                    completion:
                      guidanceStep.id === "resolve-findings"
                        ? {
                            kind: "resolution",
                            trigger: "user",
                            counts: guidanceResolutionCounts,
                          }
                        : { kind: "step" },
                  }));
                }}
              >
                {guidedOutcomeConfirmation}
              </button>
            )}
            {guidanceStep.id === "resolve-findings" &&
              guidanceResolutionPrimaryAction !== "continue" &&
              canCompleteResolution(guidanceResolutionCounts) && (
                <button
                  type="button"
                  className="quiet"
                  disabled={busy || !guidedWholeDesignAnalysisReady}
                  data-testid="guidance-resolution-continue"
                  onClick={() => void run(() => window.laserx.onboardingAction({
                    type: "advance",
                    expectedStepId: guidanceStep.id,
                    runToken: guidance.runToken as string,
                    completion: {
                      kind: "resolution",
                      trigger: "user",
                      counts: guidanceResolutionCounts,
                    },
                  }))}
                >
                  Continue after review
                </button>
              )}
            <button
              type="button"
              className="guidance-exit"
              disabled={busy}
              data-testid="guidance-exit"
              onClick={() => void run(() => window.laserx.onboardingAction({
                type: "exit",
                runToken: guidance.runToken as string,
              }))}
            >
              Exit guidance
            </button>
          </div>
        </section>
      )}

      <div className="content-grid">
        <aside className="sidebar" aria-label="Workflow tools">
          <nav className="workflow-index" aria-label="Design workflows" data-testid="workflow-navigation">
            <span className="section-label">Workflows</span>
            <div>
              <button type="button" onClick={() => scrollToWorkflow("workflow-create")}>Create</button>
              <button type="button" onClick={() => scrollToWorkflow("workflow-import")}>Import</button>
              <button type="button" onClick={() => scrollToWorkflow("workflow-trace")}>Trace</button>
              <button type="button" onClick={() => scrollToWorkflow("workflow-analyze")}>Analyze</button>
              <button type="button" onClick={() => scrollToWorkflow("workflow-text")}>Text</button>
              <button type="button" onClick={() => scrollToWorkflow("workflow-sign")}>Sign</button>
              <button type="button" onClick={() => scrollToWorkflow("workflow-ai")}>AI</button>
            </div>
          </nav>

          <section id="workflow-project">
            <span className="section-label">Project</span>
            <dl className="project-facts">
              <div>
                <dt>Format</dt>
                <dd>.laserx v7</dd>
              </div>
              <div>
                <dt>Stock</dt>
                <dd data-testid="document-dimensions">
                  {formatDimensions(document)}
                </dd>
              </div>
              <div>
                <dt>Origin</dt>
                <dd>0, 0 mm</dd>
              </div>
            </dl>
          </section>

          <section
            id="workflow-import"
            className="interchange-panel"
            data-testid="interchange-panel"
            hidden={
              guidanceIsImportOwnDesign &&
              guidanceStep?.id !== "choose-file" &&
              !(guidanceStep?.id === "prepare-source" && guidedImportSourceKind === "vector")
            }
          >
            {guidanceIsImportOwnDesign && guidanceStep?.id === "choose-file" ? (
              <>
                <span className="section-label">Choose artwork</span>
                <p className="workflow-description">
                  Start with one SVG, DXF, PNG, or JPEG. LaserX will open the matching preparation tools after selection.
                </p>
                <button
                  type="button"
                  data-testid="select-import-source-panel"
                  disabled={busy}
                  onClick={() => void run(() =>
                    window.laserx.selectImportSource({ unitlessDxfUnit }))}
                >
                  Choose artwork file
                </button>
              </>
            ) : (
              <>
            <span className="section-label">
              {guidanceIsImportOwnDesign ? "Prepare vector artwork" : "Import & export artwork"}
            </span>
            <p className="workflow-description">
              {guidanceIsImportOwnDesign
                ? "Review the vector at real size, choose how it fits the stock, and accept only the paths you want to edit."
                : "Bring SVG or DXF paths into this project, or export current geometry. This does not open a `.laserx` project."}
            </p>
            {(!guidanceIsImportOwnDesign || guidedImportSource?.format === "dxf") && (
            <label>
              Unitless DXF assumption
              <select
                aria-label="Unitless DXF assumption"
                value={unitlessDxfUnit}
                onChange={(event) => {
                  const nextUnit = event.target.value as "millimeters" | "inches";
                  setUnitlessDxfUnit(nextUnit);
                  if (guidanceIsImportOwnDesign) {
                    void run(() => window.laserx.previewVectorImport({
                      unitlessDxfUnit: nextUnit,
                    }));
                  }
                }}
              >
                <option value="millimeters">1 unit = 1 mm</option>
                <option value="inches">1 unit = 1 in</option>
              </select>
            </label>
            )}
            <div className="button-grid compact">
              {!guidanceIsImportOwnDesign && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    window.laserx.previewVectorImport({ unitlessDxfUnit }),
                  )
                }
              >
                Preview import
              </button>
              )}
              {!guidanceActive && (
                <>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(() => window.laserx.exportVector({ format: "svg" }))
                }
              >
                Export SVG
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(() => window.laserx.exportVector({ format: "dxf" }))
                }
              >
                Export DXF
              </button>
                </>
              )}
            </div>
            {state.editor.importPreview !== null && (
              <div className="interchange-summary" data-testid="import-preview-summary">
                <strong>
                  {state.editor.importPreview.sourceName}: {String(state.editor.importPreview.objects.length)} path(s)
                </strong>
                <span>
                  {state.editor.importPreview.format.toUpperCase()} · source {state.editor.importPreview.sourceUnit}
                  {state.editor.importPreview.dimensionsMm === null
                    ? ""
                    : ` · ${state.editor.importPreview.dimensionsMm.widthMm.toFixed(3)} × ${state.editor.importPreview.dimensionsMm.heightMm.toFixed(3)} mm`}
                </span>
                {state.editor.importPreview.assumptions.length > 0 && (
                  <ul>
                    {state.editor.importPreview.assumptions.map((assumption) => (
                      <li key={assumption}>{assumption}</li>
                    ))}
                  </ul>
                )}
                {state.editor.importPreview.partialImport && (
                  <strong data-testid="import-partial-warning">
                    Partial import: {String(state.editor.importPreview.skippedEntityCount)} source {state.editor.importPreview.skippedEntityCount === 1 ? "entity was" : "entities were"} skipped. Review the finding guidance, then cancel or explicitly accept the partial result.
                  </strong>
                )}
                <div className="manufacturing-settings-grid" data-testid="import-stock-fit">
                  <label>
                    Fit artwork to stock
                    <select
                      aria-label="Import stock fitting choice"
                      value={state.editor.importPreview.fitMode}
                      disabled={busy}
                      onChange={(event) => void run(() =>
                        window.laserx.configureVectorImport({
                          fitMode: event.target.value as "resize-stock" | "scale-artwork" | "keep",
                          marginMm: state.editor.importPreview?.marginMm ?? 12.7,
                        }),
                      )}
                    >
                      <option value="resize-stock">Resize stock; keep artwork scale</option>
                      <option value="scale-artwork">Keep stock; scale artwork uniformly</option>
                      <option value="keep">Keep both; allow overflow</option>
                    </select>
                  </label>
                  <label>
                    Margin (mm)
                    <input
                      aria-label="Import stock margin millimeters"
                      type="number"
                      min="0"
                      max="1000"
                      step="0.1"
                      value={state.editor.importPreview.marginMm}
                      disabled={busy}
                      onChange={(event) => void run(() =>
                        window.laserx.configureVectorImport({
                          fitMode: state.editor.importPreview?.fitMode ?? "keep",
                          marginMm: Number(event.target.value),
                        }),
                      )}
                    />
                  </label>
                </div>
                <span data-testid="import-fit-result">
                  Proposed stock {state.editor.importPreview.proposedDocumentDimensionsMm.widthMm.toFixed(3)} × {state.editor.importPreview.proposedDocumentDimensionsMm.heightMm.toFixed(3)} mm
                  {state.editor.importPreview.artworkScale === 1
                    ? " · artwork remains at source scale"
                    : ` · artwork scale ${(state.editor.importPreview.artworkScale * 100).toFixed(2)}%`}
                  {state.editor.importPreview.oversizedAtOriginalScale
                    ? " · original artwork exceeded the current stock"
                    : ""}
                </span>
                {state.editor.importPreview.findings.length > 0 && (
                  <ul data-testid="import-findings">
                    {state.editor.importPreview.findings.map((finding, index) => (
                      <li key={`${finding.code}-${String(index)}`}>
                        <strong>{finding.severity === "repair" ? "Preview repair" : "Import finding"}:</strong>{" "}
                        {finding.message}
                        {finding.repair !== null ? ` (${finding.repair.summary})` : ""}
                        {finding.objectId !== null && (
                          <button
                            type="button"
                            className="quiet"
                            disabled={busy}
                            onClick={() => void run(() => window.laserx.focusVectorImportFinding({
                              objectId: finding.objectId as string,
                            }))}
                          >
                            Locate path
                          </button>
                        )}
                        {finding.objectId === null && finding.repair === null && (
                          <small> No in-document location is available; follow the source-file guidance or cancel the import.</small>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="button-grid compact">
                  <button
                    type="button"
                    data-testid="commit-vector-import"
                    disabled={busy}
                    onClick={() => void run(() => window.laserx.commitVectorImport())}
                  >
                    {state.editor.importPreview.partialImport
                      ? "Accept partial import"
                      : "Accept import"}
                  </button>
                  <button
                    type="button"
                    className="quiet"
                    data-testid="cancel-vector-import"
                    disabled={busy}
                    onClick={() => void run(() => window.laserx.cancelVectorImport())}
                  >
                    Cancel import
                  </button>
                </div>
              </div>
            )}
            {state.interchange.exportSummary !== null && (
              <div className="interchange-summary" data-testid="export-summary">
                <strong>
                  Exported {state.interchange.exportSummary.objectCount} path(s) as {state.interchange.exportSummary.format.toUpperCase()} in millimeters with {state.interchange.exportSummary.warningCount} warning(s).
                </strong>
                {state.interchange.exportSummary.bounds !== null && (
                  <span>
                    Bounds: {state.interchange.exportSummary.bounds.minXmm.toFixed(3)}, {state.interchange.exportSummary.bounds.minYmm.toFixed(3)} to {state.interchange.exportSummary.bounds.maxXmm.toFixed(3)}, {state.interchange.exportSummary.bounds.maxYmm.toFixed(3)} mm
                  </span>
                )}
                {state.interchange.exportSummary.warnings.length > 0 && (
                  <ul>
                    {state.interchange.exportSummary.warnings.map((item, index) => (
                      <li key={`${item.code}-${String(index)}`}>{item.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
              </>
            )}
          </section>

          <section
            id="workflow-trace"
            className="raster-panel"
            data-testid="raster-panel"
            hidden={
              guidanceIsImportOwnDesign &&
              !(guidanceStep?.id === "prepare-source" && guidedImportSourceKind === "raster")
            }
          >
            <span className="section-label">Trace an image</span>
            <p className="workflow-description">Convert a PNG or JPEG into editable vector paths, then review before accepting.</p>
            {guidanceIsImportOwnDesign && guidedImportSource?.kind === "raster" && (
              <div className="interchange-summary" data-testid="selected-raster-source">
                <strong>{guidedImportSource.sourceName}</strong>
                <span>
                  {guidedImportSource.format.toUpperCase()} · {guidedImportSource.widthPx} × {guidedImportSource.heightPx} px
                </span>
                <small>
                  {guidedImportSource.sourceBytes.toLocaleString()} source bytes · {guidedImportSource.decodedBytes.toLocaleString()} decoded bytes
                </small>
              </div>
            )}
            <label>
              Detail preset
              <select
                aria-label="Raster detail preset"
                value={rasterSettings.preset}
                disabled={busy}
                onChange={(event) =>
                  chooseRasterPreset(event.target.value as RasterTracePreset)
                }
              >
                <option value="draft">Draft</option>
                <option value="balanced">Balanced</option>
                <option value="detailed">Detailed</option>
              </select>
            </label>
            <div className="raster-control-grid">
              <label>
                Width (mm)
                <input
                  aria-label="Trace output width millimeters"
                  type="number"
                  min="0.001"
                  max="10000"
                  step="1"
                  value={rasterSettings.outputWidthMm}
                  disabled={busy}
                  onChange={(event) =>
                    setRasterSettings((current) => ({
                      ...current,
                      outputWidthMm: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label>
                Rotate
                <select
                  aria-label="Raster rotation"
                  value={rasterSettings.rotationDeg}
                  disabled={busy}
                  onChange={(event) =>
                    setRasterSettings((current) => ({
                      ...current,
                      rotationDeg: Number(event.target.value) as 0 | 90 | 180 | 270,
                    }))
                  }
                >
                  <option value="0">0Â°</option>
                  <option value="90">90Â°</option>
                  <option value="180">180Â°</option>
                  <option value="270">270Â°</option>
                </select>
              </label>
              {(["left", "top", "right", "bottom"] as const).map((side) => (
                <label key={side}>
                  Crop {side} (%)
                  <input
                    aria-label={`Crop ${side} percent`}
                    type="number"
                    min="0"
                    max="90"
                    step="1"
                    value={Math.round(rasterSettings.crop[side] * 100)}
                    disabled={busy}
                    onChange={(event) =>
                      setRasterSettings((current) => ({
                        ...current,
                        crop: {
                          ...current.crop,
                          [side]: Number(event.target.value) / 100,
                        },
                      }))
                    }
                  />
                </label>
              ))}
              <label>
                Grayscale
                <select
                  aria-label="Grayscale mode"
                  value={rasterSettings.grayscaleMode}
                  disabled={busy}
                  onChange={(event) =>
                    setRasterSettings((current) => ({
                      ...current,
                      grayscaleMode: event.target.value as "luminance" | "average",
                    }))
                  }
                >
                  <option value="luminance">Perceptual</option>
                  <option value="average">Channel average</option>
                </select>
              </label>
              <label>
                Background
                <select
                  aria-label="Raster background"
                  value={rasterSettings.background}
                  disabled={busy}
                  onChange={(event) =>
                    setRasterSettings((current) => ({
                      ...current,
                      background: event.target.value as "auto" | "white" | "black",
                    }))
                  }
                >
                  <option value="auto">Auto</option>
                  <option value="white">White</option>
                  <option value="black">Black</option>
                </select>
              </label>
              {([
                ["Contrast", "contrast", -100, 100, 1],
                ["Threshold", "threshold", 0, 255, 1],
                ["Blur px", "blurRadiusPx", 0, 3, 1],
                ["Denoise px", "denoiseRadiusPx", 0, 2, 1],
                ["Speckle area px", "speckleAreaPx", 0, 100000, 1],
                ["Smoothing", "smoothingPasses", 0, 3, 1],
                ["Simplify mm", "simplificationToleranceMm", 0.001, 10, 0.01],
              ] as const).map(([label, key, min, max, step]) => (
                <label key={key}>
                  {label}
                  <input
                    aria-label={label}
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    value={rasterSettings[key]}
                    disabled={busy}
                    onChange={(event) =>
                      setRasterSettings((current) => ({
                        ...current,
                        [key]: Number(event.target.value),
                      }))
                    }
                  />
                </label>
              ))}
            </div>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={rasterSettings.invert}
                disabled={busy}
                onChange={(event) =>
                  setRasterSettings((current) => ({
                    ...current,
                    invert: event.target.checked,
                  }))
                }
              />
              Invert foreground
            </label>
            <button
              type="button"
              data-testid="start-raster-trace"
              disabled={busy}
              onClick={() => void runRasterTrace()}
            >
              {guidanceIsImportOwnDesign ? "Trace selected image" : "Choose image and trace"}
            </button>
            {guidanceIsImportOwnDesign && state.editor.rasterTracePreview === null && (
              <button
                type="button"
                className="quiet"
                data-testid="cancel-raster-source"
                disabled={busy}
                onClick={() => void run(() => window.laserx.rejectRasterTrace())}
              >
                Cancel selected image
              </button>
            )}
            {state.raster.job !== null && (
              <div className="raster-progress" data-testid="raster-progress">
                <strong>{state.raster.job.stage}</strong>
                <progress max="100" value={state.raster.job.percent} />
                <span>{state.raster.job.percent.toFixed(0)}%</span>
                <button
                  type="button"
                  className="quiet"
                  data-testid="cancel-raster-trace"
                  onClick={() =>
                    void run(() =>
                      window.laserx.cancelRasterTrace({
                        operationId: state.raster.job?.operationId ?? activeRasterOperationId ?? "",
                      }),
                    )
                  }
                >
                  Cancel trace
                </button>
              </div>
            )}
            {state.editor.rasterTracePreview !== null && state.raster.preview !== null && (
              <div className="raster-summary" data-testid="raster-trace-summary">
                <strong>{state.editor.rasterTracePreview.sourceName}</strong>
                <span>
                  {state.editor.rasterTracePreview.summary.pathCount} paths Â· {state.editor.rasterTracePreview.summary.nodeCount} nodes
                </span>
                <span>
                  {state.editor.rasterTracePreview.summary.outputWidthMm.toFixed(2)} Ã— {state.editor.rasterTracePreview.summary.outputHeightMm.toFixed(2)} mm
                </span>
                <span>
                  Smallest segment: {state.editor.rasterTracePreview.summary.smallestFeatureMm?.toFixed(3) ?? "n/a"} mm
                </span>
                <span data-testid="speckle-summary">
                  Removed {state.editor.rasterTracePreview.summary.removedSpeckleCount} island(s), {state.editor.rasterTracePreview.summary.removedSpeckleAreaPx} px below {state.editor.rasterTracePreview.summary.speckleThresholdPx} px
                </span>
                <label>
                  Preview
                  <select
                    aria-label="Raster preview mode"
                    value={rasterPreviewMode}
                    onChange={(event) =>
                      setRasterPreviewMode(
                        event.target.value as typeof rasterPreviewMode,
                      )
                    }
                  >
                    <option value="original">Original</option>
                    <option value="blackWhite">Black / white</option>
                    <option value="edges">Edges</option>
                    <option value="trace">Trace only</option>
                    <option value="overlay">Original + trace</option>
                  </select>
                </label>
                {rasterPreviewMode === "overlay" && (
                  <label>
                    Original opacity
                    <input
                      aria-label="Raster overlay opacity"
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={rasterOverlayOpacity}
                      onChange={(event) =>
                        setRasterOverlayOpacity(Number(event.target.value))
                      }
                    />
                  </label>
                )}
                {state.editor.rasterTracePreview.warnings.length > 0 && (
                  <ul data-testid="raster-warnings">
                    {state.editor.rasterTracePreview.warnings.map((warning, index) => (
                      <li key={`${warning.code}-${String(index)}`}>{warning.message}</li>
                    ))}
                  </ul>
                )}
                <div className="button-grid compact">
                  <button
                    type="button"
                    data-testid="accept-raster-trace"
                    disabled={busy}
                    onClick={() => void run(() => window.laserx.acceptRasterTrace())}
                  >
                    Accept editable paths
                  </button>
                  <button
                    type="button"
                    className="quiet"
                    data-testid="reject-raster-trace"
                    disabled={busy}
                    onClick={() => void run(() => window.laserx.rejectRasterTrace())}
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}
          </section>

          <section id="workflow-analyze" className="manufacturing-panel" data-testid="manufacturing-panel">
            <span className="section-label">Check manufacturability</span>
            <p className="manufacturing-disclaimer">
              Guidance from editable values—not a certification of machine safety or part quality.
            </p>
            <label>
              Starting preset
              <select
                aria-label="Manufacturing preset"
                value={manufacturingSettings.presetId}
                disabled={busy}
                onChange={(event) => chooseManufacturingPreset(event.target.value)}
              >
                {MANUFACTURING_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.name}</option>
                ))}
              </select>
            </label>
            <div className="manufacturing-settings-grid">
              <label>
                U.S. stock thickness
                <select
                  aria-label="Stock thickness designation"
                  value={selectedManufacturingThicknessChoice}
                  disabled={busy}
                  onChange={(event) => {
                    const choice = manufacturingThicknessChoices.find(
                      (candidate) => candidate.id === event.target.value,
                    );
                    setManufacturingSettings((current) => ({
                      ...current,
                      ...(choice === undefined
                        ? {
                            stockThicknessDesignation: {
                              kind: "custom" as const,
                              label: "Custom",
                              material: null,
                            },
                          }
                        : {
                            thicknessMm: choice.thicknessMm,
                            stockThicknessDesignation: { ...choice.designation },
                          }),
                      customizedFields: [...new Set([
                        ...current.customizedFields,
                        "thicknessMm" as const,
                        "stockThicknessDesignation" as const,
                      ])],
                    }));
                  }}
                >
                  <optgroup label="Material-specific gauges">
                    {manufacturingThicknessChoices.filter((choice) => choice.designation.kind === "gauge").map((choice) => (
                      <option key={choice.id} value={choice.id}>{choice.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Fractional plate">
                    {manufacturingThicknessChoices.filter((choice) => choice.designation.kind === "fractional-inch").map((choice) => (
                      <option key={choice.id} value={choice.id}>{choice.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Millimeters">
                    {manufacturingThicknessChoices.filter((choice) => choice.designation.kind === "millimeter").map((choice) => (
                      <option key={choice.id} value={choice.id}>{choice.label}</option>
                    ))}
                  </optgroup>
                  <option value="custom">Custom thickness</option>
                </select>
              </label>
              <label>
                Custom thickness ({stockThicknessInputUnit})
                <input
                  aria-label={`Thickness ${unit}`}
                  type="number"
                  min="0.001"
                  step={unit === "inches" ? "0.0001" : "0.001"}
                  value={stockThicknessForDisplay(manufacturingSettings.thicknessMm)}
                  disabled={busy}
                  onChange={(event) => setManufacturingSettings((current) => ({
                    ...current,
                    thicknessMm: stockThicknessFromDisplay(Number(event.target.value)),
                    stockThicknessDesignation: {
                      kind: "custom",
                      label: "Custom",
                      material: null,
                    },
                    customizedFields: [...new Set([
                      ...current.customizedFields,
                      "thicknessMm" as const,
                      "stockThicknessDesignation" as const,
                    ])],
                  }))}
                />
              </label>
              <span data-testid="manufacturing-stock-thickness-summary">
                {formatStockThickness(
                  manufacturingSettings.thicknessMm,
                  manufacturingSettings.stockThicknessDesignation,
                )}
              </span>
              {([
                ["Kerf", "kerfWidthMm"],
                ["Min feature", "minimumFeatureWidthMm"],
                ["Min bridge", "minimumBridgeWidthMm"],
                ["Min gap", "minimumGapMm"],
                ["Contour spacing", "contourSpacingMm"],
              ] as const).map(([label, field]) => (
                <label key={field}>
                  {label} (mm)
                  <input
                    aria-label={`${label} millimeters`}
                    type="number"
                    min="0.001"
                    step="0.1"
                    value={manufacturingSettings[field]}
                    disabled={busy}
                    onChange={(event) =>
                      updateManufacturingField(field, Number(event.target.value))
                    }
                  />
                </label>
              ))}
              <label>
                Heat spacing (mm)
                <input
                  aria-label="Heat distortion spacing millimeters"
                  type="number"
                  min="0.001"
                  step="0.1"
                  placeholder="Optional"
                  value={manufacturingSettings.heatDistortionSpacingMm ?? ""}
                  disabled={busy}
                  onChange={(event) =>
                    updateManufacturingField(
                      "heatDistortionSpacingMm",
                      event.target.value === "" ? null : Number(event.target.value),
                    )
                  }
                />
              </label>
            </div>
            <span className="preset-transparency" data-testid="preset-transparency">
              {manufacturingSettings.customizedFields.length === 0
                ? "Using preset values"
                : `Edited: ${manufacturingSettings.customizedFields.join(", ")}`}
            </span>
            <div className="button-grid compact">
              <button
                type="button"
                data-testid="apply-manufacturing-settings"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    window.laserx.setManufacturingSettings({
                      settings: manufacturingSettings,
                    }),
                  )
                }
              >
                Apply settings
              </button>
              <button
                type="button"
                data-testid="run-cutability-analysis"
                disabled={busy || document.objects.length === 0}
                onClick={() => void runCutability([])}
              >
                Analyze all
              </button>
              <button
                type="button"
                data-testid="run-selection-cutability-analysis"
                hidden={
                  guidanceIsCreateFirstSign &&
                  (guidanceStep?.id === "analyze-cutability" ||
                    guidanceStep?.id === "resolve-findings")
                }
                disabled={busy || state.editor.selectionIds.length === 0}
                onClick={() => void runCutability(state.editor.selectionIds)}
              >
                Analyze selection
              </button>
            </div>
            {state.analysis.job !== null && (
              <div className="analysis-progress" data-testid="cutability-progress">
                <strong>{state.analysis.job.stage}</strong>
                <progress max="100" value={state.analysis.job.percent} />
                <button
                  type="button"
                  className="quiet"
                  data-testid="cancel-cutability-analysis"
                  onClick={() =>
                    void window.laserx.cancelCutabilityAnalysis({
                      operationId:
                        state.analysis.job?.operationId ??
                        activeCutabilityOperationId ??
                        "",
                    })
                  }
                >
                  Cancel analysis
                </button>
              </div>
            )}
            {cutability !== null && (
              <div className="cutability-summary" data-testid="cutability-analysis">
                <strong>
                  {cutability.status === "ambiguous" ? "Ambiguous preview" : "Analysis complete"}
                </strong>
                <span data-testid="cutability-summary">
                  {cutability.errorCount} error(s) · {cutability.warningCount} warning(s) · cut-ready claim: no
                </span>
                <span data-testid="cutability-scope">
                  {state.analysis.scope?.kind === "manufacturing-layer"
                    ? `Physical layer: ${state.analysis.scope.layerName}`
                    : state.analysis.scope?.kind === "selection"
                      ? "Selection analysis"
                      : state.analysis.scope?.kind === "whole-design"
                        ? "Whole-design analysis"
                        : "Analysis scope unavailable"}
                  {" · "}{cutability.analyzedObjectIds.length} object(s)
                </span>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={manufacturingPreviewVisible}
                    onChange={(event) => setManufacturingPreviewVisible(event.target.checked)}
                  />
                  Show retained / removed preview
                </label>
                <label>
                  Issue filter
                  <select
                    aria-label="Manufacturing issue severity"
                    value={issueSeverityFilter}
                    onChange={(event) =>
                      setIssueSeverityFilter(event.target.value as typeof issueSeverityFilter)
                    }
                  >
                    <option value="all">All</option>
                    <option value="error">Errors</option>
                    <option value="warning">Warnings</option>
                  </select>
                </label>
                {repairGroups !== null && (
                  <div className="repair-groups" data-testid="repair-groups">
                    <div className="repair-group-actions">
                      <span>
                        Near-closure tolerance: {repairGroups.tolerances.nearClosureMm.toFixed(3)} mm. Zero-length and collinear tolerance: {repairGroups.tolerances.collinearMm.toFixed(6)} mm.
                      </span>
                      {repairGroups.safeToFix.findingCount > 0 &&
                        state.analysis.safeRepairProposal === null && (
                          <button
                            type="button"
                            data-testid="preview-safe-repairs"
                            disabled={busy}
                            onClick={() =>
                              void run(() => window.laserx.previewSafeRepairs())
                            }
                          >
                            Fix safe problems
                          </button>
                        )}
                    </div>
                    {repairFindingGroups.map((group) => (
                      <section
                        className={`repair-finding-group ${group.id}`}
                        data-repair-group={group.id}
                        key={group.id}
                      >
                        <div className="repair-finding-group-heading">
                          <strong>{group.label}</strong>
                          <span>
                            {group.findingCount} finding(s) · {group.affectedObjectCount} object(s)
                          </span>
                        </div>
                        <p>{group.description}</p>
                        {group.issues.length === 0 ? (
                          <small>No findings in the current severity filter.</small>
                        ) : (
                          <ul className="cutability-issues">
                            {group.issues.slice(0, 6).map((issue) => (
                              <li key={issue.id}>
                                <button
                                  type="button"
                                  className={state.analysis.focusedIssueId === issue.id ? "active" : ""}
                                  data-issue-code={issue.code}
                                  onClick={() =>
                                    void run(() =>
                                      window.laserx.focusCutabilityIssue({ issueId: issue.id }),
                                    )
                                  }
                                >
                                  <strong>{issue.code.replaceAll("_", " ")}</strong>
                                  <span>{issue.message}</span>
                                  <small>
                                    {issue.measuredValueMm.toFixed(3)} mm measured / {issue.configuredLimitMm.toFixed(3)} mm limit
                                  </small>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        {group.issues.length > 6 && (
                          <small data-testid={`repair-group-overflow-${group.id}`}>
                            {group.issues.length - 6} more finding(s) summarized in this group.
                          </small>
                        )}
                      </section>
                    ))}
                  </div>
                )}
                {state.analysis.safeRepairProposal !== null && (
                  <div className="bridge-preview-summary" data-testid="safe-repair-preview">
                    <strong>{state.analysis.safeRepairProposal.summary}</strong>
                    <span>{state.analysis.safeRepairProposal.disclaimer}</span>
                    <ul>
                      {state.analysis.safeRepairProposal.changes.slice(0, 6).map((change) => (
                        <li key={`${change.kind}:${change.objectId}`}>
                          {change.description} ({change.findingCount} finding(s))
                        </li>
                      ))}
                    </ul>
                    <div className="button-grid compact">
                      <button
                        type="button"
                        data-testid="accept-safe-repairs"
                        disabled={busy}
                        onClick={() => void run(() => window.laserx.acceptSafeRepairs())}
                      >
                        Accept safe repairs
                      </button>
                      <button
                        type="button"
                        className="quiet"
                        data-testid="reject-safe-repairs"
                        disabled={busy}
                        onClick={() => void run(() => window.laserx.rejectSafeRepairs())}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}
                {state.analysis.safeRepairResult !== null && (
                  <div className="repair-result" data-testid="safe-repair-result">
                    <strong>{state.analysis.safeRepairResult.summary}</strong>
                    <span>{state.analysis.safeRepairResult.disclaimer}</span>
                  </div>
                )}
                {focusedCutabilityIssue?.code === "DISCONNECTED_ISLAND" && (
                  <div className="bridge-controls" data-testid="bridge-controls">
                    <label>
                      Manual direction
                      <select
                        aria-label="Manual bridge direction"
                        value={bridgeDirection}
                        onChange={(event) =>
                          setBridgeDirection(event.target.value as typeof bridgeDirection)
                        }
                      >
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                        <option value="up">Up</option>
                        <option value="down">Down</option>
                      </select>
                    </label>
                    <div className="button-grid compact">
                      <button
                        type="button"
                        data-testid="preview-manual-bridge"
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            window.laserx.previewBridge({
                              issueId: focusedCutabilityIssue.id,
                              widthMm: manufacturingSettings.minimumBridgeWidthMm,
                              mode: "manual",
                              direction: bridgeDirection,
                            }),
                          )
                        }
                      >
                        Preview manual
                      </button>
                      <button
                        type="button"
                        data-testid="preview-auto-bridge"
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            window.laserx.previewBridge({
                              issueId: focusedCutabilityIssue.id,
                              widthMm: manufacturingSettings.minimumBridgeWidthMm,
                              mode: "automatic",
                            }),
                          )
                        }
                      >
                        Preview auto
                      </button>
                    </div>
                  </div>
                )}
                {state.analysis.bridgeProposal !== null && (
                  <div className="bridge-preview-summary" data-testid="bridge-preview-summary">
                    <strong>{state.analysis.bridgeProposal.summary}</strong>
                    <span>Original geometry is unchanged until accepted.</span>
                    <div className="button-grid compact">
                      <button
                        type="button"
                        data-testid="accept-bridge"
                        disabled={busy}
                        onClick={() => void run(() => window.laserx.acceptBridge())}
                      >
                        Accept bridge
                      </button>
                      <button
                        type="button"
                        className="quiet"
                        data-testid="reject-bridge"
                        disabled={busy}
                        onClick={() => void run(() => window.laserx.rejectBridge())}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}
                <p className="preview-assumption">{cutability.previewAssumption}</p>
              </div>
            )}
          </section>

          <section id="workflow-create">
            <span className="section-label">Create basic shapes</span>
            <p className="workflow-description">Add precise editable geometry to the active layer.</p>
            <div className="button-grid">
              {(["line", "rectangle", "ellipse"] as const).map(
                (objectType) => (
                  <button
                    type="button"
                    key={objectType}
                    data-testid={`add-${objectType}`}
                    onClick={() =>
                      dispatchEditorAction({
                        type: "object.create",
                        objectType,
                      })
                    }
                  >
                    {objectType}
                  </button>
                ),
              )}
            </div>
          </section>

          <div id="workflow-text" className="workflow-anchor">
            <TextPanel state={state} busy={busy} run={run} />
          </div>

          <div id="workflow-sign" className="workflow-anchor">
            <SignToolsPanel state={state} busy={busy} run={run} />
          </div>

          <div id="workflow-ai" className="workflow-anchor">
            <AiGenerationPanel state={state} busy={busy} run={run} />
          </div>

          <section id="workflow-document">
            <span className="section-label">New exact document</span>
            <form className="document-form" onSubmit={createExactDocument}>
              <label>
                Width
                <input
                  aria-label="Document width"
                  type="number"
                  min="0.001"
                  step="any"
                  required
                  value={width}
                  onChange={(event) => setWidth(event.target.value)}
                />
              </label>
              <label>
                Height
                <input
                  aria-label="Document height"
                  type="number"
                  min="0.001"
                  step="any"
                  required
                  value={height}
                  onChange={(event) => setHeight(event.target.value)}
                />
              </label>
              <label>
                Input units
                <select
                  aria-label="Document input units"
                  value={inputUnit}
                  onChange={(event) =>
                    setInputUnit(
                      event.target.value as "millimeters" | "inches",
                    )
                  }
                >
                  <option value="millimeters">millimeters</option>
                  <option value="inches">inches</option>
                </select>
              </label>
              <button type="submit" data-testid="create-document" disabled={busy}>
                Create document
              </button>
            </form>
          </section>

          <section id="workflow-display">
            <span className="section-label">Display units</span>
            <div className="segmented" aria-label="Display units">
              {(["millimeters", "inches"] as const).map((displayUnit) => (
                <button
                  type="button"
                  key={displayUnit}
                  className={
                    document.settings.displayUnit === displayUnit
                      ? "active"
                      : ""
                  }
                  aria-pressed={
                    document.settings.displayUnit === displayUnit
                  }
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      window.laserx.setDisplayUnit({ displayUnit }),
                    )
                  }
                >
                  {displayUnit === "millimeters" ? "mm" : "in"}
                </button>
              ))}
            </div>
          </section>

          <section id="workflow-viewport">
            <span className="section-label">Viewport & snapping</span>
            <div className="preference-list">
              {([
                ["rulersVisible", "Rulers"],
                ["gridVisible", "Grid"],
              ] as const).map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={
                      viewportPreferences[key]
                    }
                    onChange={(event) =>
                      void run(() =>
                        window.laserx.setViewportPreferences({
                          [key]: event.target.checked,
                        }),
                      )
                    }
                  />
                  {label}
                </label>
              ))}
              <label>
                Grid spacing
                <span className="inline-input">
                  <input
                    aria-label="Grid spacing"
                    type="number"
                    min="0.001"
                    step="any"
                    value={gridSpacing}
                    onChange={(event) => setGridSpacing(event.target.value)}
                    onBlur={() => {
                      const value = Number(gridSpacing);
                      if (Number.isFinite(value) && value > 0) {
                        void run(() =>
                          window.laserx.setViewportPreferences({
                            gridSpacingMm: gridSpacingToMillimeters(
                              value,
                              unit,
                            ),
                          }),
                        );
                      }
                    }}
                  />
                  <span>{unitLabel}</span>
                </span>
              </label>
              {([
                ["enabled", "Enable snapping", "snappingEnabled"],
                ["snapToGrid", "Grid", "snapToGrid"],
                ["snapToGuides", "Guides", "snapToGuides"],
                ["snapToObjects", "Object bounds / centers", "snapToObjects"],
                ["snapToDocument", "Stock bounds / center", "snapToDocument"],
              ] as const).map(([preference, label, requestKey]) => (
                <label key={preference}>
                  <input
                    type="checkbox"
                    checked={
                      viewportPreferences.snapping[preference]
                    }
                    onChange={(event) =>
                      void run(() =>
                        window.laserx.setViewportPreferences({
                          [requestKey]: event.target.checked,
                        }),
                      )
                    }
                  />
                  Snap: {label}
                </label>
              ))}
            </div>
          </section>

          <section className="recent-section">
            <span className="section-label">Recent projects</span>
            {state.recentProjects.length === 0 ? (
              <p className="empty-recent">Saved projects will appear here.</p>
            ) : (
              <ul>
                {state.recentProjects.map((recent) => (
                  <li key={recent.filePath}>
                    <button
                      type="button"
                      disabled={busy}
                      title={recent.filePath}
                      onClick={() =>
                        void run(() =>
                          window.laserx.openRecent({
                            filePath: recent.filePath,
                          }),
                        )
                      }
                    >
                      <span>{recent.name}</span>
                      <small>{recent.filePath}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        <main className="workspace" id="design-workspace" tabIndex={-1}>
          <Viewport
            document={document}
            selectionIds={selectionIds}
            selectionBounds={selectionBounds}
            pathSelection={pathSelection}
            importPreview={
              state.editor.importPreview ??
              state.editor.rasterTracePreview ??
              state.editor.signToolPreview ??
              state.editor.aiConceptPreview
            }
            importPreviewFitKey={
              state.editor.importPreview === null
                ? null
                : `${state.editor.importPreview.sourceName}:${state.editor.importPreview.fitMode}:${String(state.editor.importPreview.marginMm)}`
            }
            previewGeometryVisible={
              state.editor.rasterTracePreview === null ||
              rasterPreviewMode === "trace" ||
              rasterPreviewMode === "overlay"
            }
            rasterBackground={
              state.editor.rasterTracePreview === null ||
              state.raster.preview === null ||
              rasterPreviewMode === "trace"
                ? null
                : {
                    dataUrl:
                      rasterPreviewMode === "blackWhite"
                        ? state.raster.preview.blackWhite
                        : rasterPreviewMode === "edges"
                          ? state.raster.preview.edges
                          : state.raster.preview.original,
                    widthMm:
                      state.editor.rasterTracePreview.summary.outputWidthMm,
                    heightMm:
                      state.editor.rasterTracePreview.summary.outputHeightMm,
                    opacity:
                      rasterPreviewMode === "overlay"
                        ? rasterOverlayOpacity
                        : 1,
                  }
            }
            manufacturingPreview={
              cutability === null || !manufacturingPreviewVisible
                ? null
                : {
                    regions: cutability.regions.map((region) => ({
                      id: region.id,
                      disposition: region.disposition,
                      points: region.points,
                    })),
                    focusedIssueLocation:
                      focusedCutabilityIssue?.location ?? null,
                    bridgePolygon:
                      state.analysis.bridgeProposal?.bridgePolygon ?? null,
                  }
            }
            onEditorAction={dispatchEditorAction}
          />
          {showGoalChooser && (
            <section className="goal-chooser" aria-labelledby="goal-chooser-title" data-testid="goal-chooser">
              <img src="./laserx-mark.svg" alt="" />
              <span className="eyebrow">Welcome to LaserX</span>
              <h1 id="goal-chooser-title">What would you like to make?</h1>
              <p>Choose a goal. LaserX will keep the important controls in view and save your place.</p>
              {showResumeGuidance && state.onboarding.preferences.activeWorkflow !== null && (
                <button
                  type="button"
                  className="resume-guidance"
                  disabled={busy}
                  data-testid="resume-guidance"
                  onClick={() => void run(() => window.laserx.onboardingAction({ type: "resume" }))}
                >
                  Resume {guidedGoal(state.onboarding.preferences.activeWorkflow.goal).title}
                </button>
              )}
              <div className="goal-options">
                {([
                  "create-first-sign",
                  "import-own-design",
                  "describe-with-ai",
                ] as const).map((goalId) => {
                  const option = guidedGoal(goalId);
                  const unavailable =
                    goalId === "describe-with-ai" &&
                    state.ai.connection.status !== "connected";
                  return (
                    <button
                      type="button"
                      key={goalId}
                      disabled={busy || unavailable}
                      data-testid={`start-${goalId}`}
                      onClick={() => void run(() => window.laserx.onboardingAction({
                        type: "start",
                        goal: goalId,
                      }))}
                    >
                      <strong>{option.title}</strong>
                      <span>{option.description}</span>
                      {unavailable && <small>Optional — connect AI to use this path.</small>}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
          {showResumeGuidance &&
            !showGoalChooser &&
            state.onboarding.preferences.activeWorkflow !== null && (
              <section
                className="resume-guidance-card"
                aria-labelledby="resume-guidance-title"
                data-testid="resume-guidance-card"
              >
                <span className="eyebrow">Saved guidance</span>
                <h2 id="resume-guidance-title">
                  Continue where you left off
                </h2>
                <p>
                  Resume {guidedGoal(state.onboarding.preferences.activeWorkflow.goal).title} against this exact project.
                </p>
                <button
                  type="button"
                  className="resume-guidance"
                  disabled={busy}
                  data-testid="resume-guidance"
                  onClick={() => void run(() => window.laserx.onboardingAction({ type: "resume" }))}
                >
                  Resume guidance
                </button>
              </section>
            )}
          {workspaceIsEmpty && !showGoalChooser && !guidanceActive && (
            <section className="workspace-welcome" aria-labelledby="workspace-welcome-title" data-testid="workspace-welcome">
              <img src="./laserx-mark.svg" alt="" />
              <span className="eyebrow">Ready to design</span>
              <h1 id="workspace-welcome-title">Start with a project or artwork</h1>
              <p>Open a LaserX project, import vector artwork, trace an image, or build directly on the stock.</p>
              <div className="welcome-actions">
                <button type="button" disabled={busy} onClick={() => void run(() => window.laserx.openProject())}>Open Project <small>.laserx</small></button>
                <button type="button" disabled={busy} onClick={() => void run(() => window.laserx.previewVectorImport({ unitlessDxfUnit }))}>Import Artwork <small>SVG / DXF</small></button>
                <button type="button" disabled={busy} onClick={() => void runRasterTrace()}>Trace Image <small>PNG / JPEG</small></button>
                <button type="button" className="quiet" onClick={() => scrollToWorkflow("workflow-create")}>Create a shape</button>
              </div>
            </section>
          )}
          {physicalPreviewOpen && (
            <div className="physical-preview-overlay" data-testid="physical-preview-overlay">
              {state.physicalPreview.job !== null ? (
                <div className="analysis-progress" data-testid="physical-preview-progress">
                  <strong>{state.physicalPreview.job.stage}</strong>
                  <progress max="100" value={state.physicalPreview.job.percent} />
                  <button
                    type="button"
                    className="quiet"
                    data-testid="cancel-physical-preview"
                    onClick={closePhysicalPreview}
                  >
                    Cancel
                  </button>
                </div>
              ) : state.physicalPreview.assembly !== null ? (
                <PhysicalPreviewErrorBoundary
                  onClose={closePhysicalPreview}
                  {...(guidedPhysicalPreviewIdentity === null
                    ? {}
                    : {
                        onUnavailable: () =>
                          void reportGuidedPhysicalPreviewOutcome(
                            guidedPhysicalPreviewIdentity.expectedStepId,
                            guidedPhysicalPreviewIdentity.runToken,
                            {
                              kind: "physical-preview",
                              result: "unavailable",
                              reason: "preview-crashed",
                              assemblyFingerprint:
                                state.physicalPreview.assembly?.fingerprint ?? null,
                            },
                          ),
                      })}
                >
                  <Suspense
                    fallback={
                      <div className="analysis-progress" data-testid="physical-preview-chunk-loading">
                        <span className="loading-spinner" aria-hidden="true" />
                        <strong>Loading the 3D preview…</strong>
                      </div>
                    }
                  >
                    <PhysicalPreviewScreenLazy
                      assembly={state.physicalPreview.assembly}
                      onClose={closePhysicalPreview}
                      onCapture={savePhysicalPreviewCapture}
                      captureStatus={state.physicalPreview.capture}
                      projectName={state.project.name}
                      {...(guidedPhysicalPreviewIdentity === null
                        ? {}
                        : {
                            onRenderConfirmed: () =>
                              void reportGuidedPhysicalPreviewOutcome(
                                guidedPhysicalPreviewIdentity.expectedStepId,
                                guidedPhysicalPreviewIdentity.runToken,
                                {
                                  kind: "physical-preview",
                                  result: "rendered",
                                  assemblyFingerprint:
                                    state.physicalPreview.assembly?.fingerprint ?? "",
                                },
                              ),
                            onUnavailable: (
                              reason:
                                | "assembly-unavailable"
                                | "conversion-failed"
                                | "context-lost"
                                | "no-renderable-geometry"
                                | "webgl-unavailable",
                            ) =>
                              void reportGuidedPhysicalPreviewOutcome(
                                guidedPhysicalPreviewIdentity.expectedStepId,
                                guidedPhysicalPreviewIdentity.runToken,
                                {
                                  kind: "physical-preview",
                                  result: "unavailable",
                                  reason,
                                  assemblyFingerprint:
                                    state.physicalPreview.assembly?.fingerprint ?? null,
                                },
                              ),
                          })}
                    />
                  </Suspense>
                </PhysicalPreviewErrorBoundary>
              ) : (
                <div className="physical-preview-fallback" role="status" data-testid="physical-preview-empty">
                  <h2>3D preview unavailable</h2>
                  <p>The physical preview could not be generated. Nothing in the project was changed.</p>
                  {guidedPhysicalPreviewIdentity !== null && physicalPreviewBuildFailed ? (
                    <button
                      type="button"
                      data-testid="physical-preview-acknowledge-build-failure"
                      onClick={() =>
                        void reportGuidedPhysicalPreviewOutcome(
                          guidedPhysicalPreviewIdentity.expectedStepId,
                          guidedPhysicalPreviewIdentity.runToken,
                          {
                            kind: "physical-preview",
                            result: "unavailable",
                            reason: "build-failed",
                            assemblyFingerprint: null,
                          },
                        )
                      }
                    >
                      Continue with 3D unavailable
                    </button>
                  ) : (
                    <button type="button" onClick={closePhysicalPreview}>
                      Close
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </main>

        <aside className="sidebar editing-sidebar" aria-label="Editing tools">
          <nav className="workflow-index editing-index" aria-label="Editing workflows">
            <span className="section-label">Edit</span>
            <div>
              <button type="button" onClick={() => scrollToWorkflow("edit-selection")}>Select</button>
              <button type="button" onClick={() => scrollToWorkflow("edit-geometry")}>Geometry</button>
              <button type="button" onClick={() => scrollToWorkflow("edit-transform")}>Transform</button>
              <button type="button" onClick={() => scrollToWorkflow("edit-layers")}>Layers</button>
            </div>
          </nav>
          <section id="edit-selection">
            <span className="section-label">Selection</span>
            <p className="selection-summary" data-testid="selection-count">
              {selectionIds.length === 0
                ? "No objects selected"
                : `${String(selectionIds.length)} object${selectionIds.length === 1 ? "" : "s"} selected`}
            </p>
            <div className="button-grid compact">
              <button
                type="button"
                disabled={selectionIds.length === 0}
                onClick={() =>
                  dispatchEditorAction({
                    type: "objects.duplicate-selection",
                  })
                }
              >
                Duplicate
              </button>
              <button
                type="button"
                disabled={selectionIds.length === 0}
                onClick={() =>
                  dispatchEditorAction({
                    type: "objects.delete",
                    objectIds: selectionIds,
                  })
                }
              >
                Delete
              </button>
              <button
                type="button"
                disabled={selectionIds.length < 2}
                onClick={() =>
                  dispatchEditorAction({
                    type: "objects.group-selection",
                  })
                }
              >
                Group
              </button>
              <button
                type="button"
                disabled={selectionIds.length === 0}
                onClick={() =>
                  dispatchEditorAction({
                    type: "objects.ungroup",
                    objectIds: selectionIds,
                  })
                }
              >
                Ungroup
              </button>
            </div>
          </section>

          <section id="edit-geometry" data-testid="geometry-panel">
            <span className="section-label">Node & geometry editing</span>
            <div className="button-grid compact">
              {pathSelection === null ? (
                <button
                  type="button"
                  data-testid="edit-path-nodes"
                  disabled={busy || selectedPath === undefined}
                  onClick={() => {
                    if (selectedPath !== undefined) {
                      dispatchEditorAction({
                        type: "selection.path-edit",
                        objectId: selectedPath.id,
                      });
                    }
                  }}
                >
                  Edit nodes
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    dispatchEditorAction({ type: "selection.path-clear" })
                  }
                >
                  Done editing
                </button>
              )}
              <button
                type="button"
                data-testid="add-path-node"
                disabled={
                  busy ||
                  pathSelection === null ||
                  pathSelection.segmentIndices.length !== 1
                }
                onClick={() => {
                  const segmentIndex = pathSelection?.segmentIndices[0];
                  if (pathSelection !== null && segmentIndex !== undefined) {
                    dispatchEditorAction({
                      type: "path.add-node",
                      objectId: pathSelection.objectId,
                      segmentIndex,
                      ratio: 0.5,
                    });
                  }
                }}
              >
                Add node
              </button>
              <button
                type="button"
                data-testid="delete-path-nodes"
                disabled={
                  busy ||
                  pathSelection === null ||
                  pathSelection.nodeIndices.length === 0
                }
                onClick={() => {
                  if (pathSelection !== null) {
                    dispatchEditorAction({
                      type: "path.delete-nodes",
                      objectId: pathSelection.objectId,
                      nodeIndices: pathSelection.nodeIndices,
                    });
                  }
                }}
              >
                Delete nodes
              </button>
              <button
                type="button"
                disabled={busy || selectedPath === undefined}
                onClick={() => {
                  if (selectedPath !== undefined) {
                    dispatchEditorAction({
                      type: "path.set-closed",
                      objectId: selectedPath.id,
                      closed: !selectedPath.closed,
                    });
                  }
                }}
              >
                {selectedPath?.closed === true ? "Open path" : "Close path"}
              </button>
              <button
                type="button"
                disabled={busy || selectedPath === undefined}
                onClick={() => {
                  if (selectedPath !== undefined) {
                    dispatchEditorAction({
                      type: "path.reverse",
                      objectId: selectedPath.id,
                    });
                  }
                }}
              >
                Reverse
              </button>
              <button
                type="button"
                data-testid="split-path"
                disabled={
                  busy ||
                  selectedPath?.closed !== false ||
                  pathSelection?.nodeIndices.length !== 1
                }
                onClick={() =>
                  dispatchEditorAction({ type: "path.split-selected" })
                }
              >
                Split path
              </button>
            </div>

            <p className="selection-summary">
              {pathSelection === null
                ? "Select one path, then edit its nodes."
                : `${String(pathSelection.nodeIndices.length)} node${pathSelection.nodeIndices.length === 1 ? "" : "s"} · ${String(pathSelection.segmentIndices.length)} segment${pathSelection.segmentIndices.length === 1 ? "" : "s"}`}
            </p>

            <div className="button-grid compact">
              <button
                type="button"
                disabled={busy || pathSelection?.nodeIndices.length !== 1}
                onClick={() => setSelectedNodeHandle("incoming", false)}
              >
                + In handle
              </button>
              <button
                type="button"
                disabled={busy || pathSelection?.nodeIndices.length !== 1}
                onClick={() => setSelectedNodeHandle("outgoing", false)}
              >
                + Out handle
              </button>
              <button
                type="button"
                disabled={busy || pathSelection?.nodeIndices.length !== 1}
                onClick={() => setSelectedNodeHandle("incoming", true)}
              >
                − In handle
              </button>
              <button
                type="button"
                disabled={busy || pathSelection?.nodeIndices.length !== 1}
                onClick={() => setSelectedNodeHandle("outgoing", true)}
              >
                − Out handle
              </button>
            </div>

            <div className="geometry-setting-row">
              <label>
                Simplify tolerance (mm)
                <input
                  type="number"
                  min="0.000001"
                  step="any"
                  value={simplifyTolerance}
                  onChange={(event) => setSimplifyTolerance(event.target.value)}
                />
              </label>
              <button
                type="button"
                data-testid="simplify-path"
                disabled={busy || selectedPath === undefined}
                onClick={() => {
                  const toleranceMm = Number(simplifyTolerance);
                  if (selectedPath !== undefined && toleranceMm > 0) {
                    dispatchEditorAction({
                      type: "path.simplify",
                      objectId: selectedPath.id,
                      toleranceMm,
                    });
                  }
                }}
              >
                Simplify
              </button>
            </div>

            <div className="geometry-setting-row">
              <label>
                Cleanup tolerance (mm)
                <input
                  type="number"
                  min="0.000001"
                  step="any"
                  value={cleanupTolerance}
                  onChange={(event) => setCleanupTolerance(event.target.value)}
                />
              </label>
              <button
                type="button"
                data-testid="cleanup-path"
                disabled={busy || selectedPath === undefined}
                onClick={() => {
                  const toleranceMm = Number(cleanupTolerance);
                  if (selectedPath !== undefined && toleranceMm > 0) {
                    dispatchEditorAction({
                      type: "path.cleanup",
                      objectId: selectedPath.id,
                      toleranceMm,
                    });
                  }
                }}
              >
                Clean
              </button>
            </div>

            <div className="geometry-setting-row">
              <label>
                Join tolerance (mm)
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={joinTolerance}
                  onChange={(event) => setJoinTolerance(event.target.value)}
                />
              </label>
              <button
                type="button"
                data-testid="join-paths"
                disabled={
                  busy ||
                  selectedPaths.length !== 2 ||
                  selectedPaths.some((path) => path.closed)
                }
                onClick={() =>
                  dispatchEditorAction({
                    type: "paths.join-selected",
                    toleranceMm: Number(joinTolerance),
                  })
                }
              >
                Join nearest
              </button>
            </div>
            {joinPreview !== null && (
              <p className="selection-summary" data-testid="join-preview">
                Nearest endpoint gap: {joinPreview.distanceMm.toFixed(3)} mm —{" "}
                {joinPreview.withinTolerance
                  ? "inside tolerance"
                  : "outside tolerance"}
              </p>
            )}

            <p className="selection-summary" data-testid="boolean-order">
              Subtract uses the first selected path as its subject; later
              selections are clips. Clear and reselect to change the subject.
              Boolean, offset, and join operands must share one editable layer.
            </p>

            <div className="button-grid compact">
              {(
                [
                  ["union", "Union"],
                  ["subtract", "Subtract"],
                  ["intersect", "Intersect"],
                  ["xor", "Exclude / XOR"],
                ] as const
              ).map(([operation, label]) => (
                <button
                  type="button"
                  key={operation}
                  data-testid={`boolean-${operation}`}
                  disabled={
                    busy ||
                    selectedPaths.length < 2 ||
                    selectedPaths.some((path) => !path.closed)
                  }
                  onClick={() => void runGeometry({ kind: "boolean", operation })}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="geometry-setting-row">
              <label>
                Signed offset (mm)
                <input
                  type="number"
                  step="any"
                  value={offsetDistance}
                  onChange={(event) => setOffsetDistance(event.target.value)}
                />
              </label>
              <select
                aria-label="Offset join"
                value={offsetJoin}
                onChange={(event) =>
                  setOffsetJoin(
                    event.target.value as "miter" | "round" | "square",
                  )
                }
              >
                <option value="round">Round</option>
                <option value="miter">Miter</option>
                <option value="square">Square</option>
              </select>
              <button
                type="button"
                data-testid="offset-paths"
                disabled={
                  busy ||
                  selectedPaths.length === 0 ||
                  selectedPaths.some((path) => !path.closed) ||
                  Number(offsetDistance) === 0
                }
                onClick={() =>
                  void runGeometry({
                    kind: "offset",
                    distanceMm: Number(offsetDistance),
                    join: offsetJoin,
                  })
                }
              >
                Offset
              </button>
            </div>

            {activeGeometryOperationId !== null && (
              <button
                type="button"
                className="danger"
                data-testid="cancel-geometry"
                onClick={() =>
                  void window.laserx.cancelGeometryOperation({
                    operationId: activeGeometryOperationId,
                  })
                }
              >
                Cancel geometry operation
              </button>
            )}

            {state.editor.topologySummary !== null && (
              <div className="topology-summary" data-testid="topology-summary">
                <strong>{state.editor.topologySummary.operation}</strong>
                <span>{state.editor.topologySummary.message}</span>
                {state.editor.topologySummary.replacedObjectIds.length > 0 && (
                  <small>
                    Result IDs:{" "}
                    {state.editor.topologySummary.replacedObjectIds.join(", ")}
                  </small>
                )}
                {state.editor.topologySummary.discardedObjectIds.length > 0 && (
                  <small>
                    Replaced source IDs:{" "}
                    {state.editor.topologySummary.discardedObjectIds.join(", ")}
                  </small>
                )}
                {state.editor.topologySummary.warnings.map((warning) => (
                  <small key={warning}>{warning}</small>
                ))}
              </div>
            )}
          </section>

          <section id="edit-transform">
            <span className="section-label">Exact transform</span>
            <form className="inspector-form" onSubmit={applyInspector}>
              {(["x", "y", "width", "height"] as const).map((field) => (
                <label key={field}>
                  {field.toUpperCase()}
                  <span className="inline-input">
                    <input
                      aria-label={`Selection ${field}`}
                      type="number"
                      step="any"
                      disabled={selectionBounds === null}
                      value={inspector[field]}
                      onChange={(event) => {
                        if (field === "width" || field === "height") {
                          setLockedDimension(field);
                        }
                        setInspector((current) => ({
                          ...current,
                          [field]: event.target.value,
                        }));
                      }}
                    />
                    <span>{unitLabel}</span>
                  </span>
                </label>
              ))}
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={aspectLocked}
                  onChange={(event) => setAspectLocked(event.target.checked)}
                />
                Lock aspect ratio
              </label>
              <button type="submit" disabled={selectionBounds === null}>
                Apply exact bounds
              </button>
            </form>
            <div className="rotate-row">
              <label>
                Rotate
                <span className="inline-input">
                  <input
                    aria-label="Rotation degrees"
                    type="number"
                    step="any"
                    value={inspector.angle}
                    onChange={(event) =>
                      setInspector((current) => ({
                        ...current,
                        angle: event.target.value,
                      }))
                    }
                  />
                  <span>deg</span>
                </span>
              </label>
              <button
                type="button"
                disabled={selectionBounds === null}
                onClick={rotateSelection}
              >
                Rotate
              </button>
            </div>
            <div className="button-grid compact">
              {(["horizontal", "vertical"] as const).map((axis) => (
                <button
                  type="button"
                  key={axis}
                  disabled={selectionBounds === null}
                  onClick={() => {
                    const request = mirrorSelectionCommand(
                      selectionIds,
                      selectionBounds,
                      axis,
                    );
                    if (request !== null) {
                      dispatchEditorAction(request);
                    }
                  }}
                >
                  Mirror {axis === "horizontal" ? "H" : "V"}
                </button>
              ))}
            </div>
          </section>

          <section>
            <span className="section-label">Align & distribute</span>
            <div className="button-grid compact three">
              {(
                [
                  ["left", "Left"],
                  ["center-x", "Center X"],
                  ["right", "Right"],
                  ["bottom", "Bottom"],
                  ["center-y", "Center Y"],
                  ["top", "Top"],
                ] as const
              ).map(([alignment, label]) => (
                <button
                  type="button"
                  key={alignment}
                  disabled={selectionIds.length < 2}
                  onClick={() =>
                    dispatchEditorAction({
                      type: "objects.align",
                      objectIds: selectionIds,
                      alignment,
                    })
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="button-grid compact">
              {(["horizontal", "vertical"] as const).map((distribution) => (
                <button
                  type="button"
                  key={distribution}
                  disabled={selectionIds.length < 3}
                  onClick={() =>
                    dispatchEditorAction({
                      type: "objects.distribute",
                      objectIds: selectionIds,
                      distribution,
                    })
                  }
                >
                  Distribute {distribution === "horizontal" ? "H" : "V"}
                </button>
              ))}
            </div>
          </section>

          <section>
            <span className="section-label">Object order</span>
            <div className="button-grid compact">
              {(
                [
                  ["bring-front", "To front"],
                  ["bring-forward", "Forward"],
                  ["send-backward", "Backward"],
                  ["send-back", "To back"],
                ] as const
              ).map(([action, label]) => (
                <button
                  type="button"
                  key={action}
                  disabled={selectionIds.length === 0}
                  onClick={() =>
                    dispatchEditorAction({
                      type: "objects.z-order",
                      objectIds: selectionIds,
                      action,
                    })
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section id="edit-layers">
            <div className="section-heading">
              <span className="section-label">Layers</span>
              <button
                type="button"
                data-testid="add-layer"
                onClick={() =>
                  dispatchEditorAction({
                    type: "layer.create",
                    name: `Layer ${String(document.layers.length + 1)}`,
                  })
                }
              >
                + Add
              </button>
            </div>
            <ol className="layer-list">
              {document.layers.map((layer, index) => (
                <li
                  key={layer.id}
                  className={
                    layer.id === document.activeLayerId ? "active" : ""
                  }
                >
                  <button
                    type="button"
                    className="layer-activate"
                    aria-label={`Activate ${layer.name}`}
                    onClick={() =>
                      dispatchEditorAction({
                        type: "layer.activate",
                        layerId: layer.id,
                      })
                    }
                  >
                    {index + 1}
                  </button>
                  <input
                    aria-label={`Rename ${layer.name}`}
                    defaultValue={layer.name}
                    onBlur={(event) => {
                      const name = event.target.value.trim();
                      if (name !== "" && name !== layer.name) {
                        dispatchEditorAction({
                          type: "layer.rename",
                          layerId: layer.id,
                          name,
                        });
                      }
                    }}
                  />
                  <button
                    type="button"
                    aria-label={`${layer.visible ? "Hide" : "Show"} ${layer.name}`}
                    onClick={() =>
                      dispatchEditorAction({
                        type: "layer.set-visibility",
                        layerId: layer.id,
                        visible: !layer.visible,
                      })
                    }
                  >
                    {layer.visible ? "◉" : "○"}
                  </button>
                  <button
                    type="button"
                    aria-label={`${layer.locked ? "Unlock" : "Lock"} ${layer.name}`}
                    onClick={() =>
                      dispatchEditorAction({
                        type: "layer.set-locked",
                        layerId: layer.id,
                        locked: !layer.locked,
                      })
                    }
                  >
                    {layer.locked ? "L" : "U"}
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${layer.name} up`}
                    disabled={index === 0}
                    onClick={() =>
                      dispatchEditorAction({
                        type: "layer.reorder",
                        layerId: layer.id,
                        toIndex: index - 1,
                      })
                    }
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${layer.name} down`}
                    disabled={index === document.layers.length - 1}
                    onClick={() =>
                      dispatchEditorAction({
                        type: "layer.reorder",
                        layerId: layer.id,
                        toIndex: index + 1,
                      })
                    }
                  >
                    ↓
                  </button>
                </li>
              ))}
            </ol>
            {activeLayer !== undefined && (
              <div className="production-layer-editor" data-testid="production-layer-editor">
                <label>
                  Manufacturing role
                  <select
                    aria-label="Manufacturing layer role"
                    value={activeLayer.manufacturing?.role ?? "ordinary"}
                    onChange={(event) => {
                      const role = event.target.value;
                      if (role === "ordinary") {
                        dispatchEditorAction({
                          type: "layer.set-manufacturing",
                          layerId: activeLayer.id,
                          manufacturing: null,
                        });
                        return;
                      }
                      const isPreview = role === "non-cut-preview";
                      dispatchEditorAction({
                        type: "layer.set-manufacturing",
                        layerId: activeLayer.id,
                        manufacturing: {
                          role: role as ManufacturingLayerMetadata["role"],
                          material: document.settings.manufacturing.material,
                          thicknessMm: document.settings.manufacturing.thicknessMm,
                          stockThicknessDesignation:
                            document.settings.manufacturing.stockThicknessDesignation === undefined
                              ? null
                              : document.settings.manufacturing.stockThicknessDesignation === null
                                ? null
                                : { ...document.settings.manufacturing.stockThicknessDesignation },
                          process: isPreview
                            ? "non-cut"
                            : document.settings.manufacturing.process,
                          notes: "",
                          registrationGroup: null,
                          registrationHoleIds: [],
                        },
                      });
                    }}
                  >
                    <option value="ordinary">Ordinary editing layer</option>
                    <option value="face">Face</option>
                    <option value="backing">Backing</option>
                    <option value="spacer-tab">Spacer / tab</option>
                    <option value="drill-reference">Drill / reference</option>
                    <option value="non-cut-preview">Non-cut preview</option>
                  </select>
                </label>
                {activeLayer.manufacturing !== undefined && (
                  <>
                    <div className="manufacturing-settings-grid">
                      <label>
                        Material
                        <select
                          aria-label="Layer material"
                          value={activeLayer.manufacturing.material}
                          onChange={(event) =>
                            updateActiveLayerManufacturing({
                              material: event.target.value as ManufacturingLayerMetadata["material"],
                              stockThicknessDesignation: null,
                            })
                          }
                        >
                          <option value="mild-steel">Mild steel</option>
                          <option value="stainless-steel">Stainless steel</option>
                          <option value="aluminum">Aluminum</option>
                          <option value="wood">Wood</option>
                          <option value="acrylic">Acrylic</option>
                          <option value="other">Other</option>
                        </select>
                      </label>
                      <label>
                        Stock designation
                        <select
                          aria-label="Layer stock thickness designation"
                          value={selectedLayerThicknessChoice}
                          onChange={(event) => {
                            const choice = activeLayerThicknessChoices.find(
                              (candidate) => candidate.id === event.target.value,
                            );
                            updateActiveLayerManufacturing(choice === undefined
                              ? {
                                  stockThicknessDesignation: {
                                    kind: "custom",
                                    label: "Custom",
                                    material: null,
                                  },
                                }
                              : {
                                  thicknessMm: choice.thicknessMm,
                                  stockThicknessDesignation: { ...choice.designation },
                                });
                          }}
                        >
                          {activeLayerThicknessChoices.map((choice) => (
                            <option key={choice.id} value={choice.id}>{choice.label}</option>
                          ))}
                          <option value="custom">Custom thickness</option>
                        </select>
                      </label>
                      <label>
                        Custom thickness ({stockThicknessInputUnit})
                        <input
                          aria-label={`Layer thickness ${unit}`}
                          type="number"
                          min="0.001"
                          step={unit === "inches" ? "0.0001" : "0.001"}
                          value={stockThicknessForDisplay(activeLayer.manufacturing.thicknessMm)}
                          onChange={(event) =>
                            updateActiveLayerManufacturing({
                              thicknessMm: stockThicknessFromDisplay(Number(event.target.value)),
                              stockThicknessDesignation: {
                                kind: "custom",
                                label: "Custom",
                                material: null,
                              },
                            })
                          }
                        />
                      </label>
                      <span data-testid="layer-stock-thickness-summary">
                        {formatStockThickness(
                          activeLayer.manufacturing.thicknessMm,
                          activeLayer.manufacturing.stockThicknessDesignation,
                        )}
                      </span>
                      <label>
                        Process
                        <select
                          aria-label="Layer process"
                          disabled={activeLayer.manufacturing.role === "non-cut-preview"}
                          value={activeLayer.manufacturing.process}
                          onChange={(event) =>
                            updateActiveLayerManufacturing({
                              process: event.target.value as ManufacturingLayerMetadata["process"],
                            })
                          }
                        >
                          <option value="laser">Laser</option>
                          <option value="plasma">Plasma</option>
                          <option value="waterjet">Waterjet</option>
                          <option value="router">Router</option>
                          <option value="drill">Drill</option>
                          {activeLayer.manufacturing.role === "non-cut-preview" && (
                            <option value="non-cut">Non-cut</option>
                          )}
                        </select>
                      </label>
                    </div>
                    <label>
                      Registration group
                      <input
                        aria-label="Registration group"
                        key={`${activeLayer.id}-${activeLayer.manufacturing.registrationGroup ?? ""}-registration`}
                        defaultValue={activeLayer.manufacturing.registrationGroup ?? ""}
                        placeholder="Optional shared group"
                        onBlur={(event) => {
                          const registrationGroup = event.target.value.trim() || null;
                          updateActiveLayerManufacturing({
                            registrationGroup,
                            ...(registrationGroup === null
                              ? { registrationHoleIds: [] }
                              : {}),
                          });
                        }}
                      />
                    </label>
                    <div className="button-grid compact">
                      <button
                        type="button"
                        data-testid="designate-registration-holes"
                        disabled={
                          busy ||
                          activeLayer.manufacturing.role === "non-cut-preview" ||
                          activeLayer.manufacturing.registrationGroup === null ||
                          selectedRegistrationHoleIds.length === 0
                        }
                        onClick={() =>
                          updateActiveLayerManufacturing({
                            registrationHoleIds: selectedRegistrationHoleIds,
                          })
                        }
                      >
                        Designate selected circles as holes
                      </button>
                      <button
                        type="button"
                        disabled={
                          busy ||
                          activeLayer.manufacturing.registrationHoleIds.length === 0
                        }
                        onClick={() =>
                          updateActiveLayerManufacturing({ registrationHoleIds: [] })
                        }
                      >
                        Clear designated holes
                      </button>
                    </div>
                    <small>
                      Registration holes must be true circles in world space; ovals and distorted ellipses cannot be designated.
                    </small>
                    <small>
                      Designated registration circles: {activeLayer.manufacturing.registrationHoleIds.length}
                    </small>
                    <label>
                      Material notes
                      <input
                        aria-label="Layer material notes"
                        key={`${activeLayer.id}-${activeLayer.manufacturing.notes}-notes`}
                        defaultValue={activeLayer.manufacturing.notes}
                        onBlur={(event) =>
                          updateActiveLayerManufacturing({ notes: event.target.value })
                        }
                      />
                    </label>
                    {physicalProductionLayers
                      .filter((layer) => layer.id !== activeLayer.id)
                      .map((referenceLayer) => (
                        <div className="button-grid compact" key={referenceLayer.id}>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              dispatchEditorAction({
                                type: "layers.align-to-reference",
                                sourceLayerId: referenceLayer.id,
                                targetLayerId: activeLayer.id,
                              })
                            }
                          >
                            Align center to {referenceLayer.name}
                          </button>
                          <button
                            type="button"
                            disabled={
                              busy ||
                              activeLayer.manufacturing?.registrationGroup === null ||
                              activeLayer.manufacturing?.registrationGroup !==
                                referenceLayer.manufacturing?.registrationGroup ||
                              referenceLayer.manufacturing?.registrationHoleIds.length === 0
                            }
                            onClick={() =>
                              dispatchEditorAction({
                                type: "layers.coordinate-registration",
                                sourceLayerId: referenceLayer.id,
                                targetLayerId: activeLayer.id,
                              })
                            }
                          >
                            Sync holes from {referenceLayer.name}
                          </button>
                        </div>
                      ))}
                    {activeLayer.manufacturing.role !== "non-cut-preview" && (
                      <button
                        type="button"
                        data-testid="analyze-manufacturing-layer"
                        disabled={busy || !document.objects.some((object) => object.layerId === activeLayer.id)}
                        onClick={() =>
                          void run(() =>
                            window.laserx.runManufacturingLayerAnalysis({
                              operationId: window.crypto.randomUUID(),
                              layerId: activeLayer.id,
                            }),
                          )
                        }
                      >
                        Analyze this physical layer
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            {state.production.preview !== null && (
              <div className="production-package" data-testid="production-package">
                <span className="section-label">Production package</span>
                <div className="assembly-preview" aria-label="Exploded two-dimensional assembly preview">
                  {state.production.preview.layers.map((layer, index) => (
                    <div
                      key={layer.layerId}
                      className={`assembly-layer role-${layer.role}`}
                      style={{ transform: `translate(${String(index * 8)}px, ${String(index * -8)}px)` }}
                    >
                      <strong>{layer.name}</strong>
                      <span>{layer.role}</span>
                    </div>
                  ))}
                </div>
                <fieldset className="production-layer-selection">
                  <legend>Manufacturing layers</legend>
                  {physicalProductionLayers.map((layer) => (
                    <label key={layer.id} className="toggle-row">
                      <input
                        type="checkbox"
                        checked={!excludedProductionLayerIds.includes(layer.id)}
                        onChange={(event) =>
                          setExcludedProductionLayerIds((current) =>
                            event.target.checked
                              ? current.filter((id) => id !== layer.id)
                              : [...current, layer.id],
                          )
                        }
                      />
                      {layer.name} ({layer.manufacturing?.role})
                    </label>
                  ))}
                </fieldset>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={replaceProductionPackage}
                    onChange={(event) => setReplaceProductionPackage(event.target.checked)}
                  />
                  Replace an existing package folder
                </label>
                <button
                  type="button"
                  data-testid="export-production-package"
                  disabled={busy || selectedProductionLayerIds.length === 0}
                  onClick={() =>
                    void run(() =>
                      window.laserx.exportProductionPackage({
                        layerIds: selectedProductionLayerIds,
                        formats: ["svg", "dxf"],
                        conflictPolicy: replaceProductionPackage ? "replace" : "fail",
                      }),
                    )
                  }
                >
                  Export DXF + SVG package
                </button>
                {state.production.exportSummary !== null && (
                  <div
                    className={state.production.exportSummary.status === "success" ? "status-success" : "status-warning"}
                    data-testid="production-export-summary"
                  >
                    {state.production.exportSummary.status === "success"
                      ? `Exported ${String(state.production.exportSummary.layerCount)} layer(s) and ${String(state.production.exportSummary.fileCount)} file(s).`
                      : state.production.exportSummary.error}
                  </div>
                )}
              </div>
            )}
          </section>

          <section>
            <span className="section-label">Guides</span>
            <div className="button-grid compact">
              <button
                type="button"
                onClick={() =>
                  dispatchEditorAction(centerGuideCommand(document, "x"))
                }
              >
                Vertical center
              </button>
              <button
                type="button"
                onClick={() =>
                  dispatchEditorAction(centerGuideCommand(document, "y"))
                }
              >
                Horizontal center
              </button>
            </div>
            {document.guides.length > 0 && (
              <ul className="guide-list">
                {document.guides.map((guide) => (
                  <li key={guide.id}>
                    <span>
                      {guide.axis.toUpperCase()} {displayScalar(guide.positionMm, unit)}{" "}
                      {unitLabel}
                    </span>
                    <button
                      type="button"
                      aria-label={`Delete ${guide.axis} guide`}
                      onClick={() =>
                        dispatchEditorAction({
                          type: "guide.delete",
                          guideId: guide.id,
                        })
                      }
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      <footer className="statusbar">
        <span className={state.dirty ? "status-warning" : "status-success"}>
          <span aria-hidden="true">{state.dirty ? "●" : "✓"}</span>{" "}
          {state.dirty ? "Unsaved changes" : "All changes saved"}
        </span>
        <span>
          {selectionIds.length} selected · undo {state.editor.history.undoDepth} · redo {state.editor.history.redoDepth}
        </span>
        <span>Cartesian · +X right · +Y up · schema v8</span>
      </footer>
    </div>
  );
}
