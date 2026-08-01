import type {
  ManufacturingProcess,
  SignTemplateKind,
} from "@laserx/domain";
import type { AiUsage } from "./concept.js";

export type {
  AiConceptSummary,
  AiNormalizedConcept,
  AiUsage,
} from "./concept.js";

export const OPENAI_PROVIDER_ID = "openai";
export const OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";
export const OPENAI_PLATFORM_SETUP_URL =
  "https://platform.openai.com/settings/organization/api-keys";
export const OPENAI_PLATFORM_BILLING_URL =
  "https://platform.openai.com/settings/organization/billing";

export interface OpenAiProviderPolicy {
  model: string;
  modelDocumentationUrl: string;
  verifiedOn: string;
}

export const OPENAI_PROVIDER_POLICY: Readonly<OpenAiProviderPolicy> = Object.freeze({
  model: "gpt-5.6-sol",
  modelDocumentationUrl: "https://developers.openai.com/api/docs/models/gpt-5.6-sol",
  verifiedOn: "2026-08-01",
});

export const AI_LIMITS = Object.freeze({
  promptCharacters: 2_000,
  wordingCharacters: 200,
  conceptCount: 4,
  referenceBytes: 8 * 1024 * 1024,
  referencePixels: 12_000_000,
  outputTokens: 6_000,
  editableObjects: 10_000,
});

export type AiConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "invalid-key"
  | "no-credit"
  | "rate-limited"
  | "offline"
  | "unavailable";

export interface AiConnectionState {
  providerId: string;
  providerName: string;
  status: AiConnectionStatus;
  model: string;
  message: string;
  retryAfterMs: number | null;
}

export interface AiReferenceImage {
  mimeType: "image/png" | "image/jpeg";
  dataUrl: string;
  widthPx: number;
  heightPx: number;
  byteLength: number;
  consent: true;
}

export type AiStyle =
  | "auto"
  | "motorcycle-badge"
  | "farmhouse"
  | "industrial"
  | "address-sign";
export type AiDetailLevel = "simple" | "balanced" | "detailed";
export type AiBridgePreference = "none" | "automatic" | "manual";

export interface AiGenerationRequest {
  operationId: string;
  prompt: string;
  wording: string;
  widthMm: number;
  heightMm: number;
  style: AiStyle;
  process: ManufacturingProcess;
  detailLevel: AiDetailLevel;
  bridgePreference: AiBridgePreference;
  holes: {
    enabled: boolean;
    diameterMm: number;
    insetMm: number;
  };
  layerCount: number;
  backingPlate: boolean;
  conceptCount: number;
  referenceImage: AiReferenceImage | null;
}

export interface AiStructuredIntent {
  kind: SignTemplateKind;
  stylePresetId:
    | "industrial-stencil"
    | "classic-slab"
    | "western-badge";
  primaryText: string;
  secondaryText: string;
  borderWidthMm: number;
  fontSizeMm: number;
  arcRadiusMm: number | null;
  backingPlate: boolean;
  layerCount: number;
}

export interface AiRasterArtifact {
  mimeType: "image/png" | "image/jpeg";
  dataUrl: string;
  widthPx: number;
  heightPx: number;
  byteLength: number;
}

interface AiConceptBase {
  id: string;
  title: string;
  description: string;
  observedWording: string;
  warnings: string[];
}

export type AiProviderConcept =
  | (AiConceptBase & {
      source: "structured-vector";
      intent: AiStructuredIntent;
    })
  | (AiConceptBase & {
      source: "raster-trace";
      raster: AiRasterArtifact;
    });

export interface AiProviderResult {
  providerId: string;
  model: string;
  requestId: string | null;
  concepts: AiProviderConcept[];
  usage: AiUsage;
}

export interface AiProvider {
  readonly id: string;
  readonly name: string;
  readonly model: string;
  testConnection(credential: string, signal?: AbortSignal): Promise<void>;
  generate(
    request: AiGenerationRequest,
    credential: string,
    signal: AbortSignal,
  ): Promise<AiProviderResult>;
}

export type AiProviderErrorKind =
  | "invalid-key"
  | "model-unavailable"
  | "no-credit"
  | "rate-limited"
  | "offline"
  | "unavailable"
  | "refused"
  | "invalid-response"
  | "canceled";

export class AiProviderError extends Error {
  public readonly kind: AiProviderErrorKind;
  public readonly retryAfterMs: number | null;

  public constructor(
    kind: AiProviderErrorKind,
    message: string,
    retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = "AiProviderError";
    this.kind = kind;
    this.retryAfterMs = retryAfterMs;
  }
}

function assertFinitePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive finite number.`);
  }
}

function assertBoundedText(
  value: string,
  label: string,
  maximum: number,
  allowEmpty = false,
): void {
  if ((!allowEmpty && value.trim().length === 0) || value.length > maximum) {
    throw new RangeError(`${label} must contain ${allowEmpty ? "0 to " : "1 to "}${String(maximum)} characters.`);
  }
}

export function validateAiGenerationRequest(
  request: AiGenerationRequest,
): AiGenerationRequest {
  assertBoundedText(request.operationId, "Operation ID", 200);
  assertBoundedText(request.prompt, "Prompt", AI_LIMITS.promptCharacters);
  assertBoundedText(request.wording, "Wording", AI_LIMITS.wordingCharacters);
  assertFinitePositive(request.widthMm, "Width");
  assertFinitePositive(request.heightMm, "Height");
  if (request.widthMm > 100_000 || request.heightMm > 100_000) {
    throw new RangeError("AI sign dimensions cannot exceed 100,000 mm.");
  }
  if (
    !Number.isInteger(request.layerCount) ||
    request.layerCount < 1 ||
    request.layerCount > 3
  ) {
    throw new RangeError("AI sign layer count must be from 1 to 3.");
  }
  if (
    !Number.isInteger(request.conceptCount) ||
    request.conceptCount < 2 ||
    request.conceptCount > AI_LIMITS.conceptCount
  ) {
    throw new RangeError("AI generation requires 2 to 4 concepts.");
  }
  if (request.holes.enabled) {
    assertFinitePositive(request.holes.diameterMm, "Mounting-hole diameter");
    assertFinitePositive(request.holes.insetMm, "Mounting-hole inset");
  }
  if (request.referenceImage !== null) {
    const reference = request.referenceImage;
    if (
      reference.byteLength <= 0 ||
      reference.byteLength > AI_LIMITS.referenceBytes ||
      !Number.isInteger(reference.widthPx) ||
      !Number.isInteger(reference.heightPx) ||
      reference.widthPx <= 0 ||
      reference.heightPx <= 0 ||
      reference.widthPx * reference.heightPx > AI_LIMITS.referencePixels ||
      !reference.dataUrl.startsWith(`data:${reference.mimeType};base64,`)
    ) {
      throw new RangeError("AI reference image consent or bounds are invalid.");
    }
  }
  return structuredClone(request);
}

function connectionErrorMessage(kind: AiProviderErrorKind): string {
  switch (kind) {
    case "invalid-key":
      return "The OpenAI API key is invalid or not authorized for this project.";
    case "model-unavailable":
      return "The configured OpenAI model is unavailable to this API project. Verify model access or update the provider policy.";
    case "no-credit":
      return "The OpenAI account has no available credit or has reached a spending limit.";
    case "rate-limited":
      return "OpenAI rate-limited this request. Retry after the displayed delay.";
    case "offline":
      return "OpenAI could not be reached. Check the network connection and retry.";
    case "canceled":
      return "AI generation was canceled; the open project was left unchanged.";
    case "refused":
      return "OpenAI declined this request. Revise the prompt and avoid protected-logo replication.";
    case "invalid-response":
      return "OpenAI returned a result that did not satisfy the LaserX concept contract.";
    default:
      return "OpenAI is temporarily unavailable. Retry without changing the open project.";
  }
}

function safeRetryAfter(headers: Headers): number | null {
  const raw = headers.get("retry-after");
  if (raw === null) return null;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1_000 : null;
}

function bodyErrorCode(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("error" in body)) return null;
  const error = (body as { error?: unknown }).error;
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  return typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : null;
}

export function classifyOpenAiHttpError(
  status: number,
  body: unknown,
  headers = new Headers(),
): AiProviderError {
  const code = bodyErrorCode(body);
  if (
    status === 404 ||
    ["invalid_model", "model_not_available", "model_not_found", "unsupported_model"].includes(code ?? "")
  ) {
    return new AiProviderError(
      "model-unavailable",
      connectionErrorMessage("model-unavailable"),
    );
  }
  if (status === 401 || status === 403) {
    return new AiProviderError("invalid-key", connectionErrorMessage("invalid-key"));
  }
  if (
    status === 429 &&
    [
      "credit_balance_exhausted",
      "organization_spend_limit_exceeded",
      "project_spend_limit_exceeded",
      "organization_usage_limit_exceeded",
    ].includes(code ?? "")
  ) {
    return new AiProviderError("no-credit", connectionErrorMessage("no-credit"));
  }
  if (status === 429) {
    return new AiProviderError(
      "rate-limited",
      connectionErrorMessage("rate-limited"),
      safeRetryAfter(headers),
    );
  }
  return new AiProviderError("unavailable", connectionErrorMessage("unavailable"));
}

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface OpenAiProviderOptions {
  fetch?: FetchLike;
  policy?: Readonly<OpenAiProviderPolicy>;
  responsesEndpoint?: string;
  modelsEndpoint?: string;
}

const conceptJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["concepts"],
  properties: {
    concepts: {
      type: "array",
      minItems: 2,
      maxItems: AI_LIMITS.conceptCount,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "description",
          "observedWording",
          "kind",
          "stylePresetId",
          "primaryText",
          "secondaryText",
          "borderWidthMm",
          "fontSizeMm",
          "arcRadiusMm",
          "backingPlate",
          "layerCount",
        ],
        properties: {
          title: { type: "string", minLength: 1, maxLength: 100 },
          description: { type: "string", minLength: 1, maxLength: 300 },
          observedWording: { type: "string", minLength: 1, maxLength: 200 },
          kind: { enum: ["monogram", "address", "family-name", "badge"] },
          stylePresetId: {
            enum: ["industrial-stencil", "classic-slab", "western-badge"],
          },
          primaryText: { type: "string", minLength: 1, maxLength: 200 },
          secondaryText: { type: "string", maxLength: 200 },
          borderWidthMm: { type: "number", exclusiveMinimum: 0 },
          fontSizeMm: { type: "number", exclusiveMinimum: 0 },
          arcRadiusMm: { anyOf: [{ type: "number", exclusiveMinimum: 0 }, { type: "null" }] },
          backingPlate: { type: "boolean" },
          layerCount: { type: "integer", minimum: 1, maximum: 3 },
        },
      },
    },
  },
} as const;

function requestPrompt(request: AiGenerationRequest): string {
  return [
    "Create distinct editable metal-sign concepts from the bounded user intent below.",
    "Preserve the requested wording exactly in primaryText/secondaryText and observedWording.",
    "Choose only the allowed LaserX template kinds and style presets.",
    "Do not reproduce protected logos or trademarks. Use general style characteristics only.",
    "LaserX, not the model, owns final dimensions, layers, holes, bridges, geometry, and cutability.",
    JSON.stringify({
      prompt: request.prompt,
      wording: request.wording,
      dimensionsMm: { width: request.widthMm, height: request.heightMm },
      style: request.style,
      process: request.process,
      detailLevel: request.detailLevel,
      bridgePreference: request.bridgePreference,
      holes: request.holes,
      layerCount: request.layerCount,
      backingPlate: request.backingPlate,
      conceptCount: request.conceptCount,
      referenceImageAttached: request.referenceImage !== null,
    }),
  ].join("\n");
}

function outputText(body: unknown): string {
  if (typeof body !== "object" || body === null) {
    throw new AiProviderError("invalid-response", connectionErrorMessage("invalid-response"));
  }
  const response = body as {
    output_text?: unknown;
    output?: unknown;
  };
  if (typeof response.output_text === "string") return response.output_text;
  if (Array.isArray(response.output)) {
    for (const item of response.output) {
      if (typeof item !== "object" || item === null || !("content" in item)) continue;
      const content = (item as { content?: unknown }).content;
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        if (
          typeof part === "object" &&
          part !== null &&
          (part as { type?: unknown }).type === "refusal"
        ) {
          throw new AiProviderError("refused", connectionErrorMessage("refused"));
        }
        if (
          typeof part === "object" &&
          part !== null &&
          (part as { type?: unknown }).type === "output_text" &&
          typeof (part as { text?: unknown }).text === "string"
        ) {
          return (part as { text: string }).text;
        }
      }
    }
  }
  throw new AiProviderError("invalid-response", connectionErrorMessage("invalid-response"));
}

const templateKinds = new Set<SignTemplateKind>([
  "monogram",
  "address",
  "family-name",
  "badge",
]);
const stylePresetIds = new Set<AiStructuredIntent["stylePresetId"]>([
  "industrial-stencil",
  "classic-slab",
  "western-badge",
]);

function parsedConcepts(text: string, expectedCount: number): AiProviderConcept[] {
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    throw new AiProviderError("invalid-response", connectionErrorMessage("invalid-response"));
  }
  if (typeof decoded !== "object" || decoded === null || !("concepts" in decoded)) {
    throw new AiProviderError("invalid-response", connectionErrorMessage("invalid-response"));
  }
  const concepts = (decoded as { concepts?: unknown }).concepts;
  if (!Array.isArray(concepts) || concepts.length !== expectedCount) {
    throw new AiProviderError("invalid-response", connectionErrorMessage("invalid-response"));
  }
  return concepts.map((concept, index): AiProviderConcept => {
    if (typeof concept !== "object" || concept === null) {
      throw new AiProviderError("invalid-response", connectionErrorMessage("invalid-response"));
    }
    const value = concept as Record<string, unknown>;
    const kind = value.kind;
    const stylePresetId = value.stylePresetId;
    const title = value.title;
    const description = value.description;
    const observedWording = value.observedWording;
    const primaryText = value.primaryText;
    const secondaryText = value.secondaryText;
    const borderWidthMm = value.borderWidthMm;
    const fontSizeMm = value.fontSizeMm;
    const arcRadiusMm = value.arcRadiusMm;
    const backingPlate = value.backingPlate;
    const layerCount = value.layerCount;
    if (
      typeof title !== "string" || title.length === 0 || title.length > 100 ||
      typeof description !== "string" || description.length === 0 || description.length > 300 ||
      typeof observedWording !== "string" || observedWording.length === 0 || observedWording.length > 200 ||
      typeof primaryText !== "string" || primaryText.length === 0 || primaryText.length > 200 ||
      typeof secondaryText !== "string" || secondaryText.length > 200 ||
      typeof kind !== "string" || !templateKinds.has(kind as SignTemplateKind) ||
      typeof stylePresetId !== "string" || !stylePresetIds.has(stylePresetId as AiStructuredIntent["stylePresetId"]) ||
      typeof borderWidthMm !== "number" || !Number.isFinite(borderWidthMm) || borderWidthMm <= 0 ||
      typeof fontSizeMm !== "number" || !Number.isFinite(fontSizeMm) || fontSizeMm <= 0 ||
      (arcRadiusMm !== null && (typeof arcRadiusMm !== "number" || !Number.isFinite(arcRadiusMm) || arcRadiusMm <= 0)) ||
      typeof backingPlate !== "boolean" ||
      typeof layerCount !== "number" || !Number.isInteger(layerCount) || layerCount < 1 || layerCount > 3
    ) {
      throw new AiProviderError("invalid-response", connectionErrorMessage("invalid-response"));
    }
    return {
      id: `concept-${String(index + 1)}`,
      title,
      description,
      observedWording,
      warnings: [],
      source: "structured-vector",
      intent: {
        kind: kind as SignTemplateKind,
        stylePresetId: stylePresetId as AiStructuredIntent["stylePresetId"],
        primaryText,
        secondaryText,
        borderWidthMm,
        fontSizeMm,
        arcRadiusMm,
        backingPlate,
        layerCount,
      },
    };
  });
}

function usageFromResponse(body: unknown): AiUsage {
  const empty = { inputTokens: null, outputTokens: null, totalTokens: null };
  if (typeof body !== "object" || body === null || !("usage" in body)) return empty;
  const usage = (body as { usage?: unknown }).usage;
  if (typeof usage !== "object" || usage === null) return empty;
  const value = usage as Record<string, unknown>;
  return {
    inputTokens: typeof value.input_tokens === "number" ? value.input_tokens : null,
    outputTokens: typeof value.output_tokens === "number" ? value.output_tokens : null,
    totalTokens: typeof value.total_tokens === "number" ? value.total_tokens : null,
  };
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function credentialHeader(credential: string): string {
  const trimmed = credential.trim();
  if (trimmed.length < 20 || /[\r\n]/u.test(trimmed)) {
    throw new AiProviderError("invalid-key", connectionErrorMessage("invalid-key"));
  }
  return `Bearer ${trimmed}`;
}

export class OpenAiProvider implements AiProvider {
  public readonly id = OPENAI_PROVIDER_ID;
  public readonly name = "OpenAI";
  public readonly model: string;
  readonly #fetch: FetchLike;
  readonly #responsesEndpoint: string;
  readonly #modelsEndpoint: string;

  public constructor(options: OpenAiProviderOptions = {}) {
    const policy = options.policy ?? OPENAI_PROVIDER_POLICY;
    if (policy.model.trim().length === 0) {
      throw new RangeError("The OpenAI provider policy requires a model ID.");
    }
    this.model = policy.model;
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.#responsesEndpoint = options.responsesEndpoint ?? OPENAI_RESPONSES_ENDPOINT;
    this.#modelsEndpoint = options.modelsEndpoint ?? "https://api.openai.com/v1/models";
  }

  public async testConnection(
    credential: string,
    signal?: AbortSignal,
  ): Promise<void> {
    let response: Response;
    try {
      response = await this.#fetch(`${this.#modelsEndpoint}/${encodeURIComponent(this.model)}`, {
        method: "GET",
        headers: { authorization: credentialHeader(credential) },
        ...(signal === undefined ? {} : { signal }),
      });
    } catch (error) {
      if (signal?.aborted === true || (error instanceof Error && error.name === "AbortError")) {
        throw new AiProviderError("canceled", connectionErrorMessage("canceled"));
      }
      throw new AiProviderError("offline", connectionErrorMessage("offline"));
    }
    if (!response.ok) {
      throw classifyOpenAiHttpError(response.status, await safeJson(response), response.headers);
    }
  }

  public async generate(
    request: AiGenerationRequest,
    credential: string,
    signal: AbortSignal,
  ): Promise<AiProviderResult> {
    const validated = validateAiGenerationRequest(request);
    const content: Array<Record<string, unknown>> = [
      { type: "input_text", text: requestPrompt(validated) },
    ];
    if (validated.referenceImage !== null) {
      content.push({
        type: "input_image",
        image_url: validated.referenceImage.dataUrl,
        detail: "low",
      });
    }
    let response: Response;
    try {
      response = await this.#fetch(this.#responsesEndpoint, {
        method: "POST",
        headers: {
          authorization: credentialHeader(credential),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          store: false,
          reasoning: { effort: "low" },
          max_output_tokens: AI_LIMITS.outputTokens,
          input: [{ role: "user", content }],
          text: {
            format: {
              type: "json_schema",
              name: "laserx_sign_concepts",
              strict: true,
              schema: conceptJsonSchema,
            },
          },
        }),
        signal,
      });
    } catch (error) {
      if (signal.aborted || (error instanceof Error && error.name === "AbortError")) {
        throw new AiProviderError("canceled", connectionErrorMessage("canceled"));
      }
      throw new AiProviderError("offline", connectionErrorMessage("offline"));
    }
    const body = await safeJson(response);
    if (!response.ok) {
      throw classifyOpenAiHttpError(response.status, body, response.headers);
    }
    const concepts = parsedConcepts(outputText(body), validated.conceptCount);
    const responseObject = typeof body === "object" && body !== null
      ? body as Record<string, unknown>
      : {};
    return {
      providerId: this.id,
      model: typeof responseObject.model === "string" ? responseObject.model : this.model,
      requestId: typeof responseObject.id === "string" ? responseObject.id : null,
      concepts,
      usage: usageFromResponse(body),
    };
  }
}

export function connectionStateForError(
  provider: Pick<AiProvider, "id" | "name" | "model">,
  error: unknown,
): AiConnectionState {
  const providerError = error instanceof AiProviderError
    ? error
    : new AiProviderError("unavailable", connectionErrorMessage("unavailable"));
  const status: AiConnectionStatus = providerError.kind === "canceled" || providerError.kind === "refused" || providerError.kind === "invalid-response" || providerError.kind === "model-unavailable"
    ? "unavailable"
    : providerError.kind;
  return {
    providerId: provider.id,
    providerName: provider.name,
    status,
    model: provider.model,
    message: providerError.message,
    retryAfterMs: providerError.retryAfterMs,
  };
}
