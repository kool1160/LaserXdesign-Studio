import { useState, type SyntheticEvent } from "react";

import type { SignTemplateParameters, SignTemplateShape } from "@laserx/domain";
import { SIGN_STYLE_PRESETS } from "@laserx/sign-tools";

import type {
  CommandResult,
  DesktopState,
  SignToolRequestDto,
} from "../../electron/ipc-contract.js";

interface SignToolsPanelProps {
  state: DesktopState;
  busy: boolean;
  run: (command: () => Promise<CommandResult>) => Promise<void>;
}

type ToolKind = Exclude<SignToolRequestDto["kind"], "template">;

const DEFAULT_TEMPLATE: SignTemplateParameters = {
  kind: "badge",
  shape: "rounded-rectangle",
  widthMm: 609.6,
  heightMm: 304.8,
  borderWidthMm: 12,
  holeDiameterMm: 6,
  holeInsetMm: 25.4,
  fontId: "bundled:saira-stencil-one",
  fontSizeMm: 42,
  primaryText: "LASERX",
  secondaryText: "EST. 2026",
  arcRadiusMm: null,
};

const SHAPES: readonly SignTemplateShape[] = [
  "rectangle",
  "rounded-rectangle",
  "circle",
  "oval",
  "shield",
  "badge",
  "banner",
];

function numberValue(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function SignToolsPanel({ state, busy, run }: SignToolsPanelProps) {
  const [tool, setTool] = useState<ToolKind>("outer-shape");
  const [shape, setShape] = useState<SignTemplateShape>("rounded-rectangle");
  const [widthMm, setWidthMm] = useState("609.6");
  const [heightMm, setHeightMm] = useState("304.8");
  const [offsetMm, setOffsetMm] = useState("3");
  const [featureWidthMm, setFeatureWidthMm] = useState("12");
  const [featureDepthMm, setFeatureDepthMm] = useState("6");
  const [count, setCount] = useState("2");
  const [template, setTemplate] = useState<SignTemplateParameters>(() => ({
    ...DEFAULT_TEMPLATE,
  }));
  const [stylePresetId, setStylePresetId] = useState("industrial-stencil");
  const [templateName, setTemplateName] = useState("My sign template");

  const previewUtility = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const width = numberValue(widthMm, 609.6);
    const height = numberValue(heightMm, 304.8);
    const offset = numberValue(offsetMm, 3);
    const featureWidth = numberValue(featureWidthMm, 12);
    const featureDepth = numberValue(featureDepthMm, 6);
    const featureCount = Math.round(numberValue(count, 2));
    let request: SignToolRequestDto;
    if (tool === "border") {
      request = { kind: "border", offsetMm: offset, widthMm: featureWidth, join: "round" };
    } else if (tool === "backing-plate") {
      request = { kind: "backing-plate", shape, marginMm: offset, cornerRadiusMm: featureWidth };
    } else if (tool === "outer-shape") {
      request = { kind: "outer-shape", shape, widthMm: width, heightMm: height, cornerRadiusMm: featureWidth };
    } else if (tool === "mounting-holes") {
      request = {
        kind: "mounting-holes",
        columns: featureCount,
        rows: 1,
        diameterMm: featureWidth,
        insetXmm: offset,
        insetYmm: offset,
      };
    } else {
      request = {
        kind: "assembly",
        feature: "tabs",
        edge: "top",
        count: featureCount,
        widthMm: featureWidth,
        depthMm: featureDepth,
      };
    }
    void run(() => window.laserx.previewSignTool(request));
  };

  const previewTemplate = (
    parameters: SignTemplateParameters,
    presetId = stylePresetId,
  ) => {
    void run(() => window.laserx.previewSignTool({
      kind: "template",
      stylePresetId: presetId,
      parameters: { ...parameters },
    }));
  };

  const loadSavedTemplate = (templateId: string) => {
    const saved = state.project.document.templates.find(
      (candidate) => candidate.id === templateId,
    );
    if (saved === undefined) return;
    const parameters = { ...saved.parameters };
    setTemplate(parameters);
    setStylePresetId(saved.stylePresetId);
    setTemplateName(saved.name);
    previewTemplate(parameters, saved.stylePresetId);
  };

  const preview = state.editor.signToolPreview;
  return (
    <section className="sign-tools-panel" data-testid="sign-tools-panel">
      <span className="section-label">Sign tools & templates</span>
      <form className="document-form" onSubmit={previewUtility}>
        <label>
          Utility
          <select
            aria-label="Sign utility"
            value={tool}
            onChange={(event) => setTool(event.target.value as ToolKind)}
          >
            <option value="border">Outline / border</option>
            <option value="backing-plate">Backing plate</option>
            <option value="outer-shape">Outer shape</option>
            <option value="mounting-holes">Mounting holes</option>
            <option value="assembly">Assembly tabs</option>
          </select>
        </label>
        <label>
          Shape
          <select
            aria-label="Sign shape"
            value={shape}
            onChange={(event) => setShape(event.target.value as SignTemplateShape)}
          >
            {SHAPES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          Width / span (mm)
          <input aria-label="Sign width millimeters" type="number" min="0.001" step="any" value={widthMm} onChange={(event) => setWidthMm(event.target.value)} />
        </label>
        <label>
          Height (mm)
          <input aria-label="Sign height millimeters" type="number" min="0.001" step="any" value={heightMm} onChange={(event) => setHeightMm(event.target.value)} />
        </label>
        <label>
          Offset / inset (mm)
          <input aria-label="Sign offset millimeters" type="number" min="0" step="any" value={offsetMm} onChange={(event) => setOffsetMm(event.target.value)} />
        </label>
        <label>
          Feature width / diameter (mm)
          <input aria-label="Sign feature width millimeters" type="number" min="0.001" step="any" value={featureWidthMm} onChange={(event) => setFeatureWidthMm(event.target.value)} />
        </label>
        <label>
          Feature depth (mm)
          <input aria-label="Sign feature depth millimeters" type="number" min="0.001" step="any" value={featureDepthMm} onChange={(event) => setFeatureDepthMm(event.target.value)} />
        </label>
        <label>
          Count
          <input aria-label="Sign feature count" type="number" min="1" max="20" step="1" value={count} onChange={(event) => setCount(event.target.value)} />
        </label>
        <button type="submit" data-testid="preview-sign-utility" disabled={busy}>Preview utility</button>
      </form>

      <form
        className="document-form sign-template-form"
        onSubmit={(event) => {
          event.preventDefault();
          previewTemplate(template);
        }}
      >
        <label>
          Template model
          <select
            aria-label="Sign template model"
            value={template.kind}
            onChange={(event) => setTemplate((current) => ({
              ...current,
              kind: event.target.value as SignTemplateParameters["kind"],
            }))}
          >
            <option value="monogram">Monogram</option>
            <option value="address">Address</option>
            <option value="family-name">Family name</option>
            <option value="badge">Badge</option>
          </select>
        </label>
        <label>
          Licensed style
          <select aria-label="Sign style preset" value={stylePresetId} onChange={(event) => setStylePresetId(event.target.value)}>
            {SIGN_STYLE_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
          </select>
        </label>
        <label>
          Primary text
          <input aria-label="Sign primary text" maxLength={200} value={template.primaryText} onChange={(event) => setTemplate((current) => ({ ...current, primaryText: event.target.value }))} />
        </label>
        <label>
          Secondary text
          <input aria-label="Sign secondary text" maxLength={200} value={template.secondaryText} onChange={(event) => setTemplate((current) => ({ ...current, secondaryText: event.target.value }))} />
        </label>
        <label>
          Width (mm)
          <input aria-label="Template width millimeters" type="number" min="0.001" step="any" value={template.widthMm} onChange={(event) => setTemplate((current) => ({ ...current, widthMm: numberValue(event.target.value, current.widthMm) }))} />
        </label>
        <label>
          Height (mm)
          <input aria-label="Template height millimeters" type="number" min="0.001" step="any" value={template.heightMm} onChange={(event) => setTemplate((current) => ({ ...current, heightMm: numberValue(event.target.value, current.heightMm) }))} />
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={template.arcRadiusMm !== null}
            onChange={(event) => setTemplate((current) => ({
              ...current,
              arcRadiusMm: event.target.checked ? current.widthMm * 0.34 : null,
            }))}
          />
          Arc primary text
        </label>
        <button type="submit" data-testid="preview-sign-template" disabled={busy}>Preview 24-inch template</button>
      </form>

      {preview !== null ? (
        <div className="interchange-summary" data-testid="sign-tool-preview-summary">
          <strong>{preview.summary.operation}: {String(preview.summary.objectCount)} editable object(s)</strong>
          <span>Original geometry is unchanged until accepted.</span>
          {preview.summary.warnings.map((warning) => <small key={warning}>{warning}</small>)}
          <div className="button-grid compact">
            <button type="button" data-testid="accept-sign-tool" disabled={busy} onClick={() => void run(() => window.laserx.acceptSignTool())}>Accept</button>
            <button type="button" className="quiet" data-testid="reject-sign-tool" disabled={busy} onClick={() => void run(() => window.laserx.rejectSignTool())}>Reject</button>
          </div>
          {preview.template !== null ? (
            <div className="template-save-row">
              <input aria-label="Saved template name" maxLength={100} value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
              <button type="button" data-testid="save-sign-template" disabled={busy || templateName.trim() === ""} onClick={() => void run(() => window.laserx.saveSignTemplate({ name: templateName }))}>Save template</button>
            </div>
          ) : null}
        </div>
      ) : null}

      {state.project.document.templates.length > 0 ? (
        <ul className="guide-list" data-testid="saved-sign-templates">
          {state.project.document.templates.map((saved) => (
            <li key={saved.id}>
              <button type="button" disabled={busy} onClick={() => loadSavedTemplate(saved.id)}>{saved.name}</button>
              <button type="button" aria-label={`Delete ${saved.name}`} disabled={busy} onClick={() => void run(() => window.laserx.deleteSignTemplate({ templateId: saved.id }))}>Delete</button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
