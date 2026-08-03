import { describe, expect, it } from "vitest";

import { inspectPng, pngBytesFromDataUrl } from "../bench/png-inspect.mjs";

/** A real, minimal 1x1 PNG. */
const ONE_BY_ONE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const ONE_BY_ONE_PNG_DATA_URL = `data:image/png;base64,${ONE_BY_ONE_PNG_BASE64}`;

describe("inspectPng", () => {
  it("accepts a real PNG and reads its declared dimensions from IHDR", () => {
    const result = inspectPng(pngBytesFromDataUrl(ONE_BY_ONE_PNG_DATA_URL));
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error("Expected a valid inspection.");
    expect(result.widthPx).toBe(1);
    expect(result.heightPx).toBe(1);
    expect(result.byteLength).toBeGreaterThan(0);
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("produces a stable digest for identical bytes and a different one for different bytes", () => {
    const bytes = pngBytesFromDataUrl(ONE_BY_ONE_PNG_DATA_URL);
    const first = inspectPng(bytes);
    const second = inspectPng(pngBytesFromDataUrl(ONE_BY_ONE_PNG_DATA_URL));
    if (!first.valid || !second.valid) throw new Error("Expected valid inspections.");
    expect(second.sha256).toBe(first.sha256);

    const mutated = Uint8Array.from(bytes);
    const lastIndex = mutated.length - 1;
    mutated[lastIndex] = (mutated[lastIndex] ?? 0) ^ 0xff;
    const third = inspectPng(mutated);
    if (!third.valid) throw new Error("Expected a valid inspection.");
    expect(third.sha256).not.toBe(first.sha256);
  });

  it("rejects a buffer that is too short to hold a header", () => {
    const result = inspectPng(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("Expected an invalid inspection.");
    expect(result.reason).toMatch(/Too short/);
  });

  it("rejects bytes without the PNG signature", () => {
    const notPng = new Uint8Array(32).fill(0x41);
    const result = inspectPng(notPng);
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("Expected an invalid inspection.");
    expect(result.reason).toMatch(/signature/);
  });

  it("rejects a PNG whose first chunk is not IHDR", () => {
    const bytes = Uint8Array.from(pngBytesFromDataUrl(ONE_BY_ONE_PNG_DATA_URL));
    // Corrupt the chunk type in place: "IHDR" -> "IHDX".
    bytes[15] = "X".charCodeAt(0);
    const result = inspectPng(bytes);
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("Expected an invalid inspection.");
    expect(result.reason).toMatch(/IHDR/);
  });

  it("rejects a PNG declaring a zero dimension", () => {
    const bytes = Uint8Array.from(pngBytesFromDataUrl(ONE_BY_ONE_PNG_DATA_URL));
    // Zero the IHDR width field.
    bytes[16] = 0;
    bytes[17] = 0;
    bytes[18] = 0;
    bytes[19] = 0;
    const result = inspectPng(bytes);
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("Expected an invalid inspection.");
    expect(result.reason).toMatch(/zero dimension/);
  });
});

describe("pngBytesFromDataUrl", () => {
  it("round-trips the PNG signature out of a data URL", () => {
    const bytes = pngBytesFromDataUrl(ONE_BY_ONE_PNG_DATA_URL);
    expect(Array.from(bytes.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it("throws on a malformed data URL", () => {
    expect(() => pngBytesFromDataUrl("not-a-data-url")).toThrow("Malformed");
  });
});
