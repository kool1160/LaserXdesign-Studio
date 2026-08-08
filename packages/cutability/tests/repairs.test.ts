import {
  createDocument,
  identityTransform,
  type DocumentObject,
  type LaserxDocument,
} from "@laserx/domain";
import { describe, expect, it } from "vitest";

import {
  SAFE_REPAIR_NEAR_CLOSURE_TOLERANCE_MM,
  analyzeDocumentCutability,
  groupCutabilityFindings,
  proposeSafeRepairs,
} from "../src/index.js";

const LAYER_ID = "10000000-0000-4000-8000-000000000001";
const DUPLICATE_A_ID = "20000000-0000-4000-8000-000000000001";
const DUPLICATE_B_ID = "20000000-0000-4000-8000-000000000002";
const ZERO_ID = "20000000-0000-4000-8000-000000000003";
const COLLINEAR_ID = "20000000-0000-4000-8000-000000000004";
const NEAR_CLOSURE_ID = "20000000-0000-4000-8000-000000000005";
const AMBIGUOUS_ID = "20000000-0000-4000-8000-000000000006";

function documentWith(objects: DocumentObject[]): LaserxDocument {
  return createDocument({
    id: "30000000-0000-4000-8000-000000000001",
    width: 200,
    height: 150,
    inputUnit: "millimeters",
    layers: [{ id: LAYER_ID, name: "Artwork", visible: true, locked: false }],
    activeLayerId: LAYER_ID,
    objects,
  });
}

function square(id: string): DocumentObject {
  return {
    id,
    type: "path",
    layerId: LAYER_ID,
    transform: identityTransform(),
    closed: true,
    points: [
      { xMm: 10, yMm: 10 },
      { xMm: 40, yMm: 10 },
      { xMm: 40, yMm: 40 },
      { xMm: 10, yMm: 40 },
    ],
  };
}

describe("grouped safe repairs", () => {
  it("groups only the four approved deterministic classes and previews without mutation", () => {
    const document = documentWith([
      square(DUPLICATE_A_ID),
      square(DUPLICATE_B_ID),
      {
        id: ZERO_ID,
        type: "line",
        layerId: LAYER_ID,
        transform: identityTransform(),
        start: { xMm: 60, yMm: 10 },
        end: { xMm: 60, yMm: 10 },
      },
      {
        id: COLLINEAR_ID,
        type: "path",
        layerId: LAYER_ID,
        transform: identityTransform(),
        closed: true,
        points: [
          { xMm: 70, yMm: 10 },
          { xMm: 85, yMm: 10 },
          { xMm: 100, yMm: 10 },
          { xMm: 100, yMm: 40 },
          { xMm: 70, yMm: 40 },
        ],
      },
      {
        id: NEAR_CLOSURE_ID,
        type: "path",
        layerId: LAYER_ID,
        transform: identityTransform(),
        closed: false,
        points: [
          { xMm: 110, yMm: 10 },
          { xMm: 140, yMm: 10 },
          { xMm: 140, yMm: 40 },
          {
            xMm: 110,
            yMm: 10 + SAFE_REPAIR_NEAR_CLOSURE_TOLERANCE_MM / 2,
          },
        ],
      },
      {
        id: AMBIGUOUS_ID,
        type: "path",
        layerId: LAYER_ID,
        transform: identityTransform(),
        closed: false,
        points: [
          { xMm: 20, yMm: 70 },
          { xMm: 80, yMm: 70 },
          { xMm: 80, yMm: 100 },
        ],
      },
    ]);
    const before = JSON.stringify(document);
    const analysis = analyzeDocumentCutability(document);
    const groups = groupCutabilityFindings(document, analysis);

    expect(
      groups.safeToFix.findingIds.map(
        (id) => analysis.issues.find((issue) => issue.id === id)?.repairHint,
      ),
    ).toEqual(expect.arrayContaining([
      "exact-duplicate-geometry",
      "zero-length-entity",
      "redundant-collinear-point",
      "eligible-near-closure",
    ]));
    expect(
      groups.needsYourDecision.findingIds.some(
        (id) => analysis.issues.find((issue) => issue.id === id)?.objectId === AMBIGUOUS_ID,
      ),
    ).toBe(true);

    const proposal = proposeSafeRepairs(document, analysis);
    expect(JSON.stringify(document)).toBe(before);
    expect(proposal.deleteObjectIds).toEqual(
      expect.arrayContaining([DUPLICATE_B_ID, ZERO_ID]),
    );
    expect(proposal.replacements.map((object) => object.id)).toEqual(
      expect.arrayContaining([COLLINEAR_ID, NEAR_CLOSURE_ID]),
    );
    expect(
      proposal.replacements.find((object) => object.id === COLLINEAR_ID)?.points,
    ).toHaveLength(4);
    expect(
      proposal.replacements.find((object) => object.id === NEAR_CLOSURE_ID)?.closed,
    ).toBe(true);
    expect(proposal.skippedFindingIds).toEqual([]);
    expect(proposal.disclaimer).toContain("does not prove cut readiness");
  });

  it("keeps an ambiguous near-closure out of Safe to fix and rejects stale findings", () => {
    const document = documentWith([
      {
        id: AMBIGUOUS_ID,
        type: "path",
        layerId: LAYER_ID,
        transform: identityTransform(),
        closed: false,
        points: [
          { xMm: 10, yMm: 10 },
          { xMm: 50, yMm: 10 },
          { xMm: 50, yMm: 50 },
          {
            xMm: 10,
            yMm: 10 + SAFE_REPAIR_NEAR_CLOSURE_TOLERANCE_MM * 2,
          },
        ],
      },
    ]);
    const analysis = analyzeDocumentCutability(document);
    const groups = groupCutabilityFindings(document, analysis);
    expect(groups.safeToFix.findingCount).toBe(0);
    expect(groups.needsYourDecision.findingCount).toBeGreaterThan(0);

    document.objects = [square(DUPLICATE_A_ID)];
    expect(() => groupCutabilityFindings(document, analysis)).toThrow("stale");
  });

  it("keeps a near-closure with curved endpoint handles out of Safe to fix", () => {
    const document = documentWith([
      {
        id: NEAR_CLOSURE_ID,
        type: "path",
        layerId: LAYER_ID,
        transform: identityTransform(),
        closed: false,
        points: [
          { xMm: 10, yMm: 10 },
          { xMm: 50, yMm: 10 },
          { xMm: 50, yMm: 50 },
          {
            xMm: 10,
            yMm: 10 + SAFE_REPAIR_NEAR_CLOSURE_TOLERANCE_MM / 2,
          },
        ],
        handles: [
          { incoming: { xMm: 90, yMm: 90 }, outgoing: null },
          { incoming: null, outgoing: null },
          { incoming: null, outgoing: null },
          { incoming: null, outgoing: { xMm: -70, yMm: 90 } },
        ],
      },
    ]);
    const analysis = analyzeDocumentCutability(document);
    const groups = groupCutabilityFindings(document, analysis);

    expect(groups.safeToFix.findingCount).toBe(0);
    expect(
      analysis.issues.find(
        (issue) =>
          issue.objectId === NEAR_CLOSURE_ID && issue.code === "OPEN_CONTOUR",
      )?.repairHint,
    ).toBeNull();
    expect(() => proposeSafeRepairs(document, analysis)).toThrow(
      "no mechanically proven safe problems",
    );
  });

  it("applies only cleanup nodes that have their own safe finding", () => {
    const document = documentWith([
      {
        id: COLLINEAR_ID,
        type: "path",
        layerId: LAYER_ID,
        transform: identityTransform(),
        closed: true,
        points: [
          { xMm: 0, yMm: 0 },
          { xMm: 0, yMm: 0 },
          { xMm: 10, yMm: 0 },
          { xMm: 20, yMm: 0 },
          { xMm: 20, yMm: 10 },
        ],
        handles: [
          { incoming: null, outgoing: null },
          { incoming: null, outgoing: null },
          { incoming: null, outgoing: null },
          { incoming: null, outgoing: null },
          { incoming: { xMm: 20, yMm: 5 }, outgoing: null },
        ],
      },
    ]);
    const analysis = analyzeDocumentCutability(document);
    expect(
      analysis.issues.filter((issue) => issue.repairHint !== null).map(
        (issue) => [issue.repairHint, issue.repairNodeIndex],
      ),
    ).toEqual(expect.arrayContaining([
      ["zero-length-entity", 1],
      ["redundant-collinear-point", 2],
    ]));

    const zeroLengthOnlyAnalysis = {
      ...analysis,
      issues: analysis.issues.filter(
        (issue) => issue.repairHint !== "redundant-collinear-point",
      ),
    };
    const zeroLengthOnlyProposal = proposeSafeRepairs(
      document,
      zeroLengthOnlyAnalysis,
    );
    const zeroLengthOnlyReplacement = zeroLengthOnlyProposal.replacements.find(
      (object) => object.id === COLLINEAR_ID,
    );
    expect(zeroLengthOnlyReplacement?.points).toHaveLength(4);
    expect(zeroLengthOnlyReplacement?.points).toContainEqual({ xMm: 10, yMm: 0 });
    expect(
      zeroLengthOnlyProposal.changes.flatMap((change) => change.findingIds),
    ).toEqual(
      zeroLengthOnlyAnalysis.issues
        .filter((issue) => issue.repairHint === "zero-length-entity")
        .map((issue) => issue.id),
    );

    const fullProposal = proposeSafeRepairs(document, analysis);
    const fullReplacement = fullProposal.replacements.find(
      (object) => object.id === COLLINEAR_ID,
    );
    expect(fullReplacement?.points).toHaveLength(3);
    expect(fullReplacement?.points).not.toContainEqual({ xMm: 10, yMm: 0 });
  });

  it("does not leak safe findings from objects outside a selection analysis", () => {
    const selectedId = "20000000-0000-4000-8000-000000000020";
    const unselectedId = "20000000-0000-4000-8000-000000000021";
    const document = documentWith([
      {
        id: selectedId,
        type: "path",
        layerId: LAYER_ID,
        transform: identityTransform(),
        closed: true,
        points: [
          { xMm: 10, yMm: 10 },
          { xMm: 40, yMm: 10 },
          { xMm: 40, yMm: 40 },
          { xMm: 10, yMm: 40 },
        ],
      },
      {
        id: unselectedId,
        type: "path",
        layerId: LAYER_ID,
        transform: identityTransform(),
        closed: true,
        points: [
          { xMm: 60, yMm: 10 },
          { xMm: 75, yMm: 10 },
          { xMm: 90, yMm: 10 },
          { xMm: 90, yMm: 40 },
          { xMm: 60, yMm: 40 },
        ],
      },
    ]);
    const analysis = analyzeDocumentCutability(document, [selectedId]);
    expect(analysis.analyzedObjectIds).toEqual([selectedId]);
    expect(analysis.issues.some((issue) => issue.objectId === unselectedId)).toBe(false);
    expect(groupCutabilityFindings(document, analysis).safeToFix.findingCount).toBe(0);
  });
});
