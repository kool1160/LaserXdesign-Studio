/**
 * Trusted image decode for privileged capture saves (M14 G5).
 *
 * `validatePngStructure` proves framing, CRCs, critical-chunk shape, and
 * ordering — but not that the concatenated `IDAT` payload actually
 * decompresses into an image. A CRC-correct stream carrying garbage
 * compressed data is structurally perfect and still undecodable by ordinary
 * image software, so the privileged path must run a real decoder before it
 * prompts for a destination or writes anything.
 *
 * Deliberately *not* an ad-hoc PNG decompressor in the renderer-safe package:
 * hand-rolling inflate would add exactly the kind of parser this boundary
 * should be delegating. Production is backed by Electron's own decoder,
 * injected as a narrow port so the adapter logic stays unit-testable in Node
 * and so tests can supply their own equally strict decoder.
 */

export interface DecodedCaptureImage {
  widthPx: number;
  heightPx: number;
  /**
   * Decoded pixels in **RGBA** order, 4 bytes per pixel.
   *
   * Returned so the privileged process can independently verify the image is
   * not blank. Dimensions alone cannot distinguish a real capture from a
   * fully transparent or all-background one, and a renderer-supplied
   * "hasContent" flag would just be the untrusted side marking its own work.
   */
  rgba: Uint8Array;
}

export interface PreviewCaptureDecoderPort {
  /** Returns the decoded dimensions, or `null` if the bytes are not a
   * decodable image. Never throws: a decoder failure is a rejection. */
  decode(bytes: Uint8Array): DecodedCaptureImage | null;
}

/** The slice of Electron's `NativeImage` this adapter actually relies on. */
export interface NativeImageLike {
  isEmpty(): boolean;
  getSize(): { width: number; height: number };
  /** Raw decoded pixels. Electron documents this buffer as **BGRA** order. */
  toBitmap(): Buffer;
}

/**
 * Fail-closed default.
 *
 * If no decoder is wired in, captures are rejected rather than silently
 * skipping validation — an unwired privileged check must never degrade into
 * an accepted one.
 */
export const unavailablePreviewCaptureDecoder: PreviewCaptureDecoderPort = {
  decode: () => null,
};

export function createElectronPreviewCaptureDecoder(
  createFromBuffer: (buffer: Buffer) => NativeImageLike,
): PreviewCaptureDecoderPort {
  return {
    decode(bytes) {
      let image: NativeImageLike;
      try {
        image = createFromBuffer(Buffer.from(bytes));
      } catch {
        // Electron reports undecodable data by throwing or by returning an
        // empty image depending on the failure; both are a rejection here.
        return null;
      }
      try {
        if (image.isEmpty()) return null;
        const { width, height } = image.getSize();
        if (
          !Number.isInteger(width) ||
          !Number.isInteger(height) ||
          width <= 0 ||
          height <= 0
        ) {
          return null;
        }

        const bitmap = image.toBitmap();
        const expected = width * height * 4;
        // A bitmap that disagrees with the reported size is not evidence about
        // this image, so it is a rejection rather than something to reinterpret.
        if (bitmap.length !== expected) return null;

        // Electron hands back BGRA; every shared content check is written
        // against RGBA. Normalising here — at the one place that knows the
        // platform's order — keeps that detail out of the shared validator.
        const rgba = new Uint8Array(expected);
        for (let index = 0; index < expected; index += 4) {
          rgba[index] = bitmap[index + 2] ?? 0;
          rgba[index + 1] = bitmap[index + 1] ?? 0;
          rgba[index + 2] = bitmap[index] ?? 0;
          rgba[index + 3] = bitmap[index + 3] ?? 0;
        }

        return { widthPx: width, heightPx: height, rgba };
      } catch {
        return null;
      }
    },
  };
}
