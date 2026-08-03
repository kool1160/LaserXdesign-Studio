import type { LaserxProject } from "@laserx/domain";
import { parseProject } from "@laserx/project-format";

import fixtureSource from "../../../fixtures/physical-preview/two-layer-face-backing.laserx?raw";

/**
 * Loads the one reviewed, deterministic fixture through the existing strict
 * `@laserx/project-format` parser, never a hand-rolled/partial parse.
 */
export function loadFixtureProject(): LaserxProject {
  return parseProject(fixtureSource);
}
