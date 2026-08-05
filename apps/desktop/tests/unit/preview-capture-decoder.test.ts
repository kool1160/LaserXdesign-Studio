import { describe, expect, it } from "vitest";

import {
  createElectronPreviewCaptureDecoder,
  unavailablePreviewCaptureDecoder,
  type NativeImageLike,
} from "../../electron/preview-capture-decoder.js";

function imageOf(width: number, height: number, empty = false): NativeImageLike {
  return {
    isEmpty: () => empty,
    getSize: () => ({ width, height }),
  };
}

describe("unavailablePreviewCaptureDecoder", () => {
  it("rejects everything, so an unwired decoder fails closed", () => {
    expect(unavailablePreviewCaptureDecoder.decode(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe("createElectronPreviewCaptureDecoder", () => {
  it("returns the decoded dimensions for a real image", () => {
    const decoder = createElectronPreviewCaptureDecoder(() => imageOf(800, 600));

    expect(decoder.decode(new Uint8Array([1, 2, 3]))).toEqual({
      widthPx: 800,
      heightPx: 600,
    });
  });

  it("passes the exact bytes through to the platform decoder", () => {
    const received: Buffer[] = [];
    const decoder = createElectronPreviewCaptureDecoder((buffer) => {
      received.push(buffer);
      return imageOf(4, 2);
    });
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

    decoder.decode(bytes);

    expect(received).toHaveLength(1);
    const passed = received[0];
    if (passed === undefined) throw new Error("Expected the decoder to receive bytes.");
    expect(Buffer.isBuffer(passed)).toBe(true);
    expect(new Uint8Array(passed)).toEqual(bytes);
  });

  it("rejects an empty image, which is how the decoder reports undecodable data", () => {
    const decoder = createElectronPreviewCaptureDecoder(() => imageOf(800, 600, true));

    expect(decoder.decode(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it("rejects rather than propagating a decoder that throws", () => {
    const decoder = createElectronPreviewCaptureDecoder(() => {
      throw new Error("unsupported image format");
    });

    expect(() => decoder.decode(new Uint8Array([1, 2, 3]))).not.toThrow();
    expect(decoder.decode(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it("rejects rather than propagating a throwing getSize", () => {
    const decoder = createElectronPreviewCaptureDecoder(() => ({
      isEmpty: () => false,
      getSize: () => {
        throw new Error("size unavailable");
      },
    }));

    expect(decoder.decode(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it("rejects non-positive or non-integer dimensions", () => {
    for (const [width, height] of [
      [0, 600],
      [800, 0],
      [-1, 600],
      [800.5, 600],
    ] as const) {
      const decoder = createElectronPreviewCaptureDecoder(() => imageOf(width, height));
      expect(decoder.decode(new Uint8Array([1, 2, 3]))).toBeNull();
    }
  });
});
