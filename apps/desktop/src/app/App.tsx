import {
  previewSelectedPathJoin,
  type EditorActionRequest,
} from "@laserx/application";
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

export function App() {
  const [state, setState] = useState<DesktopState | null>(null);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeGeometryOperationId, setActiveGeometryOperationId] =
    useState<string | null>(null);
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
    return <main className="loading">Starting LaserX Design Studio…</main>;
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
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            LX
          </div>
          <div>
            <span className="eyebrow">LaserX Design Studio</span>
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
        <div className="file-location" title={state.filePath ?? "Not saved yet"}>
          {state.filePath ?? "Not saved yet"}
        </div>
      </header>

      <nav className="commandbar" aria-label="Project and edit commands">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => window.laserx.newProject())}
        >
          New
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => window.laserx.openProject())}
        >
          Open
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => window.laserx.saveProject())}
        >
          Save
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => window.laserx.saveProjectAs())}
        >
          Save as
        </button>
        <span className="command-divider" />
        <button
          type="button"
          disabled={busy || state.editor.history.undoDepth === 0}
          data-testid="undo"
          onClick={() => dispatchEditorAction({ type: "history.undo" })}
        >
          Undo
        </button>
        <button
          type="button"
          disabled={busy || state.editor.history.redoDepth === 0}
          data-testid="redo"
          onClick={() => dispatchEditorAction({ type: "history.redo" })}
        >
          Redo
        </button>
        <button
          type="button"
          disabled={busy || selectionIds.length === 0}
          onClick={() => dispatchEditorAction({ type: "clipboard.copy" })}
        >
          Copy
        </button>
        <button
          type="button"
          disabled={busy || !state.editor.clipboardHasContent}
          onClick={() => dispatchEditorAction({ type: "clipboard.paste" })}
        >
          Paste
        </button>
        <span className="command-divider" />
        <button
          type="button"
          data-testid="preview-vector-import"
          disabled={busy}
          onClick={() =>
            void run(() =>
              window.laserx.previewVectorImport({ unitlessDxfUnit }),
            )
          }
        >
          Import SVG/DXF
        </button>
        <button
          type="button"
          data-testid="export-svg"
          disabled={busy}
          onClick={() =>
            void run(() => window.laserx.exportVector({ format: "svg" }))
          }
        >
          SVG
        </button>
        <button
          type="button"
          data-testid="export-dxf"
          disabled={busy}
          onClick={() =>
            void run(() => window.laserx.exportVector({ format: "dxf" }))
          }
        >
          DXF
        </button>
        <span className="shell-badge">M06 SVG & DXF</span>
      </nav>

      {state.recovery !== null && (
        <section className="recovery-banner" data-testid="recovery-banner">
          <div>
            <strong>Recovered work is available</strong>
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
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="content-grid">
        <aside className="sidebar">
          <section>
            <span className="section-label">Project</span>
            <dl className="project-facts">
              <div>
                <dt>Format</dt>
                <dd>.laserx v5</dd>
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

          <section className="interchange-panel" data-testid="interchange-panel">
            <span className="section-label">SVG / DXF interchange</span>
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

          <section>
            <span className="section-label">Create objects</span>
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

          <TextPanel state={state} busy={busy} run={run} />

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

        <main className="workspace">
          <Viewport
            document={document}
            selectionIds={selectionIds}
            selectionBounds={selectionBounds}
            pathSelection={pathSelection}
            importPreview={state.editor.importPreview}
            onEditorAction={dispatchEditorAction}
          />
        </main>

        <aside className="sidebar editing-sidebar">
          <section>
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

          <section data-testid="geometry-panel">
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

          <section>
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

          <section>
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
        <span>{state.dirty ? "Unsaved changes" : "All changes saved"}</span>
        <span>
          {selectionIds.length} selected · undo {state.editor.history.undoDepth} ·
          redo {state.editor.history.redoDepth}
        </span>
        <span>Cartesian · +X right · +Y up · schema v5</span>
      </footer>
    </div>
  );
}
