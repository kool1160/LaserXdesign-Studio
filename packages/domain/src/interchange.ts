import {
  IDENTITY_AFFINE_TRANSFORM,
  applyAffineTransform,
  boundsFromPoints,
  composeAffineTransforms,
  flattenEditablePath,
  unionBounds,
  type AffineTransformMm,
  type BoundsMm,
  type PathControlHandles,
  type PointMm,
} from "@laserx/geometry";

import type { DocumentObject, LaserxDocument } from "./model.js";

export type VectorInterchangeFormat = "svg" | "dxf";
export type VectorSourceUnit =
  | "millimeters"
  | "centimeters"
  | "inches"
  | "pixels"
  | "unitless";

export interface InterchangeWarning {
  code: string;
  message: string;
  source: string | null;
}

export interface InterchangePath {
  layerName: string | null;
  closed: boolean;
  points: PointMm[];
  handles?: PathControlHandles[] | undefined;
}

export interface VectorImportCandidate {
  format: VectorInterchangeFormat;
  sourceUnit: VectorSourceUnit;
  dimensionsMm: { widthMm: number; heightMm: number } | null;
  paths: InterchangePath[];
  warnings: InterchangeWarning[];
  assumptions: string[];
}

export interface VectorExportSummary {
  format: VectorInterchangeFormat;
  objectCount: number;
  warningCount: number;
  warnings: InterchangeWarning[];
  units: "millimeters";
  bounds: BoundsMm | null;
}

export interface VectorExportArtifact {
  content: string;
  summary: VectorExportSummary;
}

export interface FlattenedDocumentPath {
  layerName: string;
  closed: boolean;
  points: PointMm[];
}

export interface FlattenedDocumentInterchange {
  paths: FlattenedDocumentPath[];
  warnings: InterchangeWarning[];
  bounds: BoundsMm | null;
}

function ellipsePointCount(
  radiusXmm: number,
  radiusYmm: number,
  toleranceMm: number,
): number {
  const radius = Math.max(radiusXmm, radiusYmm);
  if (radius <= toleranceMm) {
    return 16;
  }
  const halfAngle = Math.acos(Math.max(-1, 1 - toleranceMm / radius));
  return Math.min(
    4_096,
    Math.max(16, Math.ceil(Math.PI / Math.max(halfAngle, 1e-6))),
  );
}

function transformPoints(
  points: readonly PointMm[],
  transform: AffineTransformMm,
): PointMm[] {
  return points.map((point) => applyAffineTransform(point, transform));
}

function maximumAffineStretch(transform: AffineTransformMm): number {
  const scale = Math.max(
    Math.abs(transform.a),
    Math.abs(transform.b),
    Math.abs(transform.c),
    Math.abs(transform.d),
  );
  if (scale === 0) {
    return 0;
  }
  const a = transform.a / scale;
  const b = transform.b / scale;
  const c = transform.c / scale;
  const d = transform.d / scale;
  const squaredFrobenius = a * a + b * b + c * c + d * d;
  const determinant = a * d - b * c;
  const discriminant = Math.max(
    0,
    squaredFrobenius * squaredFrobenius - 4 * determinant * determinant,
  );
  const stretch =
    scale * Math.sqrt((squaredFrobenius + Math.sqrt(discriminant)) / 2);
  if (!Number.isFinite(stretch)) {
    throw new RangeError("Object transform is too large to flatten safely for interchange.");
  }
  return stretch;
}

function transformPathForWorldFlattening(
  object: Extract<DocumentObject, { type: "path" }>,
  transform: AffineTransformMm,
): {
  closed: boolean;
  points: PointMm[];
  handles?: PathControlHandles[] | undefined;
} {
  return {
    closed: object.closed,
    points: transformPoints(object.points, transform),
    ...(object.handles === undefined
      ? {}
      : {
          handles: object.handles.map((handles) => ({
            incoming:
              handles.incoming === null
                ? null
                : applyAffineTransform(handles.incoming, transform),
            outgoing:
              handles.outgoing === null
                ? null
                : applyAffineTransform(handles.outgoing, transform),
          })),
        }),
  };
}

function primitivePaths(
  object: Exclude<DocumentObject, { type: "group" }>,
  transform: AffineTransformMm,
  layerName: string,
  toleranceMm: number,
): FlattenedDocumentPath[] {
  switch (object.type) {
    case "line":
      return [
        {
          layerName,
          closed: false,
          points: transformPoints([object.start, object.end], transform),
        },
      ];
    case "rectangle":
      return [
        {
          layerName,
          closed: true,
          points: transformPoints(
            [
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
            ],
            transform,
          ),
        },
      ];
    case "ellipse": {
      const maximumStretch = maximumAffineStretch(transform);
      const localToleranceMm = maximumStretch === 0
        ? toleranceMm
        : toleranceMm / maximumStretch;
      const pointCount = ellipsePointCount(
        object.radiusXmm,
        object.radiusYmm,
        localToleranceMm,
      );
      return [
        {
          layerName,
          closed: true,
          points: transformPoints(
            Array.from({ length: pointCount }, (_unused, index) => {
              const angle = (index / pointCount) * Math.PI * 2;
              return {
                xMm: object.center.xMm + Math.cos(angle) * object.radiusXmm,
                yMm: object.center.yMm + Math.sin(angle) * object.radiusYmm,
              };
            }),
            transform,
          ),
        },
      ];
    }
    case "path":
      return [
        {
          layerName,
          closed: object.closed,
          points: flattenEditablePath(
            transformPathForWorldFlattening(object, transform),
            toleranceMm,
          ),
        },
      ];
    case "text":
      return object.contours.map((contour) => ({
        layerName,
        closed: contour.closed,
        points: transformPoints(
          contour.points.map((point) => ({
            xMm: point.xMm + object.origin.xMm,
            yMm: point.yMm + object.origin.yMm,
          })),
          transform,
        ),
      }));
  }
}

function collectObjectPaths(
  object: DocumentObject,
  parentTransform: AffineTransformMm,
  layerName: string,
  toleranceMm: number,
): FlattenedDocumentPath[] {
  const worldTransform = composeAffineTransforms(parentTransform, object.transform);
  return object.type === "group"
    ? object.children.flatMap((child) =>
        collectObjectPaths(child, worldTransform, layerName, toleranceMm),
      )
    : primitivePaths(object, worldTransform, layerName, toleranceMm);
}

export function flattenDocumentForInterchange(
  document: LaserxDocument,
  toleranceMm = 0.01,
): FlattenedDocumentInterchange {
  if (!Number.isFinite(toleranceMm) || toleranceMm <= 0) {
    throw new RangeError("Interchange flattening tolerance must be positive and finite.");
  }
  const layerNames = new Map(document.layers.map((layer) => [layer.id, layer.name]));
  const visibleLayerIds = new Set(
    document.layers.filter((layer) => layer.visible).map((layer) => layer.id),
  );
  const hiddenCount = document.objects.filter(
    (object) => !visibleLayerIds.has(object.layerId),
  ).length;
  const paths = document.objects
    .filter((object) => visibleLayerIds.has(object.layerId))
    .flatMap((object) =>
      collectObjectPaths(
        object,
        IDENTITY_AFFINE_TRANSFORM,
        layerNames.get(object.layerId) ?? "Layer",
        toleranceMm,
      ),
    )
    .filter((path) => path.points.length >= (path.closed ? 3 : 2));
  const bounds = paths.reduce<BoundsMm | null>((current, path) => {
    const next = boundsFromPoints(path.points);
    return current === null ? next : unionBounds(current, next);
  }, null);
  const warnings: InterchangeWarning[] = hiddenCount === 0
    ? []
    : [
        {
          code: "hidden-objects-skipped",
          message: `${String(hiddenCount)} object(s) on hidden layers were not exported.`,
          source: null,
        },
      ];
  return { paths, warnings, bounds };
}
