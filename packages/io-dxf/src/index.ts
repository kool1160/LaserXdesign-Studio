import {
  flattenDocumentForInterchange,
  type InterchangePath,
  type InterchangeWarning,
  type LaserxDocument,
  type PointMm,
  type VectorExportArtifact,
  type VectorImportCandidate,
  type VectorSourceUnit,
} from "@laserx/domain";

const MAX_DXF_BYTES = 5_000_000;
const MAX_DXF_PAIRS = 500_000;
const MAX_DXF_ENTITIES = 100_000;
const MAX_DXF_GEOMETRY_POINTS = 200_000;
const DEFAULT_TOLERANCE_MM = 0.01;

export type UnitlessDxfUnit = "millimeters" | "inches";

export interface DxfImportOptions {
  unitlessUnit?: UnitlessDxfUnit | undefined;
  curveToleranceMm?: number | undefined;
}

interface DxfPair {
  code: number;
  value: string;
}

interface DxfEntity {
  type: string;
  pairs: DxfPair[];
}

class DxfGeometryPointLimitError extends RangeError {
  public constructor() {
    super("DXF input expands beyond the 200,000 geometry-point safety limit.");
    this.name = "DxfGeometryPointLimitError";
  }
}

class DxfGeometryPointBudget {
  #used = 0;

  public reserve(pointCount: number): void {
    if (!Number.isSafeInteger(pointCount) || pointCount < 0) {
      throw new RangeError("DXF geometry point allocation must be a nonnegative safe integer.");
    }
    if (pointCount > MAX_DXF_GEOMETRY_POINTS - this.#used) {
      throw new DxfGeometryPointLimitError();
    }
    this.#used += pointCount;
  }
}

function parsePairs(source: string): DxfPair[] {
  if (source.length > MAX_DXF_BYTES) {
    throw new RangeError("DXF input exceeds the 5 MB safety limit.");
  }
  if (source.includes("\0")) {
    throw new RangeError("DXF input contains binary data and is not ASCII DXF.");
  }
  const lines = source.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  if (lines.at(-1) === "") {
    lines.pop();
  }
  if (lines.length % 2 !== 0) {
    throw new RangeError("DXF input must contain group-code/value line pairs.");
  }
  if (lines.length / 2 > MAX_DXF_PAIRS) {
    throw new RangeError("DXF input contains too many group-code pairs.");
  }
  const pairs: DxfPair[] = [];
  for (let index = 0; index < lines.length; index += 2) {
    const rawCode = lines[index]?.trim() ?? "";
    const code = Number(rawCode);
    if (!Number.isInteger(code)) {
      throw new RangeError(`Invalid DXF group code '${rawCode}'.`);
    }
    pairs.push({ code, value: lines[index + 1]?.trim() ?? "" });
  }
  return pairs;
}

function numberValue(entity: DxfEntity, code: number): number | undefined {
  const pair = entity.pairs.find((candidate) => candidate.code === code);
  if (pair === undefined) {
    return undefined;
  }
  const value = Number(pair.value);
  if (!Number.isFinite(value)) {
    throw new RangeError(`${entity.type} contains a non-finite group ${String(code)} value.`);
  }
  return value;
}

function requiredNumber(entity: DxfEntity, code: number): number {
  const value = numberValue(entity, code);
  if (value === undefined) {
    throw new RangeError(`${entity.type} is missing required group code ${String(code)}.`);
  }
  return value;
}

function stringValue(entity: DxfEntity, code: number, fallback: string): string {
  return entity.pairs.find((candidate) => candidate.code === code)?.value || fallback;
}

function hasUnsupportedElevation(entity: DxfEntity): boolean {
  const elevated = [30, 31, 32, 33, 38].some((code) => {
    const value = numberValue(entity, code);
    return value !== undefined && Math.abs(value) > 1e-9;
  });
  const extrusionX = numberValue(entity, 210);
  const extrusionY = numberValue(entity, 220);
  const extrusionZ = numberValue(entity, 230);
  const nonPlanarExtrusion =
    (extrusionX !== undefined && Math.abs(extrusionX) > 1e-9) ||
    (extrusionY !== undefined && Math.abs(extrusionY) > 1e-9) ||
    (extrusionZ !== undefined && Math.abs(extrusionZ - 1) > 1e-9);
  return elevated || nonPlanarExtrusion;
}

function unitsFromPairs(
  pairs: readonly DxfPair[],
  requestedUnitless: UnitlessDxfUnit | undefined,
): { sourceUnit: VectorSourceUnit; scaleToMm: number; assumptions: string[] } {
  const markerIndex = pairs.findIndex(
    (pair) => pair.code === 9 && pair.value.toUpperCase() === "$INSUNITS",
  );
  const rawUnits = markerIndex < 0
    ? 0
    : Number(pairs.slice(markerIndex + 1).find((pair) => pair.code === 70)?.value ?? 0);
  switch (rawUnits) {
    case 1:
      return { sourceUnit: "inches", scaleToMm: 25.4, assumptions: [] };
    case 4:
      return { sourceUnit: "millimeters", scaleToMm: 1, assumptions: [] };
    case 5:
      return { sourceUnit: "centimeters", scaleToMm: 10, assumptions: [] };
    case 0:
      if (requestedUnitless === undefined) {
        throw new RangeError(
          "This DXF is unitless. Choose whether one drawing unit means one millimeter or one inch before previewing it.",
        );
      }
      return {
        sourceUnit: "unitless",
        scaleToMm: requestedUnitless === "inches" ? 25.4 : 1,
        assumptions: [
          `Unitless DXF interpreted explicitly as ${requestedUnitless}.`,
        ],
      };
    default:
      throw new RangeError(
        `DXF $INSUNITS value ${String(rawUnits)} is not supported; use inches, millimeters, centimeters, or an explicit unitless assumption.`,
      );
  }
}

function entitySections(pairs: readonly DxfPair[]): DxfEntity[] {
  let insideEntities = false;
  const entities: DxfEntity[] = [];
  for (let index = 0; index < pairs.length; index += 1) {
    const pair = pairs[index] as DxfPair;
    if (
      pair.code === 0 &&
      pair.value.toUpperCase() === "SECTION" &&
      pairs[index + 1]?.code === 2 &&
      pairs[index + 1]?.value.toUpperCase() === "ENTITIES"
    ) {
      insideEntities = true;
      index += 1;
      continue;
    }
    if (!insideEntities) {
      continue;
    }
    if (pair.code === 0 && pair.value.toUpperCase() === "ENDSEC") {
      break;
    }
    if (pair.code !== 0) {
      continue;
    }
    let endIndex = index + 1;
    while (endIndex < pairs.length && pairs[endIndex]?.code !== 0) {
      endIndex += 1;
    }
    entities.push({
      type: pair.value.toUpperCase(),
      pairs: pairs.slice(index + 1, endIndex),
    });
    if (entities.length > MAX_DXF_ENTITIES) {
      throw new RangeError("DXF input contains too many entities.");
    }
    index = endIndex - 1;
  }
  if (!insideEntities) {
    throw new RangeError("DXF input does not contain an ENTITIES section.");
  }
  return entities;
}

function arcPointCount(
  radiusMm: number,
  sweepRadians: number,
  toleranceMm: number,
  minimumSegmentCount = 2,
): number {
  if (radiusMm <= toleranceMm) {
    return minimumSegmentCount;
  }
  const maximumAngle = 2 * Math.acos(Math.max(-1, 1 - toleranceMm / radiusMm));
  return Math.min(
    4_096,
    Math.max(
      minimumSegmentCount,
      Math.ceil(Math.abs(sweepRadians) / Math.max(maximumAngle, 1e-6)),
    ),
  );
}

function sampleArc(
  center: PointMm,
  radiusMm: number,
  startRadians: number,
  sweepRadians: number,
  toleranceMm: number,
  pointBudget: DxfGeometryPointBudget,
  includeStart = true,
  minimumSegmentCount = 2,
): PointMm[] {
  const segmentCount = arcPointCount(
    radiusMm,
    sweepRadians,
    toleranceMm,
    minimumSegmentCount,
  );
  pointBudget.reserve(segmentCount + (includeStart ? 1 : 0));
  return Array.from(
    { length: segmentCount + (includeStart ? 1 : 0) },
    (_unused, index) => {
      const step = includeStart ? index : index + 1;
      const angle = startRadians + (sweepRadians * step) / segmentCount;
      return {
        xMm: center.xMm + Math.cos(angle) * radiusMm,
        yMm: center.yMm + Math.sin(angle) * radiusMm,
      };
    },
  );
}

function appendBulgeSegment(
  output: PointMm[],
  start: PointMm,
  end: PointMm,
  bulge: number,
  toleranceMm: number,
  pointBudget: DxfGeometryPointBudget,
  omitFinalPoint: boolean,
): void {
  if (Math.abs(bulge) <= 1e-12) {
    if (!omitFinalPoint) {
      pointBudget.reserve(1);
      output.push(end);
    }
    return;
  }
  const chord = Math.hypot(end.xMm - start.xMm, end.yMm - start.yMm);
  if (chord <= 1e-12) {
    return;
  }
  const midpoint = {
    xMm: (start.xMm + end.xMm) / 2,
    yMm: (start.yMm + end.yMm) / 2,
  };
  const centerOffset = (chord * (1 - bulge * bulge)) / (4 * bulge);
  const center = {
    xMm: midpoint.xMm - ((end.yMm - start.yMm) / chord) * centerOffset,
    yMm: midpoint.yMm + ((end.xMm - start.xMm) / chord) * centerOffset,
  };
  const radius = Math.hypot(start.xMm - center.xMm, start.yMm - center.yMm);
  const startAngle = Math.atan2(start.yMm - center.yMm, start.xMm - center.xMm);
  const sweep = 4 * Math.atan(bulge);
  const sampled = sampleArc(
    center,
    radius,
    startAngle,
    sweep,
    toleranceMm,
    pointBudget,
    false,
  );
  if (omitFinalPoint) {
    sampled.pop();
  }
  output.push(...sampled);
}

function parseLwPolyline(
  entity: DxfEntity,
  scaleToMm: number,
  toleranceMm: number,
  pointBudget: DxfGeometryPointBudget,
): InterchangePath {
  const vertices: Array<PointMm & { bulge: number }> = [];
  for (let index = 0; index < entity.pairs.length; index += 1) {
    const pair = entity.pairs[index] as DxfPair;
    if (pair.code !== 10) {
      continue;
    }
    const x = Number(pair.value);
    let vertexEnd = index + 1;
    while (vertexEnd < entity.pairs.length && entity.pairs[vertexEnd]?.code !== 10) {
      vertexEnd += 1;
    }
    const vertexPairs = entity.pairs.slice(index + 1, vertexEnd);
    const yPair = vertexPairs.find((candidate) => candidate.code === 20);
    if (!Number.isFinite(x) || yPair?.code !== 20 || !Number.isFinite(Number(yPair.value))) {
      throw new RangeError("LWPOLYLINE contains an invalid vertex.");
    }
    const bulge = Number(
      vertexPairs.find((candidate) => candidate.code === 42)?.value ?? 0,
    );
    if (!Number.isFinite(bulge)) {
      throw new RangeError("LWPOLYLINE contains an invalid bulge value.");
    }
    vertices.push({ xMm: x * scaleToMm, yMm: Number(yPair.value) * scaleToMm, bulge });
    index = vertexEnd - 1;
  }
  const closed = ((numberValue(entity, 70) ?? 0) & 1) === 1;
  if (vertices.length < (closed ? 3 : 2)) {
    throw new RangeError("LWPOLYLINE does not contain enough vertices.");
  }
  const first = vertices[0] as PointMm & { bulge: number };
  pointBudget.reserve(1);
  const points: PointMm[] = [{ xMm: first.xMm, yMm: first.yMm }];
  const segmentCount = closed ? vertices.length : vertices.length - 1;
  for (let index = 0; index < segmentCount; index += 1) {
    const start = vertices[index] as PointMm & { bulge: number };
    const end = vertices[(index + 1) % vertices.length] as PointMm & { bulge: number };
    appendBulgeSegment(
      points,
      start,
      end,
      start.bulge,
      toleranceMm,
      pointBudget,
      closed && index === segmentCount - 1,
    );
  }
  return {
    layerName: stringValue(entity, 8, "0"),
    closed,
    points,
  };
}

function warning(code: string, message: string, source: string): InterchangeWarning {
  return { code, message, source };
}

export function importDxf(
  source: string,
  options: DxfImportOptions = {},
): VectorImportCandidate {
  const toleranceMm = options.curveToleranceMm ?? DEFAULT_TOLERANCE_MM;
  if (!Number.isFinite(toleranceMm) || toleranceMm <= 0) {
    throw new RangeError("DXF curve tolerance must be positive and finite.");
  }
  const pairs = parsePairs(source);
  const units = unitsFromPairs(pairs, options.unitlessUnit);
  const entities = entitySections(pairs);
  const paths: InterchangePath[] = [];
  const warnings: InterchangeWarning[] = [];
  const pointBudget = new DxfGeometryPointBudget();
  for (let index = 0; index < entities.length; index += 1) {
    const entity = entities[index] as DxfEntity;
    const sourceLabel = `${entity.type} ${String(index + 1)}`;
    if (entity.type === "VERTEX" || entity.type === "SEQEND") {
      continue;
    }
    if (hasUnsupportedElevation(entity)) {
      warnings.push(warning("unsupported-3d-entity", `${sourceLabel} has non-zero Z/elevation and was skipped.`, sourceLabel));
      continue;
    }
    try {
      switch (entity.type) {
        case "LINE":
          pointBudget.reserve(2);
          paths.push({
            layerName: stringValue(entity, 8, "0"),
            closed: false,
            points: [
              { xMm: requiredNumber(entity, 10) * units.scaleToMm, yMm: requiredNumber(entity, 20) * units.scaleToMm },
              { xMm: requiredNumber(entity, 11) * units.scaleToMm, yMm: requiredNumber(entity, 21) * units.scaleToMm },
            ],
          });
          break;
        case "LWPOLYLINE":
          paths.push(
            parseLwPolyline(
              entity,
              units.scaleToMm,
              toleranceMm,
              pointBudget,
            ),
          );
          break;
        case "CIRCLE": {
          const radiusMm = requiredNumber(entity, 40) * units.scaleToMm;
          if (radiusMm <= 0) {
            throw new RangeError("CIRCLE radius must be positive.");
          }
          paths.push({
            layerName: stringValue(entity, 8, "0"),
            closed: true,
            points: sampleArc(
              { xMm: requiredNumber(entity, 10) * units.scaleToMm, yMm: requiredNumber(entity, 20) * units.scaleToMm },
              radiusMm,
              0,
              Math.PI * 2,
              toleranceMm,
              pointBudget,
              true,
              3,
            ).slice(0, -1),
          });
          break;
        }
        case "ARC": {
          const radiusMm = requiredNumber(entity, 40) * units.scaleToMm;
          if (radiusMm <= 0) {
            throw new RangeError("ARC radius must be positive.");
          }
          const startDegrees = requiredNumber(entity, 50);
          let endDegrees = requiredNumber(entity, 51);
          while (endDegrees <= startDegrees) {
            endDegrees += 360;
          }
          paths.push({
            layerName: stringValue(entity, 8, "0"),
            closed: false,
            points: sampleArc(
              { xMm: requiredNumber(entity, 10) * units.scaleToMm, yMm: requiredNumber(entity, 20) * units.scaleToMm },
              radiusMm,
              (startDegrees * Math.PI) / 180,
              ((endDegrees - startDegrees) * Math.PI) / 180,
              toleranceMm,
              pointBudget,
            ),
          });
          break;
        }
        case "POLYLINE": {
          const flags = numberValue(entity, 70) ?? 0;
          if ((flags & 8) !== 0 || (flags & 16) !== 0 || (flags & 64) !== 0) {
            warnings.push(warning("unsupported-3d-polyline", `${sourceLabel} is a 3D/polyface mesh and was skipped.`, sourceLabel));
            break;
          }
          const vertices: Array<PointMm & { bulge: number }> = [];
          let cursor = index + 1;
          for (; cursor < entities.length; cursor += 1) {
            const child = entities[cursor] as DxfEntity;
            if (child.type === "SEQEND") {
              break;
            }
            if (child.type !== "VERTEX") {
              break;
            }
            if (hasUnsupportedElevation(child)) {
              vertices.length = 0;
              warnings.push(warning("unsupported-3d-polyline", `${sourceLabel} has non-zero vertex Z and was skipped.`, sourceLabel));
              break;
            }
            vertices.push({
              xMm: requiredNumber(child, 10) * units.scaleToMm,
              yMm: requiredNumber(child, 20) * units.scaleToMm,
              bulge: (numberValue(child, 42) ?? 0),
            });
          }
          index = Math.max(index, cursor);
          const closed = (flags & 1) === 1;
          if (vertices.length >= (closed ? 3 : 2)) {
            const first = vertices[0] as PointMm & { bulge: number };
            pointBudget.reserve(1);
            const points: PointMm[] = [{ xMm: first.xMm, yMm: first.yMm }];
            const segmentCount = closed ? vertices.length : vertices.length - 1;
            for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
              const start = vertices[segmentIndex] as PointMm & { bulge: number };
              const end = vertices[(segmentIndex + 1) % vertices.length] as PointMm & { bulge: number };
              appendBulgeSegment(
                points,
                start,
                end,
                start.bulge,
                toleranceMm,
                pointBudget,
                closed && segmentIndex === segmentCount - 1,
              );
            }
            paths.push({ layerName: stringValue(entity, 8, "0"), closed, points });
          }
          break;
        }
        default:
          warnings.push(warning("unsupported-dxf-entity", `${sourceLabel} is not supported and was skipped.`, sourceLabel));
      }
    } catch (error) {
      if (error instanceof DxfGeometryPointLimitError) {
        throw error;
      }
      warnings.push(
        warning(
          "invalid-dxf-entity",
          `${sourceLabel} was skipped: ${error instanceof Error ? error.message : String(error)}`,
          sourceLabel,
        ),
      );
    }
  }
  return {
    format: "dxf",
    sourceUnit: units.sourceUnit,
    dimensionsMm: null,
    paths,
    warnings,
    assumptions: units.assumptions,
  };
}

function formatNumber(value: number): string {
  const normalized = Math.abs(value) < 5e-10 ? 0 : value;
  return normalized.toFixed(6).replace(/\.0+$|(?<=\.[0-9]*?)0+$/u, "");
}

function sanitizeLayerName(name: string): string {
  const sanitized = name.replace(/[<>/\\":;?*|=`]/gu, "_").trim().slice(0, 255);
  return sanitized || "0";
}

function pair(code: number, value: string | number): string {
  return `${String(code)}\n${String(value)}\n`;
}

export function exportDxf(
  document: LaserxDocument,
  toleranceMm = DEFAULT_TOLERANCE_MM,
): VectorExportArtifact {
  const flattened = flattenDocumentForInterchange(document, toleranceMm);
  const layerMap = new Map<string, string>();
  const usedLayerNames = new Set<string>();
  for (const path of flattened.paths) {
    if (layerMap.has(path.layerName)) {
      continue;
    }
    const base = sanitizeLayerName(path.layerName);
    let name = base;
    let sequence = 2;
    while (usedLayerNames.has(name.toLocaleLowerCase())) {
      const suffix = `_${String(sequence)}`;
      name = `${base.slice(0, 255 - suffix.length)}${suffix}`;
      sequence += 1;
    }
    layerMap.set(path.layerName, name);
    usedLayerNames.add(name.toLocaleLowerCase());
  }
  const layerNames = [...layerMap.values()];
  let content = "";
  content += pair(0, "SECTION") + pair(2, "HEADER");
  content += pair(9, "$ACADVER") + pair(1, "AC1027");
  content += pair(9, "$INSUNITS") + pair(70, 4);
  content += pair(0, "ENDSEC");
  content += pair(0, "SECTION") + pair(2, "TABLES");
  content += pair(0, "TABLE") + pair(2, "LAYER") + pair(70, layerNames.length);
  for (const layerName of layerNames) {
    content += pair(0, "LAYER") + pair(2, layerName) + pair(70, 0) + pair(62, 7) + pair(6, "CONTINUOUS");
  }
  content += pair(0, "ENDTAB") + pair(0, "ENDSEC");
  content += pair(0, "SECTION") + pair(2, "ENTITIES");
  for (const path of flattened.paths) {
    const layerName = layerMap.get(path.layerName) ?? "0";
    if (!path.closed && path.points.length === 2) {
      const start = path.points[0] as PointMm;
      const end = path.points[1] as PointMm;
      content += pair(0, "LINE") + pair(8, layerName);
      content += pair(10, formatNumber(start.xMm)) + pair(20, formatNumber(start.yMm)) + pair(30, 0);
      content += pair(11, formatNumber(end.xMm)) + pair(21, formatNumber(end.yMm)) + pair(31, 0);
      continue;
    }
    content += pair(0, "LWPOLYLINE") + pair(8, layerName);
    content += pair(90, path.points.length) + pair(70, path.closed ? 1 : 0);
    for (const point of path.points) {
      content += pair(10, formatNumber(point.xMm)) + pair(20, formatNumber(point.yMm));
    }
  }
  content += pair(0, "ENDSEC") + pair(0, "EOF");
  return {
    content,
    summary: {
      format: "dxf",
      objectCount: flattened.paths.length,
      warningCount: flattened.warnings.length,
      warnings: flattened.warnings,
      units: "millimeters",
      bounds: flattened.bounds,
    },
  };
}
