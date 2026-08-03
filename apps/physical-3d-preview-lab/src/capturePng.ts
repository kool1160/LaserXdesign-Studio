/**
 * Only the canvas surface actually read from — kept minimal so the
 * validation logic below is unit-testable in Node against a plain mock
 * object, without a real `HTMLCanvasElement`/DOM.
 */
export interface CapturableCanvas {
  width: number;
  height: number;
  toDataURL: (type?: string) => string;
}

export interface CapturePngResult {
  ok: boolean;
  filename: string;
  dataUrl?: string;
  byteLength?: number;
  errorMessage?: string;
}

/**
 * Readback tradeoff, documented here rather than left implicit: WebGL
 * canvases normally clear their drawing buffer after presenting a frame,
 * so `toDataURL()` called from outside the render loop can read back a
 * blank buffer. The `<Canvas>` element is configured with
 * `gl={{ preserveDrawingBuffer: true }}` specifically so capture reads the
 * actual last-rendered frame — at the cost of the renderer retaining that
 * buffer every frame instead of discarding it, a small, accepted memory/
 * bandwidth cost for a capture-capable research lab, not a shipped product
 * default.
 */
const MINIMUM_PNG_BYTES = 64;

export function capturePreviewPng(
  canvas: CapturableCanvas,
  filename: string,
): CapturePngResult {
  if (canvas.width === 0 || canvas.height === 0) {
    return {
      ok: false,
      filename,
      errorMessage: "The preview canvas has no rendered pixels to capture.",
    };
  }

  let dataUrl: string;
  try {
    dataUrl = canvas.toDataURL("image/png");
  } catch (error) {
    return {
      ok: false,
      filename,
      errorMessage: error instanceof Error ? error.message : "PNG capture failed.",
    };
  }

  const base64 = dataUrl.split(",")[1];
  if (dataUrl === "data:," || base64 === undefined || base64.length === 0) {
    return { ok: false, filename, errorMessage: "PNG capture produced no image data." };
  }

  const byteLength = Math.floor((base64.length * 3) / 4);
  if (byteLength < MINIMUM_PNG_BYTES) {
    return {
      ok: false,
      filename,
      errorMessage: "PNG capture produced an unexpectedly small image.",
    };
  }

  return { ok: true, filename, dataUrl, byteLength };
}

const OBJECT_URL_REVOKE_DELAY_MS = 5000;

function dataUrlToBlob(dataUrl: string): Blob | null {
  const [header, base64] = dataUrl.split(",");
  if (header === undefined || base64 === undefined) return null;
  const mimeMatch = /:(?<mime>[^;]+);/u.exec(header);
  const mime = mimeMatch?.groups?.["mime"] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * Triggers a browser download of a successful capture via a temporary
 * anchor element and a `Blob`/object URL (more reliably recognized as a
 * download by browsers than a large inline `data:` URI). The anchor is
 * removed immediately after the synchronous click; the object URL cannot
 * be revoked that quickly without risking canceling the download handoff,
 * so it is revoked on a short timer instead — still bounded, not leaked
 * indefinitely.
 */
export function downloadCapturedPng(document: Document, result: CapturePngResult): void {
  if (!result.ok || result.dataUrl === undefined) return;
  const blob = dataUrlToBlob(result.dataUrl);
  if (blob === null) return;
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = result.filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  // Removing the anchor synchronously, immediately after click(), can race
  // the browser's own download handoff in some engines — defer it instead.
  setTimeout(() => {
    link.remove();
  }, 0);
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, OBJECT_URL_REVOKE_DELAY_MS);
}
