/**
 * G1 measurement fixtures.
 *
 * The accepted Issue #34 research measured only rectangle- and circle-based
 * signs. Its most consequential finding was that cost scales with *flattened
 * contour points*, not object count, which leaves outlined text — the thing
 * LaserX actually produces — unmeasured.
 *
 * These fixtures are built from real font outlines through the production
 * `@laserx/fonts` engine, so glyph counters ("O", "A", "R", "8") become genuine
 * interior holes rather than synthetic circles. Nothing here is invented
 * geometry: the contours are whatever the shipped font engine emits.
 */

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

import {
  createBlankProject,
  identityTransform,
  type DocumentObject,
  type LaserxProject,
  type Layer,
  type ManufacturingLayerMetadata,
  type PathObject,
} from "@laserx/domain";
import { createFontSource, FontEngine, type OutlineContour } from "@laserx/fonts";

const require = createRequire(import.meta.url);

/** Fixed timestamp so every generated fixture is byte-stable. */
const NOW = "2026-08-04T00:00:00.000Z";

/**
 * Deterministic UUID-shaped identifiers. `prefix` must be exactly two hex
 * characters: the first group needs eight hex digits, so a short prefix or a
 * short pad silently produces an ID the strict schema rejects.
 */
const id = (prefix: string, index: number): string => {
  const hex = index.toString(16);
  return `${prefix}${hex.padStart(6, "0")}-0000-4000-8000-${hex.padStart(12, "0")}`;
};

async function textEngine(): Promise<FontEngine> {
  // Read the bundled font bytes directly: `bundledFontSources` imports woff2
  // through the bundler, which is not available in a plain Node harness.
  const path = require.resolve(
    "@fontsource-variable/noto-sans/files/noto-sans-latin-wght-normal.woff2",
  );
  const bytes = await readFile(path);
  return new FontEngine([
    createFontSource(
      {
        id: "noto-sans",
        family: "Noto Sans",
        style: "Variable",
        source: "bundled",
        categories: ["industrial"],
        license: {
          spdx: "OFL-1.1",
          copyright: "Copyright The Noto Project Authors",
          licenseFile: null,
          provenance: "@fontsource-variable/noto-sans",
        },
      },
      bytes,
    ),
  ]);
}

function outlineToPaths(
  contours: readonly OutlineContour[],
  layerId: string,
  prefix: string,
  offsetYMm: number,
  startIndex: number,
): PathObject[] {
  return contours.map((contour, index) => ({
    id: id(prefix, startIndex + index),
    type: "path",
    layerId,
    transform: identityTransform(),
    closed: contour.closed,
    points: contour.points.map((point) => ({
      xMm: point.xMm,
      yMm: point.yMm + offsetYMm,
    })),
  }));
}

function physicalLayer(
  layerId: string,
  name: string,
  thicknessMm: number,
): Layer & { manufacturing: ManufacturingLayerMetadata } {
  return {
    id: layerId,
    name,
    visible: true,
    locked: false,
    manufacturing: {
      role: "face",
      material: "acrylic",
      thicknessMm,
      stockThicknessDesignation: {
        kind: "millimeter",
        label: `${String(thicknessMm)} mm`,
        material: null,
      },
      process: "laser",
      notes: "",
      registrationGroup: null,
      registrationHoleIds: [],
    },
  };
}

export interface BenchFixture {
  key: string;
  description: string;
  project: LaserxProject;
}

/**
 * Builds one text-heavy sign. `lines` of outlined text at `sizeMm`, each line
 * contributing every glyph contour the font engine produces.
 */
async function textSign(
  key: string,
  description: string,
  lines: readonly string[],
  sizeMm: number,
  widthMm: number,
  heightMm: number,
): Promise<BenchFixture> {
  const engine = await textEngine();
  const layerId = id("aa", 1);
  const objects: DocumentObject[] = [];
  let index = 100;
  let offsetYMm = heightMm - sizeMm * 1.4;

  for (const line of lines) {
    const layout = engine.layout({
      fontId: "noto-sans",
      content: line,
      sizeMm,
      trackingMm: 0,
      wordSpacingMm: 0,
      lineSpacing: 1.2,
      alignment: "left",
      arc: null,
    });
    const paths = outlineToPaths(layout.contours, layerId, "ab", offsetYMm, index);
    objects.push(...paths);
    index += paths.length;
    offsetYMm -= sizeMm * 1.4;
  }

  const project = createBlankProject({
    id: id("a1", 1),
    now: NOW,
    documentId: id("a2", 1),
    width: widthMm,
    height: heightMm,
    layers: [physicalLayer(layerId, "Face", 6)],
    activeLayerId: layerId,
    objects,
  });

  return { key, description, project };
}

/** A dense radial burst: many long closed contours, no text, for point-count scaling. */
function highPointCountSign(
  key: string,
  description: string,
  contourCount: number,
  pointsPerContour: number,
): BenchFixture {
  const layerId = id("ba", 1);
  const objects: DocumentObject[] = [];
  for (let contour = 0; contour < contourCount; contour += 1) {
    const centreX = 40 + (contour % 8) * 55;
    const centreY = 40 + Math.floor(contour / 8) * 55;
    const points = Array.from({ length: pointsPerContour }, (_, step) => {
      const angle = (step / pointsPerContour) * Math.PI * 2;
      // A deterministic lobed radius keeps the contour long and non-trivial
      // without any randomness, so the fixture is byte-stable.
      const radius = 18 + 4 * Math.sin(angle * 7);
      return {
        xMm: centreX + radius * Math.cos(angle),
        yMm: centreY + radius * Math.sin(angle),
      };
    });
    objects.push({
      id: id("bb", 100 + contour),
      type: "path",
      layerId,
      transform: identityTransform(),
      closed: true,
      points,
    });
  }

  return {
    key,
    description,
    project: createBlankProject({
      id: id("b1", 1),
      now: NOW,
      documentId: id("b2", 1),
      width: 460,
      height: 340,
      layers: [physicalLayer(layerId, "Face", 6)],
      activeLayerId: layerId,
      objects,
    }),
  };
}

/**
 * Fixtures that must drive `analyzeDocumentCutability` into its `"ambiguous"`
 * status, one per condition that sets the flag during the topology phase.
 *
 * These exist to prove the harness fails closed. If any of them produced shapes,
 * the measured Three timings would be coming from invented solids built on
 * geometry the analysis could not resolve.
 */
export function invalidFixtures(): BenchFixture[] {
  const build = (
    key: string,
    description: string,
    objects: DocumentObject[],
  ): BenchFixture => {
    const layerId = id("ca", 1);
    return {
      key,
      description,
      project: createBlankProject({
        id: id("c1", 1),
        now: NOW,
        documentId: id("c2", 1),
        width: 200,
        height: 160,
        layers: [physicalLayer(layerId, "Face", 6)],
        activeLayerId: layerId,
        objects: objects.map((object) => ({ ...object, layerId })),
      }),
    };
  };

  const square = (index: number, x: number, y: number, size: number): PathObject => ({
    id: id("cb", index),
    type: "path",
    layerId: "",
    transform: identityTransform(),
    closed: true,
    points: [
      { xMm: x, yMm: y },
      { xMm: x + size, yMm: y },
      { xMm: x + size, yMm: y + size },
      { xMm: x, yMm: y + size },
    ],
  });

  return [
    build("invalid-duplicate-segment", "Two identical stacked squares — duplicate segments", [
      square(1, 20, 20, 60),
      square(2, 20, 20, 60),
    ]),
    build(
      "invalid-overlapping-segment",
      "Two squares sharing a collinear overlapping edge run",
      [
        square(3, 20, 20, 60),
        {
          ...square(4, 20, 40, 60),
          points: [
            { xMm: 20, yMm: 40 },
            { xMm: 80, yMm: 40 },
            { xMm: 80, yMm: 100 },
            { xMm: 20, yMm: 100 },
          ],
        },
      ],
    ),
    build("invalid-self-intersecting", "A bowtie contour that crosses itself", [
      {
        id: id("cb", 5),
        type: "path",
        layerId: "",
        transform: identityTransform(),
        closed: true,
        points: [
          { xMm: 20, yMm: 20 },
          { xMm: 80, yMm: 80 },
          { xMm: 80, yMm: 20 },
          { xMm: 20, yMm: 80 },
        ],
      },
    ]),
    build(
      "invalid-cross-intersecting",
      "Two separate contours that intersect each other",
      [square(6, 20, 20, 60), square(7, 50, 50, 60)],
    ),
  ];
}

export async function benchFixtures(): Promise<BenchFixture[]> {
  return [
    await textSign(
      "text-short",
      "One short outlined word — the smallest realistic text sign",
      ["OPEN"],
      60,
      260,
      120,
    ),
    await textSign(
      "text-sign",
      "A typical two-line outlined shop sign",
      ["RIVERSIDE", "WELDING CO"],
      44,
      420,
      200,
    ),
    await textSign(
      "text-heavy",
      "A dense multi-line outlined sign — the realistic worst case for glyph contours",
      [
        "RIVERSIDE WELDING",
        "FABRICATION & REPAIR",
        "ESTABLISHED 1988",
        "OPEN MON-SAT 8-6",
        "CALL 555-0142",
      ],
      38,
      620,
      420,
    ),
    highPointCountSign(
      "high-point-count",
      "24 lobed contours × 240 points — point-count scaling without text",
      24,
      240,
    ),
    highPointCountSign(
      "very-high-point-count",
      "48 lobed contours × 480 points — deliberately beyond any realistic sign",
      48,
      480,
    ),
  ];
}
