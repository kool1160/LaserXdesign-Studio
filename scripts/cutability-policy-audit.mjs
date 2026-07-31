import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const cutabilityPackage = JSON.parse(
  await readFile(resolve(root, "packages/cutability/package.json"), "utf8"),
);
const dependencyNames = Object.keys(cutabilityPackage.dependencies ?? {}).sort();
if (
  JSON.stringify(dependencyNames) !==
  JSON.stringify(["@laserx/domain", "@laserx/geometry"])
) {
  throw new Error(
    "The cutability engine must have only reviewed LaserX workspace runtime dependencies.",
  );
}

const requiredCodes = [
  "BRIDGE_TOO_NARROW",
  "CONTOURS_TOO_CLOSE",
  "DISCONNECTED_ISLAND",
  "DUPLICATE_SEGMENT",
  "ENCLOSED_DROPOUT",
  "FEATURE_TOO_NARROW",
  "GAP_TOO_SMALL",
  "KERF_COLLAPSE_RISK",
  "OPEN_CONTOUR",
  "OVERLAPPING_SEGMENT",
  "SELF_INTERSECTION",
  "UNSUPPORTED_GEOMETRY",
];
const rules = await readFile(
  resolve(root, "packages/cutability/src/analysis.ts"),
  "utf8",
);
for (const code of requiredCodes) {
  if (!rules.includes(`"${code}"`)) {
    throw new Error(`Required cutability issue code is missing: ${code}.`);
  }
}
if (
  !rules.includes("MAX_CUTABILITY_SEGMENTS = 50_000") ||
  !rules.includes("CUTABILITY_FLATTENING_TOLERANCE_MM = 0.01") ||
  !rules.includes("cutReady: false")
) {
  throw new Error("The reviewed cutability limits or no-cut-ready policy changed.");
}

const adr = await readFile(
  resolve(root, "docs/decisions/0020-deterministic-cutability-and-bridge-proposals.md"),
  "utf8",
);
if (
  !/## Status\r?\n\r?\nAccepted\./u.test(adr) ||
  !/not authoritative\s+machine tables/u.test(adr) ||
  !/cannot\s+mutate the project/u.test(adr)
) {
  throw new Error("The M08 decision, transparency, or non-mutation record is incomplete.");
}

const fixture = JSON.parse(
  await readFile(
    resolve(root, "fixtures/cutability/m08-rule-goldens.json"),
    "utf8",
  ),
);
if (
  fixture.schemaVersion !== 1 ||
  !Array.isArray(fixture.cases) ||
  fixture.cases.length < 4 ||
  !fixture.cases.some((candidate) => candidate.name === "safe-single-cutout")
) {
  throw new Error("The reviewed M08 rule/false-positive fixture set is incomplete.");
}

console.log(
  "Cutability policy audit passed for workspace-only runtime dependencies, all twelve issue codes, reviewed limits, ADR 0020, and four golden cases.",
);
