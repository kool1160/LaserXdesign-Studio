import {
  createBlankProject,
  identityTransform,
  type LaserxDocument,
  type PathObject,
} from "@laserx/domain";
import { runGeometryEngineTask } from "@laserx/geometry";
import { describe, expect, it } from "vitest";

import {
  materializeGeometryOperation,
  prepareGeometryOperation,
} from "../src/index.js";

const FIRST_LAYER_ID = "10000000-0000-4000-8000-000000000000";
const SECOND_LAYER_ID = "20000000-0000-4000-8000-000000000000";
const FIRST_PATH_ID = "30000000-0000-4000-8000-000000000000";
const SECOND_PATH_ID = "40000000-0000-4000-8000-000000000000";

function rectangle(
  id: string,
  layerId: string,
  minXmm: number,
  maxXmm: number,
): PathObject {
  return {
    id,
    type: "path",
    layerId,
    transform: identityTransform(),
    closed: true,
    points: [
      { xMm: minXmm, yMm: 0 },
      { xMm: maxXmm, yMm: 0 },
      { xMm: maxXmm, yMm: 10 },
      { xMm: minXmm, yMm: 10 },
    ],
  };
}

function document(secondLayerId = FIRST_LAYER_ID): LaserxDocument {
  return createBlankProject({
    id: "50000000-0000-4000-8000-000000000000",
    documentId: "60000000-0000-4000-8000-000000000000",
    now: "2026-07-31T12:00:00.000Z",
    layers: [
      {
        id: FIRST_LAYER_ID,
        name: "Subject",
        visible: true,
        locked: false,
      },
      ...(secondLayerId === FIRST_LAYER_ID
        ? []
        : [
            {
              id: SECOND_LAYER_ID,
              name: "Other",
              visible: true,
              locked: false,
            },
          ]),
    ],
    activeLayerId: FIRST_LAYER_ID,
    objects: [
      rectangle(FIRST_PATH_ID, FIRST_LAYER_ID, 0, 10),
      rectangle(SECOND_PATH_ID, secondLayerId, 5, 15),
    ],
  }).document;
}

function bounds(path: PathObject) {
  return {
    minXmm: Math.min(...path.points.map((point) => point.xMm)),
    maxXmm: Math.max(...path.points.map((point) => point.xMm)),
    minYmm: Math.min(...path.points.map((point) => point.yMm)),
    maxYmm: Math.max(...path.points.map((point) => point.yMm)),
  };
}

describe("geometry operation preparation", () => {
  it("preserves first-selected subject order for opposite subtraction results", () => {
    const source = document();
    const subtract = (selectionIds: string[], operationId: string) => {
      const prepared = prepareGeometryOperation(source, selectionIds, {
        operationId,
        kind: "boolean",
        operation: "subtract",
      });
      const result = runGeometryEngineTask(prepared.task);
      const materialized = materializeGeometryOperation(prepared, result, () => {
        throw new Error("These subtraction fixtures should produce one contour.");
      });
      return { prepared, result: materialized.replacements[0] as PathObject };
    };

    const firstSubject = subtract(
      [FIRST_PATH_ID, SECOND_PATH_ID],
      "70000000-0000-4000-8000-000000000001",
    );
    const secondSubject = subtract(
      [SECOND_PATH_ID, FIRST_PATH_ID],
      "70000000-0000-4000-8000-000000000002",
    );

    expect(firstSubject.prepared.sourceObjectIds).toEqual([
      FIRST_PATH_ID,
      SECOND_PATH_ID,
    ]);
    expect(firstSubject.result.id).toBe(FIRST_PATH_ID);
    expect(bounds(firstSubject.result)).toEqual({
      minXmm: 0,
      maxXmm: 5,
      minYmm: 0,
      maxYmm: 10,
    });
    expect(secondSubject.prepared.sourceObjectIds).toEqual([
      SECOND_PATH_ID,
      FIRST_PATH_ID,
    ]);
    expect(secondSubject.result.id).toBe(SECOND_PATH_ID);
    expect(bounds(secondSubject.result)).toEqual({
      minXmm: 10,
      maxXmm: 15,
      minYmm: 0,
      maxYmm: 10,
    });
  });

  it("rejects boolean and multi-path offset operands from different layers", () => {
    const source = document(SECOND_LAYER_ID);
    expect(() =>
      prepareGeometryOperation(source, [FIRST_PATH_ID, SECOND_PATH_ID], {
        operationId: "70000000-0000-4000-8000-000000000003",
        kind: "boolean",
        operation: "union",
      }),
    ).toThrow(/share one editable layer/);
    expect(() =>
      prepareGeometryOperation(source, [FIRST_PATH_ID, SECOND_PATH_ID], {
        operationId: "70000000-0000-4000-8000-000000000004",
        kind: "offset",
        distanceMm: 1,
        join: "round",
      }),
    ).toThrow(/share one editable layer/);
  });
});
