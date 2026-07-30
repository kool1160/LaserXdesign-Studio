import { useCallback, useEffect, useState } from "react";

import type {
  CommandResult,
  DesktopState,
} from "../../electron/ipc-contract.js";

type Command = () => Promise<CommandResult>;

function formatDimensions(state: DesktopState): string {
  const { displayUnit, pageHeightMm, pageWidthMm } = state.project;
  if (displayUnit === "inches") {
    return `${(pageWidthMm / 25.4).toFixed(2)} × ${(pageHeightMm / 25.4).toFixed(2)} in`;
  }
  return `${pageWidthMm.toFixed(1)} × ${pageHeightMm.toFixed(1)} mm`;
}

export function App() {
  const [state, setState] = useState<DesktopState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void window.laserx.getState().then((initialState) => {
      if (active) {
        setState(initialState);
      }
    });
    const unsubscribe = window.laserx.onStateChanged((nextState) => {
      setState(nextState);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

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
    return <main className="loading">Starting LaserX Design Studio…</main>;
  }

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
        <span className="shell-badge">M01 shell</span>
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
                <dd>.laserx v1</dd>
              </div>
              <div>
                <dt>Workspace</dt>
                <dd>{formatDimensions(state)}</dd>
              </div>
              <div>
                <dt>Project ID</dt>
                <dd>{state.project.id.slice(0, 8)}…</dd>
              </div>
            </dl>
          </section>

          <section>
            <span className="section-label">Display units</span>
            <div className="segmented" aria-label="Display units">
              {(["millimeters", "inches"] as const).map((displayUnit) => (
                <button
                  type="button"
                  key={displayUnit}
                  className={
                    state.project.displayUnit === displayUnit ? "active" : ""
                  }
                  aria-pressed={state.project.displayUnit === displayUnit}
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
          <div className="workspace-grid" aria-hidden="true" />
          <div className="blank-state" data-testid="blank-workspace">
            <div className="blank-icon" aria-hidden="true">
              <span />
            </div>
            <span className="eyebrow">Blank project</span>
            <h1>Your workspace is ready.</h1>
            <p>
              M01 establishes the secure desktop and project lifecycle. Design
              tools arrive in the next approved milestone.
            </p>
            <div className="blank-meta">
              <span>Local-first</span>
              <span>Autosave recovery</span>
              <span>Schema v1</span>
            </div>
          </div>
        </main>
      </div>

      <footer className="statusbar">
        <span>{state.dirty ? "Unsaved changes" : "All changes saved"}</span>
        <span>{state.recovered ? "Recovered session" : "Desktop ready"}</span>
      </footer>
    </div>
  );
}
