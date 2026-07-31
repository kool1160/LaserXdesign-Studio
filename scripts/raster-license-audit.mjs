import { createHash } from "node:crypto";
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

const fixtureHashes = {
  "clean-logo.png": "2150e6ec5346a8a18226d513cc53a2822a09baadd97987fbd89daeda41fb840d",
  "clean-logo.jpg": "654b73ad23765141d3aa8bc9cd7bedba73a8cd6cbfba0666e9d764ce41c0daae",
  "noisy-photo.png": "1e62da3ec17d5ca1df68ccdafe1c7474155fc81668a0e6bc22fe075a46ce9a5d",
  "anti-aliased-text.png": "c9b8a2644dcec3b8d205761ce71fa4d1ef95823317655c21336e6e7b9a069747",
  "high-resolution-logo.png": "2dd75719d79dd9cf86a36cf2b0cb679eff45b5bed549c6f4ab6c02dc4fdb4d44",
};
for (const [fileName, expectedHash] of Object.entries(fixtureHashes)) {
  const bytes = await readFile(resolve(root, "fixtures/images/m07", fileName));
  const actualHash = createHash("sha256").update(bytes).digest("hex");
  if (actualHash !== expectedHash) {
    throw new Error(`Reviewed raster fixture hash changed: ${fileName}.`);
  }
}
const fixtureGenerator = await readFile(
  resolve(root, "scripts/generate-m07-raster-fixtures.cjs"),
  "utf8",
);
if (
  !fixtureGenerator.includes("function noisyPhoto()") ||
  !fixtureGenerator.includes("function antiAliasedText()") ||
  !fixtureGenerator.includes("function highResolutionLogo()")
) {
  throw new Error("The reviewed raster fixture source generator is incomplete.");
}

console.log("Raster license and fixture provenance audit passed for laserx-grid-trace 1.0.0 and five original LaserX image assets.");
