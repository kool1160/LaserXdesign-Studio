import type { LaserxProject } from "@laserx/domain";
import { parseProject } from "@laserx/project-format";

import fixtureSource from "../../../fixtures/physical-preview/single-layer-face-plate.laserx?raw";

export const FIXTURE_LAYER_ID = "10000000-0000-4000-8000-000000000001";

/**
 * Loads the one reviewed, deterministic fixture through the existing strict
 * `@laserx/project-format` parser, never a hand-rolled/partial parse.
 */
export function loadFixtureProject(): LaserxProject {
  return parseProject(fixtureSource);
}
