import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  MAX_CAPTURE_BYTES,
  PreviewCaptureStorage,
  safeCapturePath,
} from "../../electron/preview-capture-storage.js";

const directories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "laserx-capture-"));
  directories.push(directory);
  return directory;
}

/** Minimal bytes that are recognisably PNG-like for write-path testing. */
function pngBytes(size = 128): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  return bytes;
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("safeCapturePath", () => {
  it("accepts a plain .png path", () => {
    expect(safeCapturePath(join("C:", "captures", "preview.png"))).toContain("preview.png");
  });

  it("rejects a non-png extension", () => {
    expect(() => safeCapturePath(join("C:", "captures", "preview.exe"))).toThrow(/must be saved as a \.png/u);
  });

  it("rejects an extensionless path", () => {
    expect(() => safeCapturePath(join("C:", "captures", "preview"))).toThrow(/must be saved as a \.png/u);
  });

  it("collapses traversal segments rather than preserving them", () => {
    const resolved = safeCapturePath(join("C:", "captures", "..", "elsewhere", "preview.png"));
    expect(resolved).not.toContain("..");
    expect(resolved).toContain("elsewhere");
  });
});

describe("PreviewCaptureStorage", () => {
  it("writes the capture and leaves no staging file behind", async () => {
    const directory = await temporaryDirectory();
    const target = join(directory, "preview.png");
    const storage = new PreviewCaptureStorage();

    const result = await storage.write(target, pngBytes(), "fail");

    expect(result).toMatchObject({ ok: true, byteLength: 128, error: null });
    expect(new Uint8Array(await readFile(target))).toEqual(pngBytes());
    expect(await readdir(directory)).toEqual(["preview.png"]);
  });

  it("refuses to overwrite an existing capture under the fail policy", async () => {
    const directory = await temporaryDirectory();
    const target = join(directory, "preview.png");
    await writeFile(target, "original", "utf8");
    const storage = new PreviewCaptureStorage();

    const result = await storage.write(target, pngBytes(), "fail");

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/already exists/u);
    // The prior file must be untouched, not truncated by a partial write.
    expect(await readFile(target, "utf8")).toBe("original");
  });

  it("replaces an existing capture atomically under the replace policy", async () => {
    const directory = await temporaryDirectory();
    const target = join(directory, "preview.png");
    await writeFile(target, "original", "utf8");
    const storage = new PreviewCaptureStorage();

    const result = await storage.write(target, pngBytes(), "replace");

    expect(result.ok).toBe(true);
    expect(new Uint8Array(await readFile(target))).toEqual(pngBytes());
    expect(await readdir(directory)).toEqual(["preview.png"]);
  });

  it("rejects an empty capture without creating a file", async () => {
    const directory = await temporaryDirectory();
    const target = join(directory, "preview.png");
    const storage = new PreviewCaptureStorage();

    const result = await storage.write(target, new Uint8Array(0), "replace");

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no image data/u);
    expect(await readdir(directory)).toEqual([]);
  });

  it("rejects a capture above the size limit without creating a file", async () => {
    const directory = await temporaryDirectory();
    const target = join(directory, "preview.png");
    const storage = new PreviewCaptureStorage();

    const result = await storage.write(target, new Uint8Array(MAX_CAPTURE_BYTES + 1), "replace");

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/64 MB safety limit/u);
    expect(await readdir(directory)).toEqual([]);
  });

  it("rejects a non-png target without creating a file", async () => {
    const directory = await temporaryDirectory();
    const storage = new PreviewCaptureStorage();

    const result = await storage.write(join(directory, "preview.exe"), pngBytes(), "replace");

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/must be saved as a \.png/u);
    expect(await readdir(directory)).toEqual([]);
  });

  it("reports an explicit failure and leaves no staging file when the directory does not exist", async () => {
    const directory = await temporaryDirectory();
    const storage = new PreviewCaptureStorage();

    const result = await storage.write(
      join(directory, "missing-subdirectory", "preview.png"),
      pngBytes(),
      "replace",
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/could not be saved/u);
    // Deliberately does not create parent directories: the path comes from a
    // save dialog the user already chose, so silently inventing folders would
    // write somewhere they never confirmed.
    expect(await readdir(directory)).toEqual([]);
  });
});
