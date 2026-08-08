import {
  createDocument,
  identityTransform,
  type DocumentObject,
  type LaserxDocument,
  type PathObject,
} from "@laserx/domain";
import {
  applyAffineTransform,
  composeAffineTransforms,
  distancePointToSegment,
  evaluatePathSegment,
  type AffineTransformMm,
  type EditablePathGeometry,
  type PointMm,
} from "@laserx/geometry";
import { describe, expect, it } from "vitest";

import {
  CUTABILITY_FLATTENING_TOLERANCE_MM,
  CutabilityAnalysisCache,
  analyzeDocumentCutability,
  materializeBridgeProposal,
  normalizeCutPaths,
  proposeBridge,
} from "../src/index.js";

const LAYER_ID = "10000000-0000-4000-8000-000000000001";
const SECOND_LAYER_ID = "10000000-0000-4000-8000-000000000002";
const OUTER_ID = "20000000-0000-4000-8000-000000000001";
const ISLAND_ID = "30000000-0000-4000-8000-000000000001";
const INNER_DROPOUT_ID = "40000000-0000-4000-8000-000000000001";
const GROUP_ID = "60000000-0000-4000-8000-000000000001";
const CURVE: EditablePathGeometry = {
  closed: false,
  points: [
    { xMm: 0, yMm: 0 },
    { xMm: 100, yMm: 0 },
  ],
  handles: [
    { incoming: null, outgoing: { xMm: 0, yMm: 80 } },
    { incoming: { xMm: 100, yMm: 80 }, outgoing: null },
  ],
};

function distanceToPolyline(
  point: PointMm,
  points: readonly PointMm[],
  closed: boolean,
): number {
  const segmentCount = closed ? points.length : points.length - 1;
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 0; index < segmentCount; index += 1) {
    minimum = Math.min(
      minimum,
      distancePointToSegment(
        point,
        points[index] as PointMm,
        points[(index + 1) % points.length] as PointMm,
      ),
    );
  }
  return minimum;
}

function expectCubicWorldTolerance(
  transform: AffineTransformMm,
  flattened: readonly PointMm[],
): void {
  const samples = Array.from({ length: 2_001 }, (_unused, index) =>
    applyAffineTransform(evaluatePathSegment(CURVE, 0, index / 2_000), transform),
  );
  const maximumDeviation = Math.max(
    ...samples.map((point) => distanceToPolyline(point, flattened, false)),
  );
  expect(maximumDeviation).toBeLessThanOrEqual(
    CUTABILITY_FLATTENING_TOLERANCE_MM + 1e-9,
  );
}

function expectEllipseWorldTolerance(
  transform: AffineTransformMm,
  flattened: readonly PointMm[],
): void {
  const center = { xMm: 50, yMm: 30 };
  const radiusXmm = 30;
  const radiusYmm = 12;
  let maximumDeviation = 0;
  for (let segmentIndex = 0; segmentIndex < flattened.length; segmentIndex += 1) {
    const start = flattened[segmentIndex] as PointMm;
    const end = flattened[(segmentIndex + 1) % flattened.length] as PointMm;
    for (let sampleIndex = 0; sampleIndex <= 8; sampleIndex += 1) {
      const ratio = sampleIndex / 8;
      const angle = ((segmentIndex + ratio) / flattened.length) * Math.PI * 2;
      const point = applyAffineTransform({
        xMm: center.xMm + Math.cos(angle) * radiusXmm,
        yMm: center.yMm + Math.sin(angle) * radiusYmm,
      }, transform);
      maximumDeviation = Math.max(
        maximumDeviation,
        distancePointToSegment(point, start, end),
      );
    }
  }
  expect(maximumDeviation).toBeLessThanOrEqual(
    CUTABILITY_FLATTENING_TOLERANCE_MM + 1e-9,
  );
}

function rectangle(
  id: string,
  minXmm: number,
  minYmm: number,
  maxXmm: number,
  maxYmm: number,
  closed = true,
  layerId = LAYER_ID,
): PathObject {
  return {
    id,
    type: "path",
    layerId,
    transform: identityTransform(),
    closed,
    points: [
      { xMm: minXmm, yMm: minYmm },
      { xMm: maxXmm, yMm: minYmm },
      { xMm: maxXmm, yMm: maxYmm },
      { xMm: minXmm, yMm: maxYmm },
    ],
  };
}

function layeredDocumentWith(objects: DocumentObject[]): LaserxDocument {
  return createDocument({
    id: "50000000-0000-4000-8000-000000000002",
    width: 300,
    height: 180,
    inputUnit: "millimeters",
    layers: [
      { id: LAYER_ID, name: "Artwork", visible: true, locked: false },
      { id: SECOND_LAYER_ID, name: "Backing", visible: true, locked: false },
    ],
    activeLayerId: LAYER_ID,
    objects,
  });
}

function documentWith(objects: DocumentObject[]): LaserxDocument {
  return createDocument({
    id: "50000000-0000-4000-8000-000000000001",
    width: 200,
    height: 150,
    inputUnit: "millimeters",
    layers: [{ id: LAYER_ID, name: "Artwork", visible: true, locked: false }],
    activeLayerId: LAYER_ID,
    objects,
  });
}

describe("cutability analysis", () => {
  it("distinguishes an explicit empty object scope from the legacy whole-design empty selection", () => {
    const document = documentWith([
      rectangle(OUTER_ID, 10, 10, 110, 110),
      rectangle(ISLAND_ID, 30, 30, 90, 90),
    ]);

    expect(analyzeDocumentCutability(document, []).analyzedObjectIds).toEqual([
      ISLAND_ID,
      OUTER_ID,
    ].sort());

    const emptyScope = analyzeDocumentCutability(document, {
      objectIds: [],
      objectIdsMode: "exact",
    });
    expect(emptyScope).toMatchObject({
      status: "complete",
      analyzedObjectIds: [],
      pathCount: 0,
      segmentCount: 0,
      issueCount: 0,
      issues: [],
      regions: [],
    });
  });

  it("classifies nested retained and removed regions from geometry", () => {
    const analysis = analyzeDocumentCutability(
      documentWith([
        rectangle(OUTER_ID, 10, 10, 110, 110),
        rectangle(ISLAND_ID, 30, 30, 90, 90),
        rectangle(INNER_DROPOUT_ID, 45, 45, 75, 75),
      ]),
    );

    expect(analysis.status).toBe("complete");
    expect(analysis.regions.map((region) => ({
      objectId: region.objectId,
      depth: region.depth,
      disposition: region.disposition,
    }))).toEqual([
      { objectId: OUTER_ID, depth: 0, disposition: "removed" },
      { objectId: ISLAND_ID, depth: 1, disposition: "retained" },
      { objectId: INNER_DROPOUT_ID, depth: 2, disposition: "removed" },
    ]);
    expect(analysis.issues.map((issue) => issue.code)).toContain("DISCONNECTED_ISLAND");
    expect(analysis.issues.map((issue) => issue.code)).toContain("ENCLOSED_DROPOUT");
    expect(analysis.issues.every(
      (issue) =>
        Number.isFinite(issue.measuredValueMm) &&
        Number.isFinite(issue.configuredLimitMm),
    )).toBe(true);
    expect(analysis.cutReady).toBe(false);
  });

  it("marks every region ambiguous when any analyzed contour is open", () => {
    const open = rectangle(ISLAND_ID, 30, 30, 90, 90, false);
    const analysis = analyzeDocumentCutability(
      documentWith([rectangle(OUTER_ID, 10, 10, 110, 110), open]),
    );

    expect(analysis.status).toBe("ambiguous");
    expect(analysis.issues.some((issue) => issue.code === "OPEN_CONTOUR")).toBe(true);
    expect(analysis.regions.every((region) => region.disposition === "ambiguous")).toBe(true);
  });

  it("marks intersecting separate contours ambiguous", () => {
    const analysis = analyzeDocumentCutability(
      documentWith([
        rectangle(OUTER_ID, 10, 10, 80, 80),
        rectangle(ISLAND_ID, 60, 60, 110, 110),
      ]),
    );

    expect(analysis.status).toBe("ambiguous");
    expect(analysis.regions.every((region) => region.disposition === "ambiguous")).toBe(true);
    expect(analysis.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "UNSUPPORTED_GEOMETRY" }),
    ]));
  });

  it("preserves standard cross-layer conflicts, spacing, and containment", () => {
    const duplicateAnalysis = analyzeDocumentCutability(layeredDocumentWith([
      rectangle(OUTER_ID, 10, 10, 60, 60),
      rectangle(ISLAND_ID, 10, 10, 60, 60, true, SECOND_LAYER_ID),
    ]));
    expect(duplicateAnalysis.status).toBe("ambiguous");
    expect(duplicateAnalysis.issues.some(
      (issue) => issue.code === "DUPLICATE_SEGMENT" && issue.objectIds.includes(OUTER_ID) && issue.objectIds.includes(ISLAND_ID),
    )).toBe(true);

    const overlapAnalysis = analyzeDocumentCutability(layeredDocumentWith([
      rectangle(OUTER_ID, 10, 10, 80, 50),
      rectangle(ISLAND_ID, 40, 10, 100, 30, true, SECOND_LAYER_ID),
    ]));
    expect(overlapAnalysis.status).toBe("ambiguous");
    expect(overlapAnalysis.issues.some(
      (issue) => issue.code === "OVERLAPPING_SEGMENT" && issue.objectIds.includes(OUTER_ID) && issue.objectIds.includes(ISLAND_ID),
    )).toBe(true);

    const intersectionAnalysis = analyzeDocumentCutability(layeredDocumentWith([
      rectangle(OUTER_ID, 10, 10, 60, 60),
      rectangle(ISLAND_ID, 40, 40, 90, 90, true, SECOND_LAYER_ID),
    ]));
    expect(intersectionAnalysis.status).toBe("ambiguous");
    expect(intersectionAnalysis.issues.some(
      (issue) => issue.code === "UNSUPPORTED_GEOMETRY" && issue.objectIds.includes(OUTER_ID) && issue.objectIds.includes(ISLAND_ID),
    )).toBe(true);

    const gapAnalysis = analyzeDocumentCutability(layeredDocumentWith([
      rectangle(OUTER_ID, 10, 10, 40, 40),
      rectangle(ISLAND_ID, 40.5, 10, 70.5, 40, true, SECOND_LAYER_ID),
    ]));
    expect(gapAnalysis.issues.some(
      (issue) => issue.code === "GAP_TOO_SMALL" && issue.objectIds.includes(OUTER_ID) && issue.objectIds.includes(ISLAND_ID),
    )).toBe(true);
    expect(gapAnalysis.issues.some(
      (issue) => issue.code === "CONTOURS_TOO_CLOSE" && issue.objectIds.includes(OUTER_ID) && issue.objectIds.includes(ISLAND_ID),
    )).toBe(true);

    const nestedAnalysis = analyzeDocumentCutability(layeredDocumentWith([
      rectangle(OUTER_ID, 110, 10, 210, 110),
      rectangle(ISLAND_ID, 135, 35, 185, 85, true, SECOND_LAYER_ID),
    ]));
    expect(nestedAnalysis.status).toBe("complete");
    expect(nestedAnalysis.regions.find((region) => region.objectId === ISLAND_ID)).toMatchObject({
      parentRegionId: `${OUTER_ID}:0`,
      depth: 1,
      disposition: "retained",
    });
    expect(nestedAnalysis.issues.some(
      (issue) => issue.code === "DISCONNECTED_ISLAND" && issue.objectId === ISLAND_ID,
    )).toBe(true);
  });

  it("does not treat adjacent ellipse flattening segments as a narrow feature", () => {
    const analysis = analyzeDocumentCutability(documentWith([{
      id: OUTER_ID,
      type: "ellipse",
      layerId: LAYER_ID,
      transform: identityTransform(),
      center: { xMm: 70, yMm: 70 },
      radiusXmm: 30,
      radiusYmm: 20,
    }]));
    const codes = analysis.issues.map((issue) => issue.code);

    expect(codes).not.toContain("FEATURE_TOO_NARROW");
    expect(codes).not.toContain("KERF_COLLAPSE_RISK");
  });

  it.each([
    {
      name: "large uniform scale",
      child: { a: 25, b: 0, c: 0, d: 25, eMm: 10, fMm: -20 },
    },
    {
      name: "nonuniform scale",
      child: { a: 40, b: 0, c: 0, d: 3, eMm: -15, fMm: 25 },
    },
    {
      name: "shear",
      child: { a: 1, b: 0.5, c: 18, d: 1, eMm: 5, fMm: 7 },
    },
    {
      name: "nested group transforms",
      parent: { a: 3, b: 1, c: 0.5, d: 2, eMm: 11, fMm: -9 },
      child: { a: 4, b: 0, c: 1, d: 5, eMm: 2, fMm: 6 },
    },
  ] as Array<{
    name: string;
    child: AffineTransformMm;
    parent?: AffineTransformMm;
  }>)("keeps cubic and ellipse analysis deviation in world millimeters under $name", ({ child, parent }) => {
    const path: DocumentObject = {
      id: OUTER_ID,
      type: "path",
      layerId: LAYER_ID,
      transform: child,
      ...CURVE,
    };
    const ellipse: DocumentObject = {
      id: ISLAND_ID,
      type: "ellipse",
      layerId: LAYER_ID,
      transform: child,
      center: { xMm: 50, yMm: 30 },
      radiusXmm: 30,
      radiusYmm: 12,
    };
    const objects: DocumentObject[] = parent === undefined
      ? [path, ellipse]
      : [{
          id: GROUP_ID,
          type: "group",
          layerId: LAYER_ID,
          transform: parent,
          children: [path, ellipse],
        }];
    const normalized = normalizeCutPaths(documentWith(objects));
    const worldTransform = parent === undefined
      ? child
      : composeAffineTransforms(parent, child);

    expectCubicWorldTolerance(
      worldTransform,
      normalized.find((candidate) => candidate.objectId === OUTER_ID)?.points ?? [],
    );
    expectEllipseWorldTolerance(
      worldTransform,
      normalized.find((candidate) => candidate.objectId === ISLAND_ID)?.points ?? [],
    );
  });

  it("detects an intersection hidden by local-space ellipse flattening", () => {
    const scale = 25;
    const radiusMm = 30 * scale;
    const oldLocalSegmentCount = 122;
    const angle = Math.PI / oldLocalSegmentCount;
    const radialPoint = (radius: number): PointMm => ({
      xMm: Math.cos(angle) * radius,
      yMm: Math.sin(angle) * radius,
    });
    const lineId = "70000000-0000-4000-8000-000000000001";
    const analysis = analyzeDocumentCutability(documentWith([
      {
        id: OUTER_ID,
        type: "ellipse",
        layerId: LAYER_ID,
        transform: { a: scale, b: 0, c: 0, d: scale, eMm: 0, fMm: 0 },
        center: { xMm: 0, yMm: 0 },
        radiusXmm: 30,
        radiusYmm: 30,
      },
      {
        id: lineId,
        type: "line",
        layerId: LAYER_ID,
        transform: identityTransform(),
        start: radialPoint(radiusMm - 0.05),
        end: radialPoint(radiusMm + 0.05),
      },
    ]));

    expect(analysis.issues.some(
      (issue) =>
        issue.code === "UNSUPPORTED_GEOMETRY" &&
        issue.objectIds.includes(OUTER_ID) &&
        issue.objectIds.includes(lineId),
    )).toBe(true);
  });

  it("detects duplicates, overlaps, self intersections, narrow features, gaps, and kerf risk", () => {
    const duplicate = rectangle(
      "60000000-0000-4000-8000-000000000001",
      10,
      10,
      110,
      110,
    );
    const overlap: PathObject = {
      ...rectangle("70000000-0000-4000-8000-000000000001", 20, 10, 80, 20),
      points: [
        { xMm: 20, yMm: 10 },
        { xMm: 80, yMm: 10 },
        { xMm: 80, yMm: 20 },
        { xMm: 20, yMm: 20 },
      ],
    };
    const bowtie: PathObject = {
      ...rectangle("80000000-0000-4000-8000-000000000001", 120, 10, 150, 40),
      points: [
        { xMm: 120, yMm: 10 },
        { xMm: 150, yMm: 40 },
        { xMm: 120, yMm: 40 },
        { xMm: 150, yMm: 10 },
      ],
    };
    const narrow = rectangle(
      "90000000-0000-4000-8000-000000000001",
      160,
      10,
      160.1,
      40,
    );
    const nearby = rectangle(
      "a0000000-0000-4000-8000-000000000001",
      160.4,
      10,
      170,
      40,
    );
    const analysis = analyzeDocumentCutability(
      documentWith([
        rectangle(OUTER_ID, 10, 10, 110, 110),
        duplicate,
        overlap,
        bowtie,
        narrow,
        nearby,
      ]),
    );
    const codes = new Set(analysis.issues.map((issue) => issue.code));
    expect(codes).toEqual(expect.objectContaining(new Set([
      "DUPLICATE_SEGMENT",
      "OVERLAPPING_SEGMENT",
      "SELF_INTERSECTION",
      "FEATURE_TOO_NARROW",
      "GAP_TOO_SMALL",
      "CONTOURS_TOO_CLOSE",
      "KERF_COLLAPSE_RISK",
      "UNSUPPORTED_GEOMETRY",
    ])));
  });
});

describe("bridge proposals", () => {
  it("previews a minimum-width bridge without mutation and materializes editable replacements", () => {
    const document = documentWith([
      rectangle(OUTER_ID, 10, 10, 110, 110),
      rectangle(ISLAND_ID, 35, 35, 85, 85),
    ]);
    const before = JSON.stringify(document);
    const analysis = analyzeDocumentCutability(document);
    const islandIssue = analysis.issues.find(
      (issue) => issue.code === "DISCONNECTED_ISLAND",
    );
    if (islandIssue === undefined) throw new Error("Expected a disconnected island.");

    const manual = proposeBridge(document, analysis, {
      issueId: islandIssue.id,
      widthMm: document.settings.manufacturing.minimumBridgeWidthMm,
      mode: "manual",
      direction: "right",
    });
    const automatic = proposeBridge(document, analysis, {
      issueId: islandIssue.id,
      widthMm: document.settings.manufacturing.minimumBridgeWidthMm,
      mode: "automatic",
    });

    expect(JSON.stringify(document)).toBe(before);
    expect(manual.direction).toBe("right");
    expect(manual.widthMm).toBeGreaterThanOrEqual(
      document.settings.manufacturing.minimumBridgeWidthMm,
    );
    expect(manual.replacementContours.length).toBeGreaterThan(0);
    expect(automatic.lengthMm).toBeLessThanOrEqual(manual.lengthMm);
    let sequence = 0;
    const replacements = materializeBridgeProposal(manual, () => {
      sequence += 1;
      return `b0000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
    });
    expect(replacements[0]?.id).toBe(OUTER_ID);
    expect(replacements.every((path) => path.closed)).toBe(true);
  });

  it("rejects a manual bridge that crosses an unrelated contour", () => {
    const obstacleId = "c0000000-0000-4000-8000-000000000001";
    const document = documentWith([
      rectangle(OUTER_ID, 10, 10, 110, 110),
      rectangle(ISLAND_ID, 35, 35, 85, 85),
      rectangle(obstacleId, 95, 20, 96, 100),
    ]);
    const analysis = analyzeDocumentCutability(document);
    const islandIssue = analysis.issues.find(
      (issue) =>
        issue.code === "DISCONNECTED_ISLAND" && issue.objectId === ISLAND_ID,
    );
    if (islandIssue === undefined) throw new Error("Expected the target island issue.");

    expect(() => proposeBridge(document, analysis, {
      issueId: islandIssue.id,
      widthMm: document.settings.manufacturing.minimumBridgeWidthMm,
      mode: "manual",
      direction: "right",
    })).toThrow("No collision-free bridge placement");
    expect(proposeBridge(document, analysis, {
      issueId: islandIssue.id,
      widthMm: document.settings.manufacturing.minimumBridgeWidthMm,
      mode: "automatic",
    }).direction).not.toBe("right");
  });

  it("caches only the exact document and invalidates after edits", () => {
    const document = documentWith([rectangle(OUTER_ID, 10, 10, 110, 110)]);
    const analysis = analyzeDocumentCutability(document);
    const cache = new CutabilityAnalysisCache();
    cache.set(document, [], analysis);
    expect(cache.get(document, [])).toEqual(analysis);
    document.settings.viewport.gridVisible = false;
    expect(cache.get(document, [])).toEqual(analysis);
    document.objects[0] = rectangle(OUTER_ID, 10, 10, 120, 110);
    expect(cache.get(document, [])).toBeNull();
    cache.invalidate();
    expect(cache.size).toBe(0);
  });
});
