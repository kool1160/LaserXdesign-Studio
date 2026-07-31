import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { MAX_RASTER_SOURCE_BYTES } from "@laserx/import-raster";
import { afterEach, describe, expect, it } from "vitest";

import {
  RasterStorage,
  validateRasterPath,
} from "../../electron/raster-storage.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("RasterStorage", () => {
  it("reads bounded binary input and accepts only PNG/JPEG extensions", async () => {
    const directory = await mkdtemp(join(tmpdir(), "laserx-raster-storage-"));
    directories.push(directory);
    const path = join(directory, "logo.png");
    await writeFile(path, new Uint8Array([137, 80, 78, 71]));
    const storage = new RasterStorage();

    await expect(storage.read(path)).resolves.toEqual(
      new Uint8Array([137, 80, 78, 71]),
    );
    expect(validateRasterPath(join(directory, "photo.JPG"))).toMatch(/photo\.JPG$/u);
    expect(() => validateRasterPath(join(directory, "art.svg"))).toThrow(/extension/u);
  });

  it("rejects empty, oversized, and missing sources before decode", async () => {
    const directory = await mkdtemp(join(tmpdir(), "laserx-raster-storage-"));
    directories.push(directory);
    const empty = join(directory, "empty.png");
    const large = join(directory, "large.jpg");
    await writeFile(empty, new Uint8Array());
    await writeFile(large, new Uint8Array(MAX_RASTER_SOURCE_BYTES + 1));
    const storage = new RasterStorage();

    await expect(storage.read(empty)).rejects.toThrow(/regular file/u);
    await expect(storage.read(large)).rejects.toThrow(/no larger/u);
    await expect(storage.read(join(directory, "missing.jpeg"))).rejects.toThrow(/found or read/u);
  });
});
