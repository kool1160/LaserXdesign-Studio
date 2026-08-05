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
        return { widthPx: width, heightPx: height };
      } catch {
        return null;
      }
    },
  };
}
