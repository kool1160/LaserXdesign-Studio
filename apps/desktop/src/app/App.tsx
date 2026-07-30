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
  formatDimensions,
  gridSpacingForDisplay,
  gridSpacingToMillimeters,
} from "../lib/viewport-adapter.js";

type Command = () => Promise<CommandResult>;

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

      <nav className="commandbar" aria-label="Project commands">
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
        <span className="command-divider" />
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
        <span className="shell-badge">M02 viewport</span>
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
                <dd>.laserx v2</dd>
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
            <span className="section-label">Viewport preferences</span>
            <div className="preference-list">
              <label>
                <input
                  type="checkbox"
                  checked={viewportPreferences.rulersVisible}
                  onChange={(event) =>
                    void run(() =>
                      window.laserx.setViewportPreferences({
                        rulersVisible: event.target.checked,
                      }),
                    )
                  }
                />
                Rulers
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={viewportPreferences.gridVisible}
                  onChange={(event) =>
                    void run(() =>
                      window.laserx.setViewportPreferences({
                        gridVisible: event.target.checked,
                      }),
                    )
                  }
                />
                Grid
              </label>
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
                              document.settings.displayUnit,
                            ),
                          }),
                        );
                      }
                    }}
                  />
                  <span>
                    {document.settings.displayUnit === "inches" ? "in" : "mm"}
                  </span>
                </span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={viewportPreferences.snapping.enabled}
                  onChange={(event) =>
                    void run(() =>
                      window.laserx.setViewportPreferences({
                        snappingEnabled: event.target.checked,
                      }),
                    )
                  }
                />
                Enable snapping
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={viewportPreferences.snapping.snapToGrid}
                  onChange={(event) =>
                    void run(() =>
                      window.laserx.setViewportPreferences({
                        snapToGrid: event.target.checked,
                      }),
                    )
                  }
                />
                Snap to grid
              </label>
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
          <Viewport document={document} />
        </main>
      </div>

      <footer className="statusbar">
        <span>{state.dirty ? "Unsaved changes" : "All changes saved"}</span>
        <span>
          Cartesian workspace · +X right · +Y up · schema v2
        </span>
      </footer>
    </div>
  );
}
