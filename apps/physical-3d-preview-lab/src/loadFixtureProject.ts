import type { LaserxProject } from "@laserx/domain";
import { parseProject } from "@laserx/project-format";

import { fixtureByKey, FIXTURE_REGISTRY } from "./fixtureRegistry";

/**
 * Every reviewed fixture is bundled via a glob rather than individual
 * static imports, so adding a fixture to `FIXTURE_REGISTRY` cannot leave
 * the loader silently out of sync with it.
 */
const FIXTURE_SOURCES: Record<string, string> = import.meta.glob(
  "../../../fixtures/physical-preview/*.laserx",
  { query: "?raw", import: "default", eager: true },
);

const DEFAULT_FIXTURE_KEY = "two-layer";

function sourceForFile(file: string): string {
  const entry = Object.entries(FIXTURE_SOURCES).find(([path]) => path.endsWith(`/${file}`));
  if (entry === undefined) {
    throw new Error(`Fixture file ${file} was not bundled.`);
  }
  return entry[1];
}

export function fixtureKeyFromLocation(search: string): string {
  const requested = new URLSearchParams(search).get("fixture");
  return requested !== null && fixtureByKey(requested) !== undefined
    ? requested
    : DEFAULT_FIXTURE_KEY;
}

/**
 * Loads a reviewed, deterministic fixture through the existing strict
 * `@laserx/project-format` parser, never a hand-rolled/partial parse. The
 * `?fixture=<key>` query parameter is a research/test hook for selecting
 * among the reviewed fixtures; an unknown key falls back to the default
 * rather than throwing.
 */
export function loadFixtureProject(key: string = DEFAULT_FIXTURE_KEY): LaserxProject {
  const descriptor = fixtureByKey(key) ?? fixtureByKey(DEFAULT_FIXTURE_KEY);
  if (descriptor === undefined) {
    throw new Error("The default fixture is missing from the registry.");
  }
  return parseProject(sourceForFile(descriptor.file));
}

export { FIXTURE_REGISTRY };
