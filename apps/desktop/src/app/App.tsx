import type { EditorActionRequest } from "@laserx/application";
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
import { Viewport } from "../components/Viewport.js";
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
  const [width, setWidth] = useState("24");
  const [height, setHeight] = useState("12");
  const [inputUnit, setInputUnit] = useState<
    "millimeters" | "inches"
  >("inches");
  const [gridSpacing, setGridSpacing] = useState("10");
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
        <span className="shell-badge">M03 editing core</span>
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
                <dd>.laserx v3</dd>
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
        <span>Cartesian · +X right · +Y up · schema v3</span>
      </footer>
    </div>
  );
}
