import {
  previewSelectedPathJoin,
  type EditorActionRequest,
} from "@laserx/application";
import type {
  ManufacturingSettingField,
  ManufacturingSettings,
  RasterTracePreset,
  RasterTraceSettings,
} from "@laserx/domain";
import {
  MANUFACTURING_PRESETS,
  settingsForManufacturingPreset,
} from "@laserx/cutability";
import { settingsForRasterTracePreset } from "@laserx/import-raster";
import {
  useCallback,
  useEffect,
  useState,
  type SyntheticEvent,
} from "react";

import type {
  CommandResult,
  DesktopState,
} from "../../electron/ipc-contract.js";
import type { PathObject } from "@laserx/domain";
import { Viewport } from "../components/Viewport.js";
import { TextPanel } from "../components/TextPanel.js";
import { SignToolsPanel } from "../components/SignToolsPanel.js";
import { AiGenerationPanel } from "../components/AiGenerationPanel.js";
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
  const [manufacturingSettings, setManufacturingSettings] =
    useState<ManufacturingSettings>(() =>
      settingsForManufacturingPreset("laser-mild-steel-3mm"),
    );
  const [manufacturingPreviewVisible, setManufacturingPreviewVisible] =
    useState(true);
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

  useEffect(() => {
    if (state !== null) {
      setManufacturingSettings({
        ...state.project.document.settings.manufacturing,
        customizedFields: [
          ...state.project.document.settings.manufacturing.customizedFields,
        ],
      });
    }
  }, [state?.project.id, state?.project.document.settings.manufacturing]);

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
  const viewportPreferences = document.settings.viewport;
  const selectionIds = state.editor.selectionIds;
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
  const unitLabel = unit === "inches" ? "in" : "mm";
  const cutability = state.analysis.cutability;
  const focusedCutabilityIssue = cutability?.issues.find(
    (issue) => issue.id === state.analysis.focusedIssueId,
  ) ?? null;
  const visibleCutabilityIssues = (cutability?.issues ?? []).filter(
    (issue) =>
      issueSeverityFilter === "all" || issue.severity === issueSeverityFilter,
  );
  const workspaceIsEmpty =
    document.objects.length === 0 &&
    state.editor.importPreview === null &&
    state.editor.rasterTracePreview === null &&
    state.editor.signToolPreview === null &&
    state.editor.aiConceptPreview === null;

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
    <div className="app-shell" aria-busy={busy}>
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
            <button type="button" className="command-primary" disabled={busy} title="Start a new LaserX project" onClick={() => void run(() => window.laserx.newProject())}>
              <span className="command-icon" aria-hidden="true">+</span><span>New Design</span>
            </button>
            <button type="button" disabled={busy} title="Open an existing .laserx project" onClick={() => void run(() => window.laserx.openProject())}>
              <span className="command-icon" aria-hidden="true">↗</span><span>Open Project</span>
            </button>
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
        <div className="command-group artwork-command-group">
          <span className="command-group-label">Bring in artwork</span>
          <div className="command-group-actions">
            <button type="button" data-testid="preview-vector-import" disabled={busy} title="Import SVG or DXF as editable paths" onClick={() => void run(() => window.laserx.previewVectorImport({ unitlessDxfUnit }))}>
              <span className="command-icon" aria-hidden="true">↘</span><span>Import Artwork</span><small>SVG / DXF</small>
            </button>
            <button type="button" data-testid="trace-raster" disabled={busy} title="Trace a PNG or JPEG into editable paths" onClick={() => void runRasterTrace()}>
              <span className="command-icon" aria-hidden="true">◇</span><span>Trace Image</span><small>PNG / JPEG</small>
            </button>
          </div>
        </div>
        <div className="command-group output-command-group">
          <span className="command-group-label">Output</span>
          <div className="command-group-actions">
            <button type="button" data-testid="export-svg" disabled={busy} title="Export editable artwork as SVG" onClick={() => void run(() => window.laserx.exportVector({ format: "svg" }))}>Export SVG</button>
            <button type="button" data-testid="export-dxf" disabled={busy} title="Export editable artwork as DXF" onClick={() => void run(() => window.laserx.exportVector({ format: "dxf" }))}>Export DXF</button>
          </div>
        </div>
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

          <section id="workflow-import" className="interchange-panel" data-testid="interchange-panel">
            <span className="section-label">Import & export artwork</span>
            <p className="workflow-description">Bring SVG or DXF paths into this project, or export current geometry. This does not open a `.laserx` project.</p>
            <label>
              Unitless DXF assumption
              <select
                aria-label="Unitless DXF assumption"
                value={unitlessDxfUnit}
                onChange={(event) =>
                  setUnitlessDxfUnit(
                    event.target.value as "millimeters" | "inches",
                  )
                }
              >
                <option value="millimeters">1 unit = 1 mm</option>
                <option value="inches">1 unit = 1 in</option>
              </select>
            </label>
            <div className="button-grid compact">
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
                {state.editor.importPreview.warnings.length > 0 && (
                  <ul data-testid="import-warnings">
                    {state.editor.importPreview.warnings.map((item, index) => (
                      <li key={`${item.code}-${String(index)}`}>{item.message}</li>
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
                    Commit import
                  </button>
                  <button
                    type="button"
                    className="quiet"
                    data-testid="cancel-vector-import"
                    disabled={busy}
                    onClick={() => void run(() => window.laserx.cancelVectorImport())}
                  >
                    Cancel
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
          </section>

          <section id="workflow-trace" className="raster-panel" data-testid="raster-panel">
            <span className="section-label">Trace an image</span>
            <p className="workflow-description">Convert a PNG or JPEG into editable vector paths, then review before accepting.</p>
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
              Choose image and trace
            </button>
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
              {([
                ["Thickness", "thicknessMm"],
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
                  One standard geometry scope: {cutability.analyzedObjectIds.length} object(s)
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
                <ul className="cutability-issues" data-testid="cutability-issues">
                  {visibleCutabilityIssues.map((issue) => (
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

          <section>
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
              <button type="submit" disabled={busy}>
                Create document
              </button>
            </form>
          </section>

          <section>
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

          <section>
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
          {workspaceIsEmpty && (
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
        <span>Cartesian · +X right · +Y up · schema v7</span>
      </footer>
    </div>
  );
}
