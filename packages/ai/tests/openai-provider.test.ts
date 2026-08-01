import type { AiGenerationRequest } from "../src/index.js";
import {
  AiProviderError,
  OpenAiProvider,
  classifyOpenAiHttpError,
  validateAiGenerationRequest,
} from "../src/index.js";
import { describe, expect, it, vi } from "vitest";

const request: AiGenerationRequest = {
  operationId: "10000000-0000-4000-8000-000000000001",
  prompt: "A clean industrial address sign",
  wording: "1042 OAK STREET",
  widthMm: 609.6,
  heightMm: 304.8,
  style: "industrial",
  process: "plasma",
  detailLevel: "balanced",
  bridgePreference: "automatic",
  holes: { enabled: true, diameterMm: 6, insetMm: 25.4 },
  layerCount: 2,
  backingPlate: true,
  conceptCount: 3,
  referenceImage: null,
};

function concept(index: number) {
  return {
    title: `Concept ${String(index)}`,
    description: "Deterministic LaserX template intent",
    observedWording: "1042 OAK STREET",
    kind: "address",
    stylePresetId: "industrial-stencil",
    primaryText: "1042",
    secondaryText: "OAK STREET",
    borderWidthMm: 12,
    fontSizeMm: 42,
    arcRadiusMm: null,
    backingPlate: true,
    layerCount: 2,
  };
}

describe("OpenAI provider boundary", () => {
  it("sends a private structured Responses request and validates concepts", async () => {
    const fetchMock = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      if (typeof init?.body !== "string") throw new Error("Expected a JSON string body.");
      const body = JSON.parse(init.body) as Record<string, unknown>;
      expect(init.method).toBe("POST");
      expect(body.store).toBe(false);
      expect(body.reasoning).toEqual({ effort: "low" });
      expect(body.text).toMatchObject({
        format: { type: "json_schema", strict: true },
      });
      const serialized = JSON.stringify(body);
      expect(serialized).not.toContain("sk-test-secret");
      return Promise.resolve(new Response(JSON.stringify({
        id: "resp_test",
        model: "gpt-5.6-sol-2026-07-01",
        output: [{
          type: "message",
          content: [{
            type: "output_text",
            text: JSON.stringify({ concepts: [concept(1), concept(2), concept(3)] }),
          }],
        }],
        usage: { input_tokens: 120, output_tokens: 80, total_tokens: 200 },
      }), { status: 200, headers: { "content-type": "application/json" } }));
    });
    const provider = new OpenAiProvider({ fetch: fetchMock });
    const result = await provider.generate(
      request,
      "sk-test-secret-value-long-enough",
      new AbortController().signal,
    );
    expect(result.concepts).toHaveLength(3);
    expect(result.concepts[0]).toMatchObject({
      source: "structured-vector",
      observedWording: request.wording,
    });
    expect(result.usage.totalTokens).toBe(200);
  });

  it("bounds prompts, dimensions, concepts, and consented reference images", () => {
    expect(() => validateAiGenerationRequest({ ...request, prompt: "" })).toThrow(/Prompt/u);
    expect(() => validateAiGenerationRequest({ ...request, conceptCount: 5 })).toThrow(/2 to 4/u);
    expect(() => validateAiGenerationRequest({
      ...request,
      referenceImage: {
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,AAAA",
        widthPx: 100,
        heightPx: 100,
        byteLength: 4,
        consent: true,
      },
    })).not.toThrow();
  });

  it("distinguishes invalid keys, exhausted credit, and retryable rate limits", () => {
    expect(classifyOpenAiHttpError(401, null).kind).toBe("invalid-key");
    expect(classifyOpenAiHttpError(429, {
      error: { code: "credit_balance_exhausted" },
    }).kind).toBe("no-credit");
    const limited = classifyOpenAiHttpError(
      429,
      { error: { code: "rate_limit_exceeded" } },
      new Headers({ "retry-after": "2" }),
    );
    expect(limited.kind).toBe("rate-limited");
    expect(limited.retryAfterMs).toBe(2_000);
  });

  it("turns cancellation and malformed output into safe provider errors", async () => {
    const canceledProvider = new OpenAiProvider({
      fetch: (_url, init) => {
        init?.signal?.throwIfAborted();
        return Promise.reject(new DOMException("aborted", "AbortError"));
      },
    });
    const controller = new AbortController();
    controller.abort();
    await expect(canceledProvider.generate(
      request,
      "sk-test-secret-value-long-enough",
      controller.signal,
    )).rejects.toMatchObject({ kind: "canceled" });

    const malformedProvider = new OpenAiProvider({
      fetch: () => Promise.resolve(new Response(
        JSON.stringify({ output_text: "{}" }),
        { status: 200 },
      )),
    });
    await expect(malformedProvider.generate(
      request,
      "sk-test-secret-value-long-enough",
      new AbortController().signal,
    )).rejects.toBeInstanceOf(AiProviderError);
  });
});
