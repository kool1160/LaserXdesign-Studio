import { describe, expect, it } from "vitest";

import {
  ElectronRasterCodec,
  encodeRgbaPng,
} from "../../electron/raster-codec.js";

describe("Electron raster codec boundary", () => {
  it("normalizes Electron PNG output to exact RGBA and emits bounded data URLs", () => {
    const rgba = new Uint8Array([
      255, 0, 0, 255,
      0, 255, 0, 128,
      0, 0, 255, 255,
      255, 255, 255, 0,
    ]);
    const normalizedPng = encodeRgbaPng(2, 2, rgba);
    const codec = new ElectronRasterCodec({
      createFromBuffer: () => ({
        isEmpty: () => false,
        getSize: () => ({ width: 2, height: 2 }),
        toPNG: () => normalizedPng,
      }),
    });
    const metadata = {
      format: "png" as const,
      widthPx: 2,
      heightPx: 2,
      sourceBytes: 40,
      decodedBytes: 16,
    };

    expect(codec.decode(new Uint8Array([1]), metadata)).toEqual({
      widthPx: 2,
      heightPx: 2,
      rgba,
    });
    const preview = codec.encodePreview({
      widthPx: 2,
      heightPx: 2,
      originalRgba: rgba,
      blackWhiteRgba: rgba,
      edgeRgba: rgba,
    });
    expect(preview.original).toMatch(/^data:image\/png;base64,/u);
    expect(preview.blackWhite).toBe(preview.original);
  });

  it("rejects empty native decodes and header/decode dimension disagreement", () => {
    const empty = new ElectronRasterCodec({
      createFromBuffer: () => ({
        isEmpty: () => true,
        getSize: () => ({ width: 0, height: 0 }),
        toPNG: () => Buffer.alloc(0),
      }),
    });
    const metadata = {
      format: "jpeg" as const,
      widthPx: 2,
      heightPx: 2,
      sourceBytes: 40,
      decodedBytes: 16,
    };
    expect(() => empty.decode(new Uint8Array([1]), metadata)).toThrow(/could not decode/u);

    const mismatch = new ElectronRasterCodec({
      createFromBuffer: () => ({
        isEmpty: () => false,
        getSize: () => ({ width: 3, height: 2 }),
        toPNG: () => Buffer.alloc(0),
      }),
    });
    expect(() => mismatch.decode(new Uint8Array([1]), metadata)).toThrow(/dimensions/u);
  });
});
