import type { LaserxProject } from "@laserx/domain";
import { parseProject } from "@laserx/project-format";

import partialAssemblySource from "../../../fixtures/physical-preview/partial-assembly-empty-layer.laserx?raw";
import twoLayerSource from "../../../fixtures/physical-preview/two-layer-face-backing.laserx?raw";

/**
 * Loads a reviewed, deterministic fixture through the existing strict
 * `@laserx/project-format` parser, never a hand-rolled/partial parse. The
 * `?fixture=partial-assembly` query parameter is a test-only hook so
 * Playwright can exercise the partial-assembly (empty physical layer)
 * warning/readout path without adding a visible fixture-picker feature.
 */
export function loadFixtureProject(): LaserxProject {
  const requestedFixture = new URLSearchParams(window.location.search).get("fixture");
  const source = requestedFixture === "partial-assembly" ? partialAssemblySource : twoLayerSource;
  return parseProject(source);
}
