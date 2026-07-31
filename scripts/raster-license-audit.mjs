import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const rasterPackage = JSON.parse(
  await readFile(resolve(root, "packages/import-raster/package.json"), "utf8"),
);
const dependencyNames = Object.keys(rasterPackage.dependencies ?? {}).sort();
if (JSON.stringify(dependencyNames) !== JSON.stringify(["@laserx/domain", "@laserx/geometry"])) {
  throw new Error("The raster trace adapter must have only reviewed LaserX workspace dependencies.");
}

const limits = await readFile(
  resolve(root, "packages/import-raster/src/limits.ts"),
  "utf8",
);
if (
  !limits.includes('GRID_TRACE_ENGINE_ID = "laserx-grid-trace"') ||
  !limits.includes('GRID_TRACE_ENGINE_VERSION = "1.0.0"')
) {
  throw new Error("The reviewed raster trace engine ID/version changed.");
}

const adr = await readFile(
  resolve(root, "docs/decisions/0019-secure-replaceable-raster-tracing.md"),
  "utf8",
);
const licenseReview = await readFile(
  resolve(root, "packages/import-raster/licenses/README.md"),
  "utf8",
);
if (
  !adr.includes("## Status\n\nAccepted.") ||
  !adr.includes("No third-party trace implementation") ||
  !licenseReview.includes("original LaserX source")
) {
  throw new Error("The raster engine ADR or license review is incomplete.");
}

console.log("Raster license audit passed for laserx-grid-trace 1.0.0 (original LaserX source; no third-party runtime).");
