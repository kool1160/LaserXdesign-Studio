import { randomUUID } from "node:crypto";
import { rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";

/**
 * Privileged PNG capture write (M14 G5, ADR 0024 section 6).
 *
 * The renderer never writes the filesystem: it hands validated PNG bytes
 * across the typed preload/main IPC boundary, and only this main-process
 * service touches disk. Follows `production-storage.ts`'s proven pattern --
 * validate, write to a staging file, then atomically rename -- so a failed
 * or partial write can never leave a truncated PNG where a previously good
 * capture used to be.
 */

/** 64 MB: far above any realistic preview capture, far below memory risk. */
export const MAX_CAPTURE_BYTES = 64 * 1024 * 1024;

export type CaptureConflictPolicy = "fail" | "replace";

export interface PreviewCaptureWriteResult {
  ok: boolean;
  targetPath: string;
  byteLength: number;
  error: string | null;
}

export interface PreviewCaptureFileService {
  write(
    targetPath: string,
    pngBytes: Uint8Array,
    conflictPolicy: CaptureConflictPolicy,
  ): Promise<PreviewCaptureWriteResult>;
}

/**
 * Rejects anything that is not a concrete `.png` file path.
 *
 * `resolve` collapses any `..` segments before the check, so a traversal
 * attempt cannot survive as a relative segment; what remains is validated on
 * its final basename, which is the only part this service ever creates.
 */
export function safeCapturePath(targetPath: string): string {
  const normalized = resolve(targetPath);
  const name = basename(normalized);
  if (name.trim().length === 0) {
    throw new RangeError("Choose a specific .png file to save the preview capture.");
  }
  if (extname(name).toLowerCase() !== ".png") {
    throw new RangeError("Physical preview captures must be saved as a .png file.");
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9 ._-]{0,199}\.png$/u.test(name)) {
    throw new RangeError("Capture filenames must be flat, bounded, and portable.");
  }
  return normalized;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export class PreviewCaptureStorage implements PreviewCaptureFileService {
  public async write(
    targetPath: string,
    pngBytes: Uint8Array,
    conflictPolicy: CaptureConflictPolicy,
  ): Promise<PreviewCaptureWriteResult> {
    let normalized: string;
    try {
      normalized = safeCapturePath(targetPath);
    } catch (error) {
      return {
        ok: false,
        targetPath,
        byteLength: 0,
        error: error instanceof Error ? error.message : "The capture path was rejected.",
      };
    }

    if (pngBytes.byteLength === 0) {
      return {
        ok: false,
        targetPath: normalized,
        byteLength: 0,
        error: "The capture contained no image data, so nothing was written.",
      };
    }
    if (pngBytes.byteLength > MAX_CAPTURE_BYTES) {
      return {
        ok: false,
        targetPath: normalized,
        byteLength: pngBytes.byteLength,
        error: "The capture exceeds the 64 MB safety limit, so nothing was written.",
      };
    }

    if ((await exists(normalized)) && conflictPolicy === "fail") {
      return {
        ok: false,
        targetPath: normalized,
        byteLength: pngBytes.byteLength,
        error: "That file already exists. Choose Replace existing capture to overwrite it.",
      };
    }

    // Staged in the destination directory so the final rename is a same-volume
    // atomic move; a cross-volume temp directory could silently degrade to a
    // non-atomic copy and reintroduce the partial-write failure mode.
    const staging = join(dirname(normalized), `.${basename(normalized)}.${randomUUID()}.staging`);
    try {
      await writeFile(staging, pngBytes, { flag: "wx" });
      await rename(staging, normalized);
      return {
        ok: true,
        targetPath: normalized,
        byteLength: pngBytes.byteLength,
        error: null,
      };
    } catch (error) {
      await rm(staging, { force: true }).catch(() => undefined);
      return {
        ok: false,
        targetPath: normalized,
        byteLength: pngBytes.byteLength,
        error: `The preview capture could not be saved: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
