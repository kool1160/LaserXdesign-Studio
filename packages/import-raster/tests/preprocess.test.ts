import { describe, expect, it } from "vitest";

import {
  createRasterPreviewPixels,
  preprocessRaster,
  settingsForRasterTracePreset,
  type DecodedRaster,
} from "../src/index.js";

function coloredRaster(): DecodedRaster {
  const widthPx = 6;
  const heightPx = 4;
  const rgba = new Uint8Array(widthPx * heightPx * 4).fill(255);
  for (let index = 0; index < widthPx * heightPx; index += 1) {
    rgba[index * 4 + 3] = 255;
  }
  rgba.set([255, 0, 0, 255], 4);
  rgba.set([0, 255, 0, 255], 8);
  rgba.set([0, 0, 255, 0], 12);
  const center = (2 * widthPx + 3) * 4;
  rgba.set([0, 0, 0, 255], center);
  return { widthPx, heightPx, rgba };
}

describe("raster preprocessing controls", () => {
  it("applies explicit grayscale, background, threshold, and invert settings", () => {
    const image = coloredRaster();
    const base = {
      ...settingsForRasterTracePreset("draft"),
      blurRadiusPx: 0,
      denoiseRadiusPx: 0,
      contrast: 0,
      threshold: 100,
      background: "white" as const,
    };
    const luminance = preprocessRaster(image, base);
    const average = preprocessRaster(image, {
      ...base,
      grayscaleMode: "average",
      background: "black",
    });
    expect(luminance.grayscale[1]).toBe(54);
    expect(average.grayscale[1]).toBe(85);
    expect(luminance.originalRgba.slice(12, 16)).toEqual(
      new Uint8Array([255, 255, 255, 255]),
    );
    expect(average.originalRgba.slice(12, 16)).toEqual(
      new Uint8Array([0, 0, 0, 255]),
    );
    const inverted = preprocessRaster(image, { ...base, invert: true });
    expect([...inverted.binary]).toEqual(
      [...luminance.binary].map((value) => value === 1 ? 0 : 1),
    );
  });

  it("crops, rotates, contrasts, blurs, denoises, and creates bounded BW/edge previews", () => {
    const image = coloredRaster();
    const settings = {
      ...settingsForRasterTracePreset("detailed"),
      crop: { left: 1 / 6, top: 0, right: 0, bottom: 0 },
      rotationDeg: 90 as const,
      contrast: 40,
      threshold: 140,
      blurRadiusPx: 1,
      denoiseRadiusPx: 1,
    };
    const processed = preprocessRaster(image, settings);
    expect(processed).toMatchObject({ widthPx: 4, heightPx: 5, downsampled: false });
    expect(processed.grayscale).toHaveLength(20);
    expect(processed.edges.some((value) => value > 0)).toBe(true);

    const preview = createRasterPreviewPixels(processed);
    expect(preview).toMatchObject({ widthPx: 4, heightPx: 5 });
    expect(preview.originalRgba).toHaveLength(80);
    expect(preview.blackWhiteRgba).toHaveLength(80);
    expect(preview.edgeRgba).toHaveLength(80);
  });
});
