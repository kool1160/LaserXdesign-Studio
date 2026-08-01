import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createBlankProject, identityTransform } from "@laserx/domain";
import { buildProductionPackage } from "@laserx/production-export";
import { afterEach, describe, expect, it } from "vitest";

import { ProductionStorage } from "../../electron/production-storage.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

function productionPackage() {
  const layerId = "11111111-1111-4111-8111-111111111111";
  return buildProductionPackage(
    createBlankProject({
      id: "22222222-2222-4222-8222-222222222222",
      documentId: "33333333-3333-4333-8333-333333333333",
      name: "Storage Sign",
      now: "2026-08-01T12:00:00.000Z",
      layers: [{
        id: layerId,
        name: "Face",
        visible: true,
        locked: false,
        manufacturing: {
          role: "face",
          material: "mild-steel",
          thicknessMm: 3,
          process: "laser",
          notes: "",
          registrationGroup: null,
        },
      }],
      activeLayerId: layerId,
      objects: [{
        id: "44444444-4444-4444-8444-444444444444",
        type: "rectangle",
        layerId,
        transform: identityTransform(),
        origin: { xMm: 10, yMm: 10 },
        widthMm: 50,
        heightMm: 30,
      }],
    }),
  );
}

describe("ProductionStorage", () => {
  it("commits a complete package atomically and handles explicit replacement", async () => {
    const directory = await mkdtemp(join(tmpdir(), "laserx-production-storage-"));
    directories.push(directory);
    const target = join(directory, "package");
    const storage = new ProductionStorage();
    const packageValue = productionPackage();

    const first = await storage.write(target, packageValue, "fail");
    expect(first.ok).toBe(true);
    await expect(readFile(join(target, "manifest.json"), "utf8")).resolves.toBe(
      packageValue.manifestJson,
    );

    await writeFile(join(target, "keep.txt"), "old", "utf8");
    const conflict = await storage.write(target, packageValue, "fail");
    expect(conflict).toMatchObject({ ok: false, writtenFiles: [] });
    await expect(readFile(join(target, "keep.txt"), "utf8")).resolves.toBe("old");

    const replaced = await storage.write(target, packageValue, "replace");
    expect(replaced.ok).toBe(true);
    await expect(readFile(join(target, "keep.txt"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("reports a partial staging failure without publishing a success folder", async () => {
    const directory = await mkdtemp(join(tmpdir(), "laserx-production-storage-"));
    directories.push(directory);
    const target = join(directory, "partial-package");
    const storage = new ProductionStorage();
    const packageValue = productionPackage();
    packageValue.files.push({
      name: "missing/failure.svg",
      content: "failure",
      format: "svg",
      layerId: packageValue.manifest.layers[0]?.id ?? null,
    });

    const result = await storage.write(target, packageValue, "fail");
    expect(result.ok).toBe(false);
    expect(result.failedFile).toBe("missing/failure.svg");
    expect(result.writtenFiles.length).toBeGreaterThan(0);
    await expect(readFile(join(target, "manifest.json"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
