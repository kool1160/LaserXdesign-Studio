import type {
  InterchangePath,
  InterchangeWarning,
  RasterSourceMetadata,
  RasterTraceCandidate,
  RasterTraceSettings,
} from "@laserx/domain";
import {
  boundsFromPoints,
  distancePointToSegment,
  simplifyEditablePath,
  unionBounds,
  type BoundsMm,
  type PointMm,
} from "@laserx/geometry";

import {
  GRID_TRACE_ENGINE_ID,
  GRID_TRACE_ENGINE_VERSION,
  MAX_RASTER_TRACE_EDGES,
  MAX_RASTER_TRACE_POINTS,
} from "./limits.js";
import {
  createRasterPreviewPixels,
  preprocessRaster,
  type DecodedRaster,
  type RasterPreviewPixels,
} from "./preprocess.js";
import { validateRasterTraceSettings } from "./settings.js";

export interface RasterTraceProgress {
  operationId: string;
  percent: number;
  stage: "preprocessing" | "filtering" | "tracing" | "simplifying" | "preview";
}

export interface RasterTraceTaskRequest {
  operationId: string;
  source: RasterSourceMetadata;
  image: DecodedRaster;
  settings: RasterTraceSettings;
}

export interface RasterTraceTaskResult {
  operationId: string;
  candidate: RasterTraceCandidate;
  preview: RasterPreviewPixels;
}

export interface RasterTraceEngineInput {
  operationId: string;
  source: RasterSourceMetadata;
  image: DecodedRaster;
  settings: RasterTraceSettings;
}

export interface RasterTraceEngine {
  readonly id: string;
  readonly version: string;
  trace(
    input: RasterTraceEngineInput,
    onProgress?: (progress: RasterTraceProgress) => void,
  ): RasterTraceTaskResult;
}

interface SpeckleResult {
  removedCount: number;
  removedAreaPx: number;
}

interface PixelPoint {
  x: number;
  y: number;
}

function emitProgress(
  operationId: string,
  percent: number,
  stage: RasterTraceProgress["stage"],
  listener?: (progress: RasterTraceProgress) => void,
): void {
  listener?.({ operationId, percent, stage });
}

function filterSpeckles(
  mask: Uint8Array,
  width: number,
  height: number,
  minimumAreaPx: number,
): SpeckleResult {
  if (minimumAreaPx <= 1) {
    return { removedCount: 0, removedAreaPx: 0 };
  }
  const visited = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  let removedCount = 0;
  let removedAreaPx = 0;
  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] !== 1 || visited[start] === 1) {
      continue;
    }
    let head = 0;
    let tail = 1;
    queue[0] = start;
    visited[start] = 1;
    while (head < tail) {
      const index = queue[head] as number;
      head += 1;
      const x = index % width;
      const y = Math.floor(index / width);
      const neighbors = [
        x > 0 ? index - 1 : -1,
        x + 1 < width ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y + 1 < height ? index + width : -1,
      ];
      for (const neighbor of neighbors) {
        if (neighbor >= 0 && mask[neighbor] === 1 && visited[neighbor] === 0) {
          visited[neighbor] = 1;
          queue[tail] = neighbor;
          tail += 1;
        }
      }
    }
    if (tail < minimumAreaPx) {
      removedCount += 1;
      removedAreaPx += tail;
      for (let index = 0; index < tail; index += 1) {
        mask[queue[index] as number] = 0;
      }
    }
  }
  return { removedCount, removedAreaPx };
}

function boundaryEdgeCount(mask: Uint8Array, width: number, height: number): number {
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (mask[index] !== 1) {
        continue;
      }
      if (y === 0 || mask[index - width] !== 1) count += 1;
      if (x === width - 1 || mask[index + 1] !== 1) count += 1;
      if (y === height - 1 || mask[index + width] !== 1) count += 1;
      if (x === 0 || mask[index - 1] !== 1) count += 1;
    }
  }
  return count;
}

function vertexId(x: number, y: number, stride: number): number {
  return y * stride + x;
}

function pixelPoint(id: number, stride: number): PixelPoint {
  return { x: id % stride, y: Math.floor(id / stride) };
}

function removeCollinearPixelPoints(points: readonly PixelPoint[]): PixelPoint[] {
  if (points.length <= 3) {
    return points.map((point) => ({ ...point }));
  }
  return points.filter((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length] as PixelPoint;
    const next = points[(index + 1) % points.length] as PixelPoint;
    return (
      (point.x - previous.x) * (next.y - point.y) -
      (point.y - previous.y) * (next.x - point.x)
    ) !== 0;
  });
}

function traceBoundaries(mask: Uint8Array, width: number, height: number): PixelPoint[][] {
  const edgeCount = boundaryEdgeCount(mask, width, height);
  if (edgeCount === 0) {
    return [];
  }
  if (edgeCount > MAX_RASTER_TRACE_EDGES) {
    throw new RangeError(
      `Raster boundary exceeds the ${String(MAX_RASTER_TRACE_EDGES)} edge trace limit. Increase speckle filtering or reduce detail.`,
    );
  }
  const stride = width + 1;
  const vertexCount = stride * (height + 1);
  const starts = new Int32Array(edgeCount);
  const ends = new Int32Array(edgeCount);
  const directions = new Uint8Array(edgeCount);
  const next = new Int32Array(edgeCount);
  const head = new Int32Array(vertexCount);
  head.fill(-1);
  let edgeIndex = 0;
  const addEdge = (start: number, end: number, direction: number): void => {
    starts[edgeIndex] = start;
    ends[edgeIndex] = end;
    directions[edgeIndex] = direction;
    next[edgeIndex] = head[start] ?? -1;
    head[start] = edgeIndex;
    edgeIndex += 1;
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (mask[index] !== 1) continue;
      if (y === 0 || mask[index - width] !== 1) {
        addEdge(vertexId(x, y, stride), vertexId(x + 1, y, stride), 0);
      }
      if (x === width - 1 || mask[index + 1] !== 1) {
        addEdge(vertexId(x + 1, y, stride), vertexId(x + 1, y + 1, stride), 1);
      }
      if (y === height - 1 || mask[index + width] !== 1) {
        addEdge(vertexId(x + 1, y + 1, stride), vertexId(x, y + 1, stride), 2);
      }
      if (x === 0 || mask[index - 1] !== 1) {
        addEdge(vertexId(x, y + 1, stride), vertexId(x, y, stride), 3);
      }
    }
  }
  const used = new Uint8Array(edgeCount);
  const paths: PixelPoint[][] = [];
  const turnPriority = [1, 0, 3, 2] as const;
  for (let startEdge = 0; startEdge < edgeCount; startEdge += 1) {
    if (used[startEdge] === 1) continue;
    const startVertex = starts[startEdge] as number;
    const path: PixelPoint[] = [pixelPoint(startVertex, stride)];
    let currentEdge = startEdge;
    for (let count = 0; count <= edgeCount; count += 1) {
      used[currentEdge] = 1;
      const endVertex = ends[currentEdge] as number;
      if (endVertex === startVertex) {
        break;
      }
      path.push(pixelPoint(endVertex, stride));
      const currentDirection = directions[currentEdge] as number;
      let selected = -1;
      let selectedPriority = Number.POSITIVE_INFINITY;
      for (let candidate = head[endVertex] as number; candidate >= 0; candidate = next[candidate] as number) {
        if (used[candidate] === 1) continue;
        const turn = ((directions[candidate] as number) - currentDirection + 4) % 4;
        const priority = turnPriority.indexOf(turn as 0 | 1 | 2 | 3);
        if (priority < selectedPriority) {
          selected = candidate;
          selectedPriority = priority;
        }
      }
      if (selected < 0) {
        throw new Error("Raster trace produced an open pixel boundary.");
      }
      currentEdge = selected;
      if (count === edgeCount) {
        throw new RangeError("Raster trace boundary traversal exceeded its edge budget.");
      }
    }
    const compacted = removeCollinearPixelPoints(path);
    if (compacted.length >= 3) {
      paths.push(compacted);
    }
  }
  return paths;
}

function smoothClosedPath(points: readonly PointMm[], passes: number): PointMm[] {
  let current = points.map((point) => ({ ...point }));
  for (let pass = 0; pass < passes; pass += 1) {
    if (current.length * 2 > MAX_RASTER_TRACE_EDGES) {
      break;
    }
    const next: PointMm[] = [];
    for (let index = 0; index < current.length; index += 1) {
      const first = current[index] as PointMm;
      const second = current[(index + 1) % current.length] as PointMm;
      next.push(
        {
          xMm: first.xMm * 0.75 + second.xMm * 0.25,
          yMm: first.yMm * 0.75 + second.yMm * 0.25,
        },
        {
          xMm: first.xMm * 0.25 + second.xMm * 0.75,
          yMm: first.yMm * 0.25 + second.yMm * 0.75,
        },
      );
    }
    current = next;
  }
  return current;
}

export function maximumClosedPathDeviation(
  source: readonly PointMm[],
  simplified: readonly PointMm[],
): number {
  return source.reduce((maximum, point) => {
    let minimum = Number.POSITIVE_INFINITY;
    for (let index = 0; index < simplified.length; index += 1) {
      const start = simplified[index] as PointMm;
      const end = simplified[(index + 1) % simplified.length] as PointMm;
      minimum = Math.min(minimum, distancePointToSegment(point, start, end));
    }
    return Math.max(maximum, minimum);
  }, 0);
}

function simplifyClosedPath(points: readonly PointMm[], toleranceMm: number): PointMm[] {
  const simplified = simplifyEditablePath(
    { closed: true, points: points.map((point) => ({ ...point })) },
    toleranceMm,
  ).points;
  return maximumClosedPathDeviation(points, simplified) <= toleranceMm + 1e-9
    ? simplified
    : points.map((point) => ({ ...point }));
}

function smallestSegmentLength(paths: readonly InterchangePath[]): number | null {
  let smallest = Number.POSITIVE_INFINITY;
  for (const path of paths) {
    for (let index = 0; index < path.points.length; index += 1) {
      const start = path.points[index] as PointMm;
      const end = path.points[(index + 1) % path.points.length] as PointMm;
      smallest = Math.min(smallest, Math.hypot(end.xMm - start.xMm, end.yMm - start.yMm));
    }
  }
  return Number.isFinite(smallest) ? smallest : null;
}

export class GridRasterTraceEngine implements RasterTraceEngine {
  public readonly id = GRID_TRACE_ENGINE_ID;
  public readonly version = GRID_TRACE_ENGINE_VERSION;

  public trace(
    input: RasterTraceEngineInput,
    onProgress?: (progress: RasterTraceProgress) => void,
  ): RasterTraceTaskResult {
    validateRasterTraceSettings(input.settings);
    emitProgress(input.operationId, 10, "preprocessing", onProgress);
    const raster = preprocessRaster(input.image, input.settings);
    emitProgress(input.operationId, 35, "filtering", onProgress);
    const speckles = filterSpeckles(
      raster.binary,
      raster.widthPx,
      raster.heightPx,
      input.settings.speckleAreaPx,
    );
    emitProgress(input.operationId, 55, "tracing", onProgress);
    const pixelPaths = traceBoundaries(raster.binary, raster.widthPx, raster.heightPx);
    if (pixelPaths.length === 0) {
      throw new RangeError("The current preprocessing settings produced no traceable foreground.");
    }
    const outputHeightMm = input.settings.outputWidthMm * raster.heightPx / raster.widthPx;
    const pixelSizeMm = input.settings.outputWidthMm / raster.widthPx;
    const sourceBoundaryNodeCount = pixelPaths.reduce((count, path) => count + path.length, 0);
    emitProgress(input.operationId, 75, "simplifying", onProgress);
    const paths = pixelPaths.map<InterchangePath>((path) => {
      const millimeterPoints = path.map<PointMm>((point) => ({
        xMm: point.x * pixelSizeMm,
        yMm: (raster.heightPx - point.y) * pixelSizeMm,
      }));
      const smoothed = smoothClosedPath(millimeterPoints, input.settings.smoothingPasses);
      return {
        layerName: "Raster Trace",
        closed: true,
        points: simplifyClosedPath(smoothed, input.settings.simplificationToleranceMm),
      };
    });
    const nodeCount = paths.reduce((count, path) => count + path.points.length, 0);
    if (nodeCount > MAX_RASTER_TRACE_POINTS) {
      throw new RangeError(
        `Trace result exceeds the ${String(MAX_RASTER_TRACE_POINTS)} editable-node limit. Increase simplification or speckle filtering.`,
      );
    }
    const bounds = paths.reduce<BoundsMm | null>((current, path) => {
      const next = boundsFromPoints(path.points);
      return current === null ? next : unionBounds(current, next);
    }, null);
    const warnings: InterchangeWarning[] = [];
    if (raster.downsampled) {
      warnings.push({
        code: "raster-trace-downsampled",
        message: `The validated source was downsampled to ${String(raster.widthPx)} x ${String(raster.heightPx)} pixels for bounded tracing.`,
        source: null,
      });
    }
    if (speckles.removedCount > 0) {
      warnings.push({
        code: "raster-speckles-removed",
        message: `${String(speckles.removedCount)} foreground island(s), totaling ${String(speckles.removedAreaPx)} pixels below the ${String(input.settings.speckleAreaPx)} pixel threshold, were removed from this candidate.`,
        source: null,
      });
    }
    warnings.push({
      code: "trace-requires-cutability-analysis",
      message: "Traced paths are editable candidates and require downstream cutability review; they are not automatically cut-ready.",
      source: null,
    });
    const candidate: RasterTraceCandidate = {
      source: { ...input.source },
      settings: { ...input.settings, crop: { ...input.settings.crop } },
      paths,
      warnings,
      assumptions: [
        `Raster pixels were mapped to ${input.settings.outputWidthMm.toFixed(3)} mm width with square pixels.`,
        `Trace engine ${this.id} ${this.version} used deterministic four-connected foreground contours.`,
      ],
      summary: {
        engineId: this.id,
        engineVersion: this.version,
        sourceWidthPx: input.source.widthPx,
        sourceHeightPx: input.source.heightPx,
        traceWidthPx: raster.widthPx,
        traceHeightPx: raster.heightPx,
        outputWidthMm: input.settings.outputWidthMm,
        outputHeightMm,
        pathCount: paths.length,
        nodeCount,
        sourceBoundaryNodeCount,
        smallestFeatureMm: smallestSegmentLength(paths),
        speckleThresholdPx: input.settings.speckleAreaPx,
        removedSpeckleCount: speckles.removedCount,
        removedSpeckleAreaPx: speckles.removedAreaPx,
        simplificationToleranceMm: input.settings.simplificationToleranceMm,
        bounds,
      },
    };
    emitProgress(input.operationId, 90, "preview", onProgress);
    const preview = createRasterPreviewPixels(raster);
    emitProgress(input.operationId, 100, "preview", onProgress);
    return { operationId: input.operationId, candidate, preview };
  }
}

export function runRasterTraceTask(
  request: RasterTraceTaskRequest,
  onProgress?: (progress: RasterTraceProgress) => void,
  engine: RasterTraceEngine = new GridRasterTraceEngine(),
): RasterTraceTaskResult {
  if (request.operationId.trim().length === 0) {
    throw new RangeError("Raster trace operation ID is required.");
  }
  return engine.trace(request, onProgress);
}
