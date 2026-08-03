import { describe, expect, it } from "vitest";

import { capturePreviewPng, type CapturableCanvas } from "../src/capturePng";

const VALID_PNG_DATA_URL =
  "data:image/png;base64," +
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function mockCanvas(overrides: Partial<CapturableCanvas> = {}): CapturableCanvas {
  return {
    width: 800,
    height: 600,
    toDataURL: () => VALID_PNG_DATA_URL,
    ...overrides,
  };
}

describe("capturePreviewPng", () => {
  it("succeeds for a non-empty rendered canvas", () => {
    const result = capturePreviewPng(mockCanvas(), "shot.png");
    expect(result.ok).toBe(true);
    expect(result.filename).toBe("shot.png");
    expect(result.dataUrl).toBe(VALID_PNG_DATA_URL);
    expect(result.byteLength).toBeGreaterThan(0);
  });

  it("fails when the canvas has zero pixel dimensions", () => {
    const result = capturePreviewPng(mockCanvas({ width: 0 }), "shot.png");
    expect(result.ok).toBe(false);
    expect(result.filename).toBe("shot.png");
    expect(result.errorMessage).toMatch(/no rendered pixels/);
  });

  it("fails when toDataURL returns the empty-canvas sentinel", () => {
    const result = capturePreviewPng(mockCanvas({ toDataURL: () => "data:," }), "shot.png");
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toMatch(/no image data/);
  });

  it("fails when the captured image is implausibly small", () => {
    const result = capturePreviewPng(
      mockCanvas({ toDataURL: () => "data:image/png;base64,AA==" }),
      "shot.png",
    );
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toMatch(/unexpectedly small/);
  });

  it("fails cleanly, without throwing, when toDataURL itself throws", () => {
    const result = capturePreviewPng(
      mockCanvas({
        toDataURL: () => {
          throw new Error("SecurityError: tainted canvas");
        },
      }),
      "shot.png",
    );
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain("tainted canvas");
  });

  it("is deterministic for the same canvas state", () => {
    const canvas = mockCanvas();
    const first = capturePreviewPng(canvas, "shot.png");
    const second = capturePreviewPng(canvas, "shot.png");
    expect(second).toEqual(first);
  });
});
