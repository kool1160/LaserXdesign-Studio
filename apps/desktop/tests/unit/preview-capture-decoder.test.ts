import { describe, expect, it } from "vitest";

import {
  createElectronPreviewCaptureDecoder,
  unavailablePreviewCaptureDecoder,
  type NativeImageLike,
} from "../../electron/preview-capture-decoder.js";

/** Electron hands back BGRA, so fixtures are authored in that order. */
function bgraImage(
  width: number,
  height: number,
  bgra: readonly [number, number, number, number],
  options: { empty?: boolean; bitmapLength?: number } = {},
): NativeImageLike {
  const length = options.bitmapLength ?? width * height * 4;
  const bitmap = Buffer.alloc(length);
  for (let index = 0; index + 3 < length; index += 4) {
    bitmap[index] = bgra[0];
    bitmap[index + 1] = bgra[1];
    bitmap[index + 2] = bgra[2];
    bitmap[index + 3] = bgra[3];
  }
  return {
    isEmpty: () => options.empty ?? false,
    getSize: () => ({ width, height }),
    toBitmap: () => bitmap,
  };
}

describe("unavailablePreviewCaptureDecoder", () => {
  it("rejects everything, so an unwired decoder fails closed", () => {
    expect(unavailablePreviewCaptureDecoder.decode(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe("createElectronPreviewCaptureDecoder", () => {
  it("returns the decoded dimensions for a real image", () => {
    const decoder = createElectronPreviewCaptureDecoder(() =>
      bgraImage(2, 1, [10, 20, 30, 255]),
    );

    const decoded = decoder.decode(new Uint8Array([1, 2, 3]));

    expect(decoded?.widthPx).toBe(2);
    expect(decoded?.heightPx).toBe(1);
  });

  it("normalises the platform's BGRA bitmap into RGBA", () => {
    // Blue=10, Green=20, Red=30 in BGRA must surface as R=30, G=20, B=10.
    const decoder = createElectronPreviewCaptureDecoder(() =>
      bgraImage(1, 1, [10, 20, 30, 200]),
    );

    const decoded = decoder.decode(new Uint8Array([1, 2, 3]));

    expect(decoded?.rgba).toEqual(new Uint8Array([30, 20, 10, 200]));
  });

  it("returns one RGBA sample per decoded pixel", () => {
    const decoder = createElectronPreviewCaptureDecoder(() =>
      bgraImage(4, 3, [1, 2, 3, 255]),
    );

    expect(decoder.decode(new Uint8Array([1, 2, 3]))?.rgba).toHaveLength(4 * 3 * 4);
  });

  it("passes the exact bytes through to the platform decoder", () => {
    const received: Buffer[] = [];
    const decoder = createElectronPreviewCaptureDecoder((buffer) => {
      received.push(buffer);
      return bgraImage(1, 1, [0, 0, 0, 255]);
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
    const decoder = createElectronPreviewCaptureDecoder(() =>
      bgraImage(8, 8, [0, 0, 0, 255], { empty: true }),
    );

    expect(decoder.decode(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it("rejects a bitmap whose length disagrees with the reported size", () => {
    // Not evidence about this image, so it is a rejection rather than
    // something to reinterpret against the smaller buffer.
    const decoder = createElectronPreviewCaptureDecoder(() =>
      bgraImage(8, 8, [0, 0, 0, 255], { bitmapLength: 16 }),
    );

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
      toBitmap: () => Buffer.alloc(4),
    }));

    expect(decoder.decode(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it("rejects rather than propagating a throwing toBitmap", () => {
    const decoder = createElectronPreviewCaptureDecoder(() => ({
      isEmpty: () => false,
      getSize: () => ({ width: 2, height: 2 }),
      toBitmap: () => {
        throw new Error("bitmap unavailable");
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
      const decoder = createElectronPreviewCaptureDecoder(() => ({
        isEmpty: () => false,
        getSize: () => ({ width, height }),
        toBitmap: () => Buffer.alloc(4),
      }));
      expect(decoder.decode(new Uint8Array([1, 2, 3]))).toBeNull();
    }
  });
});
