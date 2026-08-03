import { createHash } from "node:crypto";

/** The 8-byte PNG signature every valid PNG file must begin with. */
const PNG_SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readUint32BigEndian(bytes, offset) {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

/**
 * Structural PNG validation: confirms the file really is a PNG and reads
 * its declared pixel dimensions out of the IHDR chunk, rather than trusting
 * a byte count. Deliberately does not decode pixel data — pixel content is
 * validated in-browser against the live canvas, where the rendered result
 * is actually available.
 */
export function inspectPng(bytes) {
  const byteLength = bytes.length;
  if (byteLength < 24) {
    return { valid: false, reason: "Too short to contain a PNG header.", byteLength };
  }
  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (bytes[index] !== PNG_SIGNATURE[index]) {
      return { valid: false, reason: "Missing PNG signature.", byteLength };
    }
  }
  // Bytes 12..16 are the chunk type of the first chunk, which must be IHDR.
  const chunkType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (chunkType !== "IHDR") {
    return { valid: false, reason: `First chunk was ${chunkType}, expected IHDR.`, byteLength };
  }
  const widthPx = readUint32BigEndian(bytes, 16);
  const heightPx = readUint32BigEndian(bytes, 20);
  if (widthPx === 0 || heightPx === 0) {
    return { valid: false, reason: "IHDR declares a zero dimension.", byteLength };
  }
  return {
    valid: true,
    widthPx,
    heightPx,
    byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

/** Decodes a `data:image/png;base64,...` URL into raw bytes for inspection. */
export function pngBytesFromDataUrl(dataUrl) {
  const base64 = dataUrl.split(",")[1];
  if (base64 === undefined) throw new Error("Malformed data URL.");
  return new Uint8Array(Buffer.from(base64, "base64"));
}
