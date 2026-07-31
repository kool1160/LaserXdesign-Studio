import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  VectorStorage,
  validateVectorPath,
} from "../../electron/vector-storage.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("VectorStorage", () => {
  it("reads bounded UTF-8 SVG/DXF and atomically writes the requested extension", async () => {
    const directory = await mkdtemp(join(tmpdir(), "laserx-vector-storage-"));
    directories.push(directory);
    const sourcePath = join(directory, "source.svg");
    const exportPath = join(directory, "nested", "export.dxf");
    await writeFile(sourcePath, "<svg width=\"1mm\" height=\"1mm\"/>", "utf8");
    const storage = new VectorStorage();

    await expect(storage.read(sourcePath)).resolves.toContain("<svg");
    await storage.write(exportPath, "0\nEOF\n", "dxf");
    await expect(readFile(exportPath, "utf8")).resolves.toBe("0\nEOF\n");
  });

  it("rejects wrong extensions, binary input, and oversized files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "laserx-vector-storage-"));
    directories.push(directory);
    const binaryPath = join(directory, "binary.svg");
    const oversizedPath = join(directory, "large.dxf");
    await writeFile(binaryPath, "<svg/>\0", "utf8");
    await writeFile(oversizedPath, " ".repeat(5_000_001), "utf8");
    const storage = new VectorStorage();

    expect(() => validateVectorPath(join(directory, "bad.txt"))).toThrow(/extension/u);
    await expect(storage.read(binaryPath)).rejects.toThrow(/binary/u);
    await expect(storage.read(oversizedPath)).rejects.toThrow(/5 MB/u);
    await expect(storage.write(join(directory, "wrong.svg"), "x", "dxf")).rejects.toThrow(/\.dxf/u);
  });
});
