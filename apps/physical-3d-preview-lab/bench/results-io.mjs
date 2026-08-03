import { existsSync, readFileSync, writeFileSync } from "node:fs";

/** Machine-readable Phase 3 results file, shared by the Node and browser harnesses. */
export const RESULTS_URL = new URL(
  "../../../docs/experiments/m14-physical-3d-preview/phase3-results.json",
  import.meta.url,
);

export const RESULTS_SCHEMA_VERSION = 1;

/**
 * Merges one named section into the results file, preserving any section
 * written by the other harness. Each harness runs independently (Node under
 * Vitest, browser under Playwright), so neither can assume it runs first.
 */
export function writeResultsSection(section, data) {
  let document = { schemaVersion: RESULTS_SCHEMA_VERSION };
  if (existsSync(RESULTS_URL)) {
    try {
      document = JSON.parse(readFileSync(RESULTS_URL, "utf8"));
    } catch {
      document = { schemaVersion: RESULTS_SCHEMA_VERSION };
    }
  }
  document.schemaVersion = RESULTS_SCHEMA_VERSION;
  document[section] = data;
  writeFileSync(RESULTS_URL, `${JSON.stringify(document, null, 2)}\n`, "utf8");
}
