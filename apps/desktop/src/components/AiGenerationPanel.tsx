import { useEffect, useState, type SyntheticEvent } from "react";

import type {
  AiGenerateRequest,
  CommandResult,
  DesktopState,
} from "../../electron/ipc-contract.js";

interface AiGenerationPanelProps {
  state: DesktopState;
  busy: boolean;
  run: (command: () => Promise<CommandResult>) => Promise<void>;
}

function numberValue(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function connectionLabel(status: DesktopState["ai"]["connection"]["status"]): string {
  return status.replace("-", " ");
}

export function AiGenerationPanel({ state, busy, run }: AiGenerationPanelProps) {
  const [prompt, setPrompt] = useState("A clean, production-ready metal sign");
  const [wording, setWording] = useState("LASERX");
  const [widthMm, setWidthMm] = useState(String(state.project.document.dimensions.widthMm));
  const [heightMm, setHeightMm] = useState(String(state.project.document.dimensions.heightMm));
  const [style, setStyle] = useState<AiGenerateRequest["style"]>("auto");
  const [process, setProcess] = useState<AiGenerateRequest["process"]>(
    state.project.document.settings.manufacturing.process,
  );
  const [detailLevel, setDetailLevel] = useState<AiGenerateRequest["detailLevel"]>("balanced");
  const [bridgePreference, setBridgePreference] = useState<AiGenerateRequest["bridgePreference"]>("automatic");
  const [holesEnabled, setHolesEnabled] = useState(true);
  const [holeDiameterMm, setHoleDiameterMm] = useState("6");
  const [holeInsetMm, setHoleInsetMm] = useState("25.4");
  const [layerCount, setLayerCount] = useState("3");
  const [backingPlate, setBackingPlate] = useState(true);
  const [conceptCount, setConceptCount] = useState("3");
  const [referenceConsent, setReferenceConsent] = useState(false);
  const [correctedPrimary, setCorrectedPrimary] = useState(wording);
  const [correctedSecondary, setCorrectedSecondary] = useState("");

  useEffect(() => {
    setWidthMm(String(state.project.document.dimensions.widthMm));
    setHeightMm(String(state.project.document.dimensions.heightMm));
    setProcess(state.project.document.settings.manufacturing.process);
  }, [
    state.project.id,
    state.project.document.dimensions.heightMm,
    state.project.document.dimensions.widthMm,
    state.project.document.settings.manufacturing.process,
  ]);

  const preview = state.editor.aiConceptPreview;
  useEffect(() => {
    if (preview !== null) {
      setCorrectedPrimary(preview.summary.requestedWording);
      setCorrectedSecondary("");
    }
  }, [preview?.summary.id, preview?.summary.requestedWording]);

  const generate = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const referenceAttached = state.ai.reference !== null;
    void run(() => window.laserx.generateAiConcepts({
      operationId: window.crypto.randomUUID(),
      prompt,
      wording,
      widthMm: numberValue(widthMm, state.project.document.dimensions.widthMm),
      heightMm: numberValue(heightMm, state.project.document.dimensions.heightMm),
      style,
      process,
      detailLevel,
      bridgePreference,
      holes: {
        enabled: holesEnabled,
        diameterMm: holesEnabled ? numberValue(holeDiameterMm, 6) : 0,
        insetMm: holesEnabled ? numberValue(holeInsetMm, 25.4) : 0,
      },
      layerCount: Math.round(numberValue(layerCount, 3)),
      backingPlate,
      conceptCount: Math.round(numberValue(conceptCount, 3)),
      useReferenceImage: referenceAttached,
      referenceConsent: referenceAttached && referenceConsent,
    }));
  };

  const connected = state.ai.connection.status === "connected";
  const generating = state.ai.job !== null;

  return (
    <section className="ai-generation-panel" data-testid="ai-generation-panel">
      <div className="section-heading">
        <span className="section-label">AI sign concepts</span>
        <span className={`ai-status ${state.ai.connection.status}`}>
          {connectionLabel(state.ai.connection.status)}
        </span>
      </div>
      <p className="panel-note" data-testid="ai-connection-message">
        {state.ai.connection.message}
      </p>
      <div className="button-grid compact">
        {state.ai.credentialPrompt.active ? (
          <button
            type="button"
            className="quiet"
            data-testid="cancel-ai-connection"
            onClick={() => void run(() => window.laserx.cancelAiConnection())}
          >
            Cancel secure connection
          </button>
        ) : !connected ? (
          <button type="button" data-testid="connect-ai" disabled={busy} onClick={() => void run(() => window.laserx.connectAi())}>
            Connect existing key
          </button>
        ) : (
          <>
            <button type="button" data-testid="test-ai" disabled={busy} onClick={() => void run(() => window.laserx.testAiConnection())}>Test</button>
            <button type="button" data-testid="replace-ai" disabled={busy} onClick={() => void run(() => window.laserx.replaceAiCredential())}>Replace key</button>
            <button type="button" className="quiet" data-testid="disconnect-ai" disabled={busy} onClick={() => void run(() => window.laserx.disconnectAi())}>Disconnect</button>
          </>
        )}
        <button type="button" className="quiet" disabled={busy} onClick={() => void run(() => window.laserx.openAiAccountPage({ target: "keys" }))}>Open key setup</button>
        <button type="button" className="quiet" disabled={busy} onClick={() => void run(() => window.laserx.openAiAccountPage({ target: "billing" }))}>Open billing</button>
      </div>
      {state.ai.credentialPrompt.active ? (
        <small data-testid="ai-credential-timeout">
          The application-owned LaserX credential window closes automatically after {Math.ceil(state.ai.credentialPrompt.timeoutMs / 1_000)} seconds. Cancel restores the previous connection.
        </small>
      ) : null}

      <p className="privacy-note">
        The API key passes only through the isolated credential window and main process, then stays in the operating-system vault. Prompts and an attached image go to OpenAI only when you choose Generate; manual editing remains available while disconnected.
      </p>

      <form className="document-form ai-generation-form" onSubmit={generate}>
        <label className="wide-field">
          Design prompt
          <textarea aria-label="AI design prompt" required maxLength={2_000} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        </label>
        <label className="wide-field">
          Exact wording
          <input aria-label="AI exact wording" required maxLength={200} value={wording} onChange={(event) => setWording(event.target.value)} />
        </label>
        <label>
          Width (mm)
          <input aria-label="AI width millimeters" type="number" min="0.001" step="any" required value={widthMm} onChange={(event) => setWidthMm(event.target.value)} />
        </label>
        <label>
          Height (mm)
          <input aria-label="AI height millimeters" type="number" min="0.001" step="any" required value={heightMm} onChange={(event) => setHeightMm(event.target.value)} />
        </label>
        <label>
          Style
          <select aria-label="AI style" value={style} onChange={(event) => setStyle(event.target.value as AiGenerateRequest["style"])}>
            <option value="auto">Auto</option>
            <option value="motorcycle-badge">Motorcycle badge</option>
            <option value="farmhouse">Farmhouse</option>
            <option value="industrial">Industrial</option>
            <option value="address-sign">Address sign</option>
          </select>
        </label>
        <label>
          Process
          <select aria-label="AI manufacturing process" value={process} onChange={(event) => setProcess(event.target.value as AiGenerateRequest["process"])}>
            <option value="laser">Laser</option>
            <option value="plasma">Plasma</option>
            <option value="waterjet">Waterjet</option>
            <option value="router">Router</option>
          </select>
        </label>
        <label>
          Detail
          <select aria-label="AI detail level" value={detailLevel} onChange={(event) => setDetailLevel(event.target.value as AiGenerateRequest["detailLevel"])}>
            <option value="simple">Simple</option>
            <option value="balanced">Balanced</option>
            <option value="detailed">Detailed</option>
          </select>
        </label>
        <label>
          Bridges
          <select aria-label="AI bridge preference" value={bridgePreference} onChange={(event) => setBridgePreference(event.target.value as AiGenerateRequest["bridgePreference"])}>
            <option value="none">None</option>
            <option value="automatic">Automatic</option>
            <option value="manual">Manual</option>
          </select>
        </label>
        <label>
          Layers
          <input aria-label="AI layer count" type="number" min="1" max="3" step="1" value={layerCount} onChange={(event) => setLayerCount(event.target.value)} />
        </label>
        <label>
          Concepts
          <input aria-label="AI concept count" type="number" min="2" max="4" step="1" value={conceptCount} onChange={(event) => setConceptCount(event.target.value)} />
        </label>
        <label className="check-row">
          <input type="checkbox" checked={backingPlate} onChange={(event) => setBackingPlate(event.target.checked)} />
          Backing plate
        </label>
        <label className="check-row">
          <input type="checkbox" checked={holesEnabled} onChange={(event) => setHolesEnabled(event.target.checked)} />
          Mounting holes
        </label>
        {holesEnabled ? (
          <>
            <label>
              Hole diameter (mm)
              <input aria-label="AI hole diameter millimeters" type="number" min="0" step="any" value={holeDiameterMm} onChange={(event) => setHoleDiameterMm(event.target.value)} />
            </label>
            <label>
              Hole inset (mm)
              <input aria-label="AI hole inset millimeters" type="number" min="0" step="any" value={holeInsetMm} onChange={(event) => setHoleInsetMm(event.target.value)} />
            </label>
          </>
        ) : null}

        <div className="ai-reference wide-field">
          <label className="check-row">
            <input type="checkbox" aria-label="Consent to send AI reference" checked={referenceConsent} onChange={(event) => setReferenceConsent(event.target.checked)} />
            I consent to send the selected reference image with this generation request.
          </label>
          {state.ai.reference === null ? (
            <button type="button" data-testid="attach-ai-reference" disabled={busy || !referenceConsent} onClick={() => void run(() => window.laserx.attachAiReference({ consent: true }))}>Attach PNG/JPEG reference</button>
          ) : (
            <div className="reference-summary" data-testid="ai-reference-summary">
              <span>{state.ai.reference.widthPx} x {state.ai.reference.heightPx} px · {Math.ceil(state.ai.reference.byteLength / 1024)} KiB</span>
              <button type="button" className="quiet" disabled={busy} onClick={() => void run(() => window.laserx.removeAiReference())}>Remove reference</button>
            </div>
          )}
        </div>

        <button type="submit" data-testid="generate-ai-concepts" disabled={busy || !connected || (state.ai.reference !== null && !referenceConsent)}>
          Generate {conceptCount} concepts
        </button>
      </form>

      <small className="usage-note">
        {state.ai.estimate.note} Model: {state.ai.estimate.model}; response cap: {state.ai.estimate.maxOutputTokens} tokens. Provider usage is billed to your OpenAI account.
      </small>

      {generating ? (
        <div className="ai-job" data-testid="ai-generation-progress">
          <span>{state.ai.job?.stage} · {state.ai.job?.percent}%</span>
          <progress max={100} value={state.ai.job?.percent ?? 0} />
          <button type="button" data-testid="cancel-ai-generation" onClick={() => {
            const operationId = state.ai.job?.operationId;
            if (operationId !== undefined) void run(() => window.laserx.cancelAiGeneration({ operationId }));
          }}>Cancel</button>
        </div>
      ) : null}

      {state.ai.concepts.length > 0 ? (
        <div className="ai-concepts" data-testid="ai-concept-list">
          {state.ai.concepts.map((concept, index) => (
            <button
              type="button"
              key={concept.id}
              className={concept.id === state.ai.selectedConceptId ? "active" : ""}
              aria-pressed={concept.id === state.ai.selectedConceptId}
              disabled={busy}
              onClick={() => void run(() => window.laserx.selectAiConcept({ conceptId: concept.id }))}
            >
              <strong>{index + 1}. {concept.title}</strong>
              <small>{concept.source === "structured-vector" ? "Editable vector" : "Editable traced fallback"} · {concept.objectCount} objects</small>
            </button>
          ))}
        </div>
      ) : null}

      {preview !== null ? (
        <div className="interchange-summary ai-review" data-testid="ai-concept-review">
          <strong>{preview.summary.title}</strong>
          <span>{preview.summary.description}</span>
          <span>{preview.summary.objectCount} editable objects · {preview.summary.layerCount} layer(s)</span>
          <span data-testid="ai-wording-status">
            Wording: {preview.summary.wordingMatches ? "verified" : `mismatch — received “${preview.summary.observedWording}”`}
          </span>
          <span data-testid="ai-preacceptance-analysis">
            Pre-acceptance analysis: {preview.analysis.errorCount} errors, {preview.analysis.warningCount} warnings; cut ready: no
          </span>
          <small>{preview.analysis.disclaimer}</small>
          {preview.summary.warnings.map((warning) => <small key={warning}>{warning}</small>)}
          {!preview.summary.wordingMatches && preview.summary.source === "structured-vector" ? (
            <div className="wording-correction">
              <label>
                Correct primary wording
                <input aria-label="Correct AI primary wording" maxLength={200} value={correctedPrimary} onChange={(event) => setCorrectedPrimary(event.target.value)} />
              </label>
              <label>
                Correct secondary wording
                <input aria-label="Correct AI secondary wording" maxLength={200} value={correctedSecondary} onChange={(event) => setCorrectedSecondary(event.target.value)} />
              </label>
              <button type="button" data-testid="correct-ai-wording" disabled={busy || correctedPrimary.trim() === ""} onClick={() => void run(() => window.laserx.correctAiWording({ conceptId: preview.summary.id, primaryText: correctedPrimary, secondaryText: correctedSecondary }))}>Apply exact wording</button>
            </div>
          ) : null}
          <div className="button-grid compact">
            <button type="button" data-testid="accept-ai-concept" disabled={busy || !preview.summary.wordingMatches} onClick={() => void run(() => window.laserx.acceptAiConcept())}>Accept concept</button>
            <button type="button" className="quiet" data-testid="discard-ai-concepts" disabled={busy} onClick={() => void run(() => window.laserx.discardAiConcepts())}>Discard all</button>
          </div>
          <small>AI prompt, reference image, provider metadata, and provenance are not saved in the project. Accepted output is ordinary editable LaserX geometry.</small>
        </div>
      ) : null}

      {state.ai.usage !== null ? (
        <small data-testid="ai-usage">Last request: {state.ai.usage.inputTokens ?? "unknown"} input · {state.ai.usage.outputTokens ?? "unknown"} output · {state.ai.usage.totalTokens ?? "unknown"} total tokens</small>
      ) : null}
    </section>
  );
}
