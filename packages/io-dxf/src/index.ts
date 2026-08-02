import {
  flattenDocumentForInterchange,
  type InterchangeFinding,
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
const DEFAULT_REPAIR_TOLERANCE_MM = 0.1;

export type UnitlessDxfUnit = "millimeters" | "inches";

export interface DxfImportOptions {
  unitlessUnit?: UnitlessDxfUnit | undefined;
  curveToleranceMm?: number | undefined;
  repairToleranceMm?: number | undefined;
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

function numberValues(entity: DxfEntity, code: number): number[] {
  return entity.pairs
    .filter((pair) => pair.code === code)
    .map((pair) => {
      const value = Number(pair.value);
      if (!Number.isFinite(value)) {
        throw new RangeError(`${entity.type} contains a non-finite group ${String(code)} value.`);
      }
      return value;
    });
}

function stringValue(entity: DxfEntity, code: number, fallback: string): string {
  return entity.pairs.find((candidate) => candidate.code === code)?.value || fallback;
}

function hasUnsupportedElevation(entity: DxfEntity): boolean {
  const elevated = [30, 31, 32, 33, 38].some((code) =>
    numberValues(entity, code).some((value) => value !== 0)
  );
  const extrusionX = numberValues(entity, 210);
  const extrusionY = numberValues(entity, 220);
  const extrusionZ = numberValues(entity, 230);
  const nonPlanarExtrusion =
    extrusionX.some((value) => value !== 0) ||
    extrusionY.some((value) => value !== 0) ||
    extrusionZ.some((value) => value !== 1);
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

interface HomogeneousPoint {
  x: number;
  y: number;
  w: number;
}

function evaluateRationalBSpline(
  controlPoints: readonly PointMm[],
  weights: readonly number[],
  knots: readonly number[],
  degree: number,
  parameter: number,
): PointMm {
  const lastControlIndex = controlPoints.length - 1;
  let span = lastControlIndex;
  if (parameter < (knots[lastControlIndex + 1] as number)) {
    let low = degree;
    let high = lastControlIndex + 1;
    while (high - low > 1) {
      const middle = Math.floor((low + high) / 2);
      if (parameter < (knots[middle] as number)) high = middle;
      else low = middle;
    }
    span = low;
  }
  const working: HomogeneousPoint[] = [];
  for (let index = 0; index <= degree; index += 1) {
    const controlIndex = span - degree + index;
    const point = controlPoints[controlIndex] as PointMm;
    const weight = weights[controlIndex] as number;
    working.push({ x: point.xMm * weight, y: point.yMm * weight, w: weight });
  }
  for (let level = 1; level <= degree; level += 1) {
    for (let index = degree; index >= level; index -= 1) {
      const knotIndex = span - degree + index;
      const denominator = (knots[knotIndex + degree - level + 1] as number) -
        (knots[knotIndex] as number);
      const alpha = Math.abs(denominator) <= 1e-15
        ? 0
        : (parameter - (knots[knotIndex] as number)) / denominator;
      const previous = working[index - 1] as HomogeneousPoint;
      const current = working[index] as HomogeneousPoint;
      working[index] = {
        x: previous.x * (1 - alpha) + current.x * alpha,
        y: previous.y * (1 - alpha) + current.y * alpha,
        w: previous.w * (1 - alpha) + current.w * alpha,
      };
    }
  }
  const result = working[degree] as HomogeneousPoint;
  if (!Number.isFinite(result.w) || Math.abs(result.w) <= 1e-15) {
    throw new RangeError("SPLINE evaluates to an invalid rational weight.");
  }
  return { xMm: result.x / result.w, yMm: result.y / result.w };
}

function pointToSegmentDistance(point: PointMm, start: PointMm, end: PointMm): number {
  const dx = end.xMm - start.xMm;
  const dy = end.yMm - start.yMm;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 1e-24) return Math.hypot(point.xMm - start.xMm, point.yMm - start.yMm);
  const ratio = Math.max(0, Math.min(1,
    ((point.xMm - start.xMm) * dx + (point.yMm - start.yMm) * dy) / lengthSquared,
  ));
  return Math.hypot(
    point.xMm - (start.xMm + dx * ratio),
    point.yMm - (start.yMm + dy * ratio),
  );
}

function parseSpline(
  entity: DxfEntity,
  scaleToMm: number,
  toleranceMm: number,
  pointBudget: DxfGeometryPointBudget,
): InterchangePath {
  const degree = requiredNumber(entity, 71);
  if (!Number.isInteger(degree) || degree < 1 || degree > 5) {
    throw new RangeError("SPLINE degree must be an integer from 1 through 5.");
  }
  const xValues = numberValues(entity, 10);
  const yValues = numberValues(entity, 20);
  if (xValues.length !== yValues.length || xValues.length <= degree) {
    throw new RangeError("SPLINE control-point coordinates are incomplete.");
  }
  const declaredControlCount = numberValue(entity, 73);
  if (declaredControlCount !== undefined && declaredControlCount !== xValues.length) {
    throw new RangeError("SPLINE control-point count does not match its coordinates.");
  }
  const controlPoints = xValues.map((x, index) => ({
    xMm: x * scaleToMm,
    yMm: (yValues[index] as number) * scaleToMm,
  }));
  const knots = numberValues(entity, 40);
  const expectedKnotCount = controlPoints.length + degree + 1;
  if (knots.length !== expectedKnotCount) {
    throw new RangeError(`SPLINE requires ${String(expectedKnotCount)} knots for this degree and control-point count.`);
  }
  for (let index = 1; index < knots.length; index += 1) {
    if ((knots[index] as number) < (knots[index - 1] as number)) {
      throw new RangeError("SPLINE knots must be nondecreasing.");
    }
  }
  const rawWeights = numberValues(entity, 41);
  if (rawWeights.length !== 0 && rawWeights.length !== controlPoints.length) {
    throw new RangeError("SPLINE weights must be omitted or match the control-point count.");
  }
  const weights = rawWeights.length === 0
    ? controlPoints.map(() => 1)
    : rawWeights;
  if (weights.some((weight) => !Number.isFinite(weight) || weight <= 0)) {
    throw new RangeError("SPLINE weights must be positive and finite.");
  }
  const startParameter = knots[degree] as number;
  const endParameter = knots[controlPoints.length] as number;
  if (!(endParameter > startParameter)) {
    throw new RangeError("SPLINE has an empty parameter range.");
  }
  const evaluate = (parameter: number) => evaluateRationalBSpline(
    controlPoints,
    weights,
    knots,
    degree,
    parameter,
  );
  const start = evaluate(startParameter);
  const points: PointMm[] = [start];
  const maximumSubdivisionDepth = 18;
  const maximumPreviewPoints = 4_096;
  const appendAdaptive = (
    fromParameter: number,
    from: PointMm,
    toParameter: number,
    to: PointMm,
    depth: number,
  ): void => {
    if (points.length >= maximumPreviewPoints) {
      throw new RangeError("SPLINE requires more than 4,096 preview points at the requested tolerance.");
    }
    const quarterParameter = fromParameter + (toParameter - fromParameter) * 0.25;
    const middleParameter = (fromParameter + toParameter) / 2;
    const threeQuarterParameter = fromParameter + (toParameter - fromParameter) * 0.75;
    const quarter = evaluate(quarterParameter);
    const middle = evaluate(middleParameter);
    const threeQuarter = evaluate(threeQuarterParameter);
    const deviation = Math.max(
      pointToSegmentDistance(quarter, from, to),
      pointToSegmentDistance(middle, from, to),
      pointToSegmentDistance(threeQuarter, from, to),
    );
    if (deviation <= toleranceMm) {
      points.push(to);
      return;
    }
    if (depth >= maximumSubdivisionDepth) {
      throw new RangeError(
        `SPLINE could not satisfy the ${String(toleranceMm)} mm preview tolerance within the subdivision limit.`,
      );
    }
    appendAdaptive(fromParameter, from, middleParameter, middle, depth + 1);
    appendAdaptive(middleParameter, middle, toParameter, to, depth + 1);
  };
  let sampledSpanCount = 0;
  for (let knotIndex = degree; knotIndex < controlPoints.length; knotIndex += 1) {
    const spanStart = knots[knotIndex] as number;
    const spanEnd = knots[knotIndex + 1] as number;
    if (!(spanEnd > spanStart)) {
      continue;
    }
    const spanStartPoint = evaluate(spanStart);
    const previousPoint = points.at(-1);
    if (
      previousPoint === undefined ||
      Math.hypot(
        previousPoint.xMm - spanStartPoint.xMm,
        previousPoint.yMm - spanStartPoint.yMm,
      ) > toleranceMm
    ) {
      throw new RangeError(
        "SPLINE has a discontinuous knot span that cannot be represented as one editable path.",
      );
    }
    appendAdaptive(spanStart, spanStartPoint, spanEnd, evaluate(spanEnd), 0);
    sampledSpanCount += 1;
  }
  if (sampledSpanCount === 0) {
    throw new RangeError("SPLINE has no non-empty knot spans to sample.");
  }
  const flags = numberValue(entity, 70) ?? 0;
  const explicitlyClosed = (flags & 1) === 1;
  const periodic = (flags & 2) === 2;
  const closed = explicitlyClosed || periodic;
  const firstPoint = points[0];
  const lastPoint = points.at(-1);
  if (closed && firstPoint !== undefined && lastPoint !== undefined) {
    const endpointGapMm = Math.hypot(
      lastPoint.xMm - firstPoint.xMm,
      lastPoint.yMm - firstPoint.yMm,
    );
    if (endpointGapMm > toleranceMm) {
      throw new RangeError(
        `${periodic ? "Periodic" : "Closed"} SPLINE endpoints are ${String(endpointGapMm)} mm apart; refusing an implicit straight closing segment.`,
      );
    }
    points.pop();
  }
  if (points.length < (closed ? 3 : 2)) {
    throw new RangeError("SPLINE did not produce enough distinct planar points.");
  }
  pointBudget.reserve(points.length);
  return {
    layerName: stringValue(entity, 8, "0"),
    closed,
    points,
  };
}

function repairImportedPaths(
  sourcePaths: readonly InterchangePath[],
  toleranceMm: number,
): { paths: InterchangePath[]; findings: InterchangeFinding[]; indexMap: Map<number, number> } {
  const paths: InterchangePath[] = [];
  const findings: InterchangeFinding[] = [];
  const indexMap = new Map<number, number>();
  const pathKeys = new Map<string, number>();
  const duplicateNodeToleranceMm = Math.min(toleranceMm, 0.000001);
  const coordinateKey = (value: number) => Object.is(value, -0) ? "0" : String(value);
  const leastRotation = (values: readonly string[]): string => {
    const length = values.length;
    if (length === 0) return "";
    let first = 0;
    let second = 1;
    let offset = 0;
    while (first < length && second < length && offset < length) {
      const firstValue = values[(first + offset) % length] as string;
      const secondValue = values[(second + offset) % length] as string;
      if (firstValue === secondValue) {
        offset += 1;
        continue;
      }
      if (firstValue > secondValue) {
        first += offset + 1;
        if (first <= second) first = second + 1;
      } else {
        second += offset + 1;
        if (second <= first) second = first + 1;
      }
      offset = 0;
    }
    const start = Math.min(first, second);
    return Array.from(
      { length },
      (_unused, index) => values[(start + index) % length] as string,
    ).join(";");
  };
  const exactPathKey = (
    sourcePath: InterchangePath,
    points: readonly PointMm[],
    closed: boolean,
  ): string | null => {
    if (sourcePath.handles !== undefined) return null;
    const forward = points.map((point) =>
      `${coordinateKey(point.xMm)},${coordinateKey(point.yMm)}`,
    );
    const reverse = [...forward].reverse();
    const geometry = closed
      ? [leastRotation(forward), leastRotation(reverse)].sort()[0] as string
      : [forward.join(";"), reverse.join(";")].sort()[0] as string;
    return `${JSON.stringify(sourcePath.layerName)}:${closed ? "c" : "o"}:${geometry}`;
  };
  for (let sourceIndex = 0; sourceIndex < sourcePaths.length; sourceIndex += 1) {
    const sourcePath = sourcePaths[sourceIndex] as InterchangePath;
    const cleaned: PointMm[] = [];
    let removedNodes = 0;
    for (const point of sourcePath.points) {
      const previous = cleaned.at(-1);
      if (previous !== undefined && Math.hypot(
        point.xMm - previous.xMm,
        point.yMm - previous.yMm,
      ) <= duplicateNodeToleranceMm) {
        removedNodes += 1;
      } else {
        cleaned.push({ ...point });
      }
    }
    let closed = sourcePath.closed;
    const firstCleaned = cleaned[0];
    const lastCleaned = cleaned.at(-1);
    if (
      closed &&
      firstCleaned !== undefined &&
      lastCleaned !== undefined &&
      cleaned.length > 1 &&
      Math.hypot(
        firstCleaned.xMm - lastCleaned.xMm,
        firstCleaned.yMm - lastCleaned.yMm,
      ) <= duplicateNodeToleranceMm
    ) {
      cleaned.pop();
      removedNodes += 1;
    }
    const closureFirst = cleaned[0];
    const closureLast = cleaned.at(-1);
    const canClose =
      !closed &&
      closureFirst !== undefined &&
      closureLast !== undefined &&
      cleaned.length >= 3 &&
      Math.hypot(
        closureFirst.xMm - closureLast.xMm,
        closureFirst.yMm - closureLast.yMm,
      ) <= toleranceMm;
    if (canClose) {
      cleaned.pop();
      closed = true;
    }
    if (cleaned.length < (closed ? 3 : 2)) continue;
    const findingLocation = cleaned[0];
    if (findingLocation === undefined) continue;
    const key = exactPathKey(sourcePath, cleaned, closed);
    const duplicatePathIndex = key === null ? undefined : pathKeys.get(key);
    if (duplicatePathIndex !== undefined) {
      indexMap.set(sourceIndex, duplicatePathIndex);
      findings.push({
        code: "duplicate-path-removed",
        severity: "repair",
        message: `Path ${String(sourceIndex + 1)} exactly duplicated earlier same-layer geometry and was removed from the preview.`,
        source: `Path ${String(sourceIndex + 1)}`,
        pathIndex: duplicatePathIndex,
        locationMm: { ...findingLocation },
        repair: {
          action: "remove-duplicate-path",
          summary: "Removed one exact canonical duplicate path.",
          changeCount: 1,
          toleranceMm: 0,
          appliedToPreview: true,
        },
      });
      continue;
    }
    const pathIndex = paths.length;
    if (key !== null) pathKeys.set(key, pathIndex);
    indexMap.set(sourceIndex, pathIndex);
    paths.push({ ...sourcePath, closed, points: cleaned });
    if (removedNodes > 0) {
      findings.push({
        code: "duplicate-nodes-removed",
        severity: "repair",
        message: `Removed ${String(removedNodes)} zero-length or duplicate node(s) from this path.`,
        source: `Path ${String(sourceIndex + 1)}`,
        pathIndex,
        locationMm: { ...findingLocation },
        repair: {
          action: "remove-duplicate-nodes",
          summary: `Removed ${String(removedNodes)} duplicate node(s).`,
          changeCount: removedNodes,
          toleranceMm: duplicateNodeToleranceMm,
          appliedToPreview: true,
        },
      });
    }
    if (canClose) {
      findings.push({
        code: "small-gap-closed",
        severity: "repair",
        message: `Closed an endpoint gap no larger than ${String(toleranceMm)} mm.`,
        source: `Path ${String(sourceIndex + 1)}`,
        pathIndex,
        locationMm: { ...findingLocation },
        repair: {
          action: "close-small-gap",
          summary: "Closed one nearly closed contour.",
          changeCount: 1,
          toleranceMm,
          appliedToPreview: true,
        },
      });
    }
  }
  return { paths, findings, indexMap };
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
  const repairToleranceMm = options.repairToleranceMm ?? DEFAULT_REPAIR_TOLERANCE_MM;
  if (!Number.isFinite(repairToleranceMm) || repairToleranceMm <= 0 || repairToleranceMm > 1) {
    throw new RangeError("DXF repair tolerance must be positive, finite, and no greater than 1 mm.");
  }
  const pairs = parsePairs(source);
  const units = unitsFromPairs(pairs, options.unitlessUnit);
  const entities = entitySections(pairs);
  const paths: InterchangePath[] = [];
  const warnings: InterchangeWarning[] = [];
  const findings: InterchangeFinding[] = [];
  const pointBudget = new DxfGeometryPointBudget();
  for (let index = 0; index < entities.length; index += 1) {
    const entity = entities[index] as DxfEntity;
    const sourceLabel = `${entity.type} ${String(index + 1)}`;
    if (entity.type === "VERTEX" || entity.type === "SEQEND") {
      continue;
    }
    try {
      if (hasUnsupportedElevation(entity)) {
        warnings.push(warning("unsupported-3d-entity", `${sourceLabel} has non-zero Z/elevation and was skipped. Project it to the XY plane at Z=0 in CAD, then reimport.`, sourceLabel));
        continue;
      }
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
        case "SPLINE": {
          const pathIndex = paths.length;
          const path = parseSpline(
            entity,
            units.scaleToMm,
            toleranceMm,
            pointBudget,
          );
          paths.push(path);
          const splineLocation = path.points[0];
          if (splineLocation === undefined) {
            throw new RangeError("SPLINE produced no preview location.");
          }
          findings.push({
            code: "dxf-spline-converted",
            severity: "warning",
            message: `${sourceLabel} was converted to an editable path within ${String(toleranceMm)} mm preview tolerance.`,
            source: sourceLabel,
            pathIndex,
            locationMm: { ...splineLocation },
            repair: null,
          });
          break;
        }
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
            warnings.push(warning("unsupported-3d-polyline", `${sourceLabel} is a 3D/polyface mesh and was skipped. Convert it to 2D LINE or LWPOLYLINE geometry at Z=0 in CAD, then reimport.`, sourceLabel));
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
              warnings.push(warning("unsupported-3d-polyline", `${sourceLabel} has non-zero vertex Z and was skipped. Project all vertices to Z=0 in CAD, then reimport.`, sourceLabel));
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
          warnings.push(warning("unsupported-dxf-entity", `${sourceLabel} is not supported and was skipped. Convert it to LINE, LWPOLYLINE, ARC, CIRCLE, or SPLINE geometry in CAD, then reimport.`, sourceLabel));
      }
    } catch (error) {
      if (error instanceof DxfGeometryPointLimitError) {
        throw error;
      }
      warnings.push(
        warning(
          "invalid-dxf-entity",
          `${sourceLabel} was skipped: ${error instanceof Error ? error.message : String(error)} Repair or flatten it to supported 2D geometry in CAD, then reimport.`,
          sourceLabel,
        ),
      );
    }
  }
  const repaired = repairImportedPaths(paths, repairToleranceMm);
  const mappedFindings = findings.map((finding) => ({
    ...finding,
    pathIndex: finding.pathIndex === null
      ? null
      : (repaired.indexMap.get(finding.pathIndex) ?? null),
  }));
  const repairsApplied = repaired.findings.length > 0;
  return {
    format: "dxf",
    sourceUnit: units.sourceUnit,
    dimensionsMm: null,
    paths: repaired.paths,
    warnings,
    findings: [
      ...mappedFindings,
      ...repaired.findings,
    ],
    assumptions: [
      ...units.assumptions,
      ...(repairsApplied
        ? [`Endpoint closure uses a fixed ${String(repairToleranceMm)} mm tolerance; duplicate-path identity uses exact canonical coordinates and layer identity. Repairs are committed only with explicit import acceptance.`]
        : []),
    ],
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
