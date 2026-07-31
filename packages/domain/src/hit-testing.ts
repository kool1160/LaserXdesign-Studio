import {
  IDENTITY_AFFINE_TRANSFORM,
  applyAffineTransform,
  boundsContainPoint,
  boundsIntersect,
  composeAffineTransforms,
  distancePointToSegment,
  invertAffineTransform,
  pointInCompoundPolygonEvenOdd,
  pointInPolygon,
  type AffineTransformMm,
  type BoundsMm,
  type PointMm,
} from "@laserx/geometry";

import {
  getObjectBounds,
  getObjectsInRenderOrder,
  isLayerEditable,
  type DocumentObject,
  type HitTestRequest,
  type HitTestResult,
  type LaserxDocument,
} from "./model.js";

function distanceToPolyline(
  point: PointMm,
  points: readonly PointMm[],
  closed: boolean,
): number {
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    if (start !== undefined && end !== undefined) {
      distance = Math.min(
        distance,
        distancePointToSegment(point, start, end),
      );
    }
  }
  if (closed) {
    const start = points.at(-1);
    const end = points[0];
    if (start !== undefined && end !== undefined) {
      distance = Math.min(
        distance,
        distancePointToSegment(point, start, end),
      );
    }
  }
  return distance;
}

function primitiveWorldPoints(
  object: Exclude<DocumentObject, { type: "group" }>,
  transform: AffineTransformMm,
): PointMm[] {
  switch (object.type) {
    case "line":
      return [object.start, object.end].map((point) =>
        applyAffineTransform(point, transform),
      );
    case "rectangle":
      return [
        object.origin,
        {
          xMm: object.origin.xMm + object.widthMm,
          yMm: object.origin.yMm,
        },
        {
          xMm: object.origin.xMm + object.widthMm,
          yMm: object.origin.yMm + object.heightMm,
        },
        {
          xMm: object.origin.xMm,
          yMm: object.origin.yMm + object.heightMm,
        },
      ].map((point) => applyAffineTransform(point, transform));
    case "ellipse":
      return Array.from({ length: 64 }, (_value, index) => {
        const radians = (index / 64) * Math.PI * 2;
        return applyAffineTransform(
          {
            xMm:
              object.center.xMm + Math.cos(radians) * object.radiusXmm,
            yMm:
              object.center.yMm + Math.sin(radians) * object.radiusYmm,
          },
          transform,
        );
      });
    case "path":
      return object.points.map((point) =>
        applyAffineTransform(point, transform),
      );
    case "text":
      return object.contours.flatMap((contour) =>
        contour.points.map((point) =>
          applyAffineTransform(
            {
              xMm: point.xMm + object.origin.xMm,
              yMm: point.yMm + object.origin.yMm,
            },
            transform,
          ),
        ),
      );
  }
}

function primitiveHitDistance(
  object: Exclude<DocumentObject, { type: "group" }>,
  point: PointMm,
  transform: AffineTransformMm,
): number {
  if (object.type === "text") {
    const contours = object.contours.map((contour) => ({
      closed: contour.closed,
      points: contour.points.map((candidate) =>
        applyAffineTransform(
          {
            xMm: candidate.xMm + object.origin.xMm,
            yMm: candidate.yMm + object.origin.yMm,
          },
          transform,
        ),
      ),
    }));
    const filled = pointInCompoundPolygonEvenOdd(
      point,
      contours
        .filter((contour) => contour.closed)
        .map((contour) => contour.points),
    );
    if (filled) {
      return 0;
    }
    return contours.reduce(
      (minimum, contour) =>
        Math.min(
          minimum,
          distanceToPolyline(point, contour.points, contour.closed),
        ),
      Number.POSITIVE_INFINITY,
    );
  }
  if (object.type === "ellipse") {
    const local = applyAffineTransform(
      point,
      invertAffineTransform(transform),
    );
    const normalized =
      ((local.xMm - object.center.xMm) / object.radiusXmm) ** 2 +
      ((local.yMm - object.center.yMm) / object.radiusYmm) ** 2;
    if (normalized <= 1) {
      return 0;
    }
  }
  const points = primitiveWorldPoints(object, transform);
  const closed =
    object.type === "rectangle" ||
    object.type === "ellipse" ||
    (object.type === "path" && object.closed);
  if (closed && pointInPolygon(point, points)) {
    return 0;
  }
  return distanceToPolyline(point, points, closed);
}

function objectHitDistance(
  object: DocumentObject,
  point: PointMm,
  toleranceMm: number,
  parentTransform: AffineTransformMm = IDENTITY_AFFINE_TRANSFORM,
): number {
  if (
    !boundsContainPoint(
      getObjectBounds(object, parentTransform),
      point,
      toleranceMm,
    )
  ) {
    return Number.POSITIVE_INFINITY;
  }
  const transform = composeAffineTransforms(
    parentTransform,
    object.transform,
  );
  if (object.type !== "group") {
    return primitiveHitDistance(object, point, transform);
  }
  return object.children.reduce(
    (distance, child) =>
      Math.min(
        distance,
        objectHitDistance(child, point, toleranceMm, transform),
      ),
    Number.POSITIVE_INFINITY,
  );
}

export function hitTestDocument(request: HitTestRequest): HitTestResult[] {
  if (!Number.isFinite(request.toleranceMm) || request.toleranceMm < 0) {
    throw new RangeError("Hit-test tolerance must be finite and nonnegative.");
  }
  const renderOrder = getObjectsInRenderOrder(request.document);
  const results: HitTestResult[] = [];
  for (let index = renderOrder.length - 1; index >= 0; index -= 1) {
    const object = renderOrder[index];
    if (
      object === undefined ||
      !isLayerEditable(request.document, object.layerId)
    ) {
      continue;
    }
    const distanceMm = objectHitDistance(
      object,
      request.point,
      request.toleranceMm,
    );
    if (distanceMm <= request.toleranceMm) {
      results.push({ objectId: object.id, distanceMm });
    }
  }
  return results;
}

export function marqueeHitTest(
  document: LaserxDocument,
  bounds: BoundsMm,
): string[] {
  return getObjectsInRenderOrder(document)
    .filter(
      (object) =>
        isLayerEditable(document, object.layerId) &&
        boundsIntersect(bounds, getObjectBounds(object)),
    )
    .map((object) => object.id);
}
