import {
  AiProviderError,
  validateAiGenerationRequest,
  type AiGenerationRequest,
  type AiProvider,
  type AiProviderResult,
} from "@laserx/ai";

import type {
  CredentialAcquisitionPort,
  CredentialVaultPort,
} from "./ai-credentials.js";

async function waitForMock(delayMs: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  if (delayMs <= 0) return;
  await new Promise<void>((resolveWait, rejectWait) => {
    const timer = setTimeout(resolveWait, delayMs);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      rejectWait(new AiProviderError("canceled", "Mock AI generation was canceled."));
    }, { once: true });
  });
}

export class DeterministicAiProvider implements AiProvider {
  public readonly id = "openai";
  public readonly name = "OpenAI (deterministic test provider)";
  public readonly model = "gpt-5.6-sol-test-fixture";
  readonly #delayMs: number;

  public constructor(delayMs = 0) {
    this.#delayMs = delayMs;
  }

  public testConnection(credential: string, signal?: AbortSignal): Promise<void> {
    void credential;
    signal?.throwIfAborted();
    return Promise.resolve();
  }

  public async generate(
    request: AiGenerationRequest,
    credential: string,
    signal: AbortSignal,
  ): Promise<AiProviderResult> {
    const validated = validateAiGenerationRequest(request);
    void credential;
    await waitForMock(this.#delayMs, signal);
    return {
      providerId: this.id,
      model: this.model,
      requestId: "mock-response-m10",
      concepts: Array.from({ length: validated.conceptCount }, (_, index) => {
        const mismatch = index === 0;
        const primaryText = mismatch ? "REVIEW WORDING" : validated.wording;
        return {
          id: `mock-concept-${String(index + 1)}`,
          title: `Editable concept ${String(index + 1)}`,
          description: "Deterministic structured sign intent for packaged verification.",
          source: "structured-vector" as const,
          observedWording: primaryText,
          warnings: [],
          intent: {
            kind: "badge" as const,
            stylePresetId: index % 2 === 0
              ? "industrial-stencil" as const
              : "classic-slab" as const,
            primaryText,
            secondaryText: "",
            borderWidthMm: Math.max(2, Math.min(12, validated.heightMm * 0.08)),
            fontSizeMm: Math.max(8, Math.min(42, validated.heightMm * 0.22)),
            arcRadiusMm: null,
            backingPlate: validated.backingPlate,
            layerCount: validated.layerCount,
          },
        };
      }),
      usage: {
        inputTokens: 120,
        outputTokens: 240,
        totalTokens: 360,
      },
    };
  }
}

export class MemoryCredentialVault implements CredentialVaultPort {
  #credential: string | null;

  public constructor(initialCredential: string | null = null) {
    this.#credential = initialCredential;
  }

  public read(providerId?: string): Promise<string | null> {
    void providerId;
    return Promise.resolve(this.#credential);
  }

  public write(providerId: string, credential: string): Promise<void> {
    void providerId;
    this.#credential = credential;
    return Promise.resolve();
  }

  public delete(providerId?: string): Promise<void> {
    void providerId;
    this.#credential = null;
    return Promise.resolve();
  }
}

export class FixedCredentialAcquisition implements CredentialAcquisitionPort {
  readonly #credential: string;

  public constructor(credential: string) {
    this.#credential = credential;
  }

  public acquire(
    _providerName?: string,
    _replacing?: boolean,
    signal?: AbortSignal,
  ): Promise<string> {
    if (signal?.aborted === true) {
      return Promise.reject(new Error("Credential acquisition was canceled."));
    }
    return Promise.resolve(this.#credential);
  }
}

export class WaitingCredentialAcquisition implements CredentialAcquisitionPort {
  public acquire(
    _providerName: string,
    _replacing: boolean,
    signal: AbortSignal,
  ): Promise<null> {
    return new Promise((resolve) => {
      if (signal.aborted) {
        resolve(null);
        return;
      }
      signal.addEventListener("abort", () => resolve(null), { once: true });
    });
  }
}
