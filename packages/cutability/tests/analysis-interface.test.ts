import {
  createDocument,
  identityTransform,
  type DocumentObject,
  type LaserxDocument,
  type PathObject,
} from "@laserx/domain";
import { describe, expect, it } from "vitest";

import {
  CutabilityAnalysisCache,
  analyzeDocumentCutability,
  materializeBridgeProposal,
  proposeBridge,
} from "../src/index.js";

const LAYER_ID = "10000000-0000-4000-8000-000000000001";
const OUTER_ID = "20000000-0000-4000-8000-000000000001";
const ISLAND_ID = "30000000-0000-4000-8000-000000000001";
const INNER_DROPOUT_ID = "40000000-0000-4000-8000-000000000001";

function rectangle(
  id: string,
  minXmm: number,
  minYmm: number,
  maxXmm: number,
  maxYmm: number,
  closed = true,
): PathObject {
  return {
    id,
    type: "path",
    layerId: LAYER_ID,
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
