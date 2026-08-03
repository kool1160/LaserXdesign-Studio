import {
  analyzeDocumentCutability,
  type CutabilityIssueCode,
  type CutabilityRegion,
} from "@laserx/cutability";
import {
  copyDocument,
  formatStockThickness,
  type LaserxDocument,
  type LaserxProject,
  type Layer,
  type ManufacturingLayerMetadata,
  type ManufacturingLayerRole,
  type ManufacturingMaterial,
  type StockThicknessDesignation,
} from "@laserx/domain";
import { boundsFromPoints, type BoundsMm, type PointMm } from "@laserx/geometry";

export type PhysicalPreviewFindingCode = Extract<
  CutabilityIssueCode,
  | "OPEN_CONTOUR"
  | "SELF_INTERSECTION"
  | "DUPLICATE_SEGMENT"
  | "OVERLAPPING_SEGMENT"
  | "UNSUPPORTED_GEOMETRY"
>;

const TOPOLOGY_FINDING_CODES: readonly PhysicalPreviewFindingCode[] = [
  "OPEN_CONTOUR",
  "SELF_INTERSECTION",
  "DUPLICATE_SEGMENT",
  "OVERLAPPING_SEGMENT",
  "UNSUPPORTED_GEOMETRY",
];

function isTopologyFindingCode(
  code: CutabilityIssueCode,
): code is PhysicalPreviewFindingCode {
  return (TOPOLOGY_FINDING_CODES as readonly CutabilityIssueCode[]).includes(code);
}

export interface PhysicalPreviewFinding {
  code: PhysicalPreviewFindingCode;
  layerId: string;
  objectIds: string[];
  message: string;
}

export interface PhysicalPreviewContourMm {
  points: PointMm[];
}

export interface PhysicalPreviewShape {
  id: string;
  outerContour: PhysicalPreviewContourMm;
  holeContours: PhysicalPreviewContourMm[];
  sourceObjectIds: string[];
}

export interface PhysicalPreviewMaterial {
  material: ManufacturingMaterial;
  stockThicknessDesignation: StockThicknessDesignation | null;
  displayLabel: string;
}

export interface PhysicalPreviewLayer {
  layerId: string;
  name: string;
  role: Exclude<ManufacturingLayerRole, "non-cut-preview">;
  thicknessMm: number;
  material: PhysicalPreviewMaterial;
  shapes: PhysicalPreviewShape[];
  boundsMm: BoundsMm | null;
}

export interface PhysicalPreviewIdentity {
  projectId: string;
  documentId: string;
  projectUpdatedAt: string;
}

export interface PhysicalPreviewScene {
  identity: PhysicalPreviewIdentity;
  stockMm: { widthMm: number; heightMm: number };
  layers: PhysicalPreviewLayer[];
  findings: PhysicalPreviewFinding[];
  fingerprint: string;
}

export interface BuildPhysicalPreviewSceneOptions {
  layerId: string;
}

function clonePoint(point: PointMm): PointMm {
  return { xMm: point.xMm, yMm: point.yMm };
}

/**
 * Detaches the returned material metadata from the authoritative project:
 * `StockThicknessDesignation` is a plain object, so returning it directly
 * would let scene consumers mutate the source `LaserxProject` without an
 * application command, dirty-state transition, or Undo/Redo record.
 */
function cloneStockThicknessDesignation(
  designation: StockThicknessDesignation | null | undefined,
): StockThicknessDesignation | null {
  return designation === null || designation === undefined
    ? null
    : { ...designation };
}

/**
 * The exact non-physical-layer exclusion predicate replicated from
 * `@laserx/production-export`'s `buildProductionPackage`/
 * `buildProductionAssemblyPreview` (see ENGINE_DECISION.md) — a physical
 * manufacturing layer is one explicitly tagged and not `non-cut-preview`.
 */
export function isPhysicalManufacturingLayer(
  layer: Layer,
): layer is Layer & { manufacturing: ManufacturingLayerMetadata } {
  return layer.manufacturing !== undefined && layer.manufacturing.role !== "non-cut-preview";
}

function layerScopedDocument(
  document: LaserxDocument,
  layerId: string,
): LaserxDocument {
  const layer = document.layers.find((candidate) => candidate.id === layerId);
  if (layer === undefined) {
    throw new RangeError(
      `Physical preview layer ${layerId} does not exist in the project document.`,
    );
  }
  const scoped = copyDocument(document);
  scoped.layers = [{ ...layer, visible: true }];
  scoped.activeLayerId = layer.id;
  scoped.objects = scoped.objects.filter(
    (object) => object.layerId === layer.id,
  );
  return scoped;
}

/**
 * Reinterprets cutability's region topology with extrusion polarity rather
 * than its own "retained/removed" cutting convention: see the
 * "Resolved contour-polarity question" section of ENGINE_DECISION.md. Even
 * depth is solid (outer boundary or nested island); each solid region's
 * direct children are always the next depth up and become its holes.
 */
function buildShapes(regions: readonly CutabilityRegion[]): PhysicalPreviewShape[] {
  const childrenByParent = new Map<string, CutabilityRegion[]>();
  for (const region of regions) {
    if (region.parentRegionId === null) continue;
    const siblings = childrenByParent.get(region.parentRegionId) ?? [];
    siblings.push(region);
    childrenByParent.set(region.parentRegionId, siblings);
  }
  return regions
    .filter((region) => region.depth % 2 === 0)
    .map((region) => {
      const holes = childrenByParent.get(region.id) ?? [];
      return {
        id: region.id,
        outerContour: { points: region.points.map(clonePoint) },
        holeContours: holes.map((hole) => ({
          points: hole.points.map(clonePoint),
        })),
        sourceObjectIds: [
          ...new Set([region.objectId, ...holes.map((hole) => hole.objectId)]),
        ],
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function shapesBounds(shapes: readonly PhysicalPreviewShape[]): BoundsMm | null {
  const points = shapes.flatMap((shape) => shape.outerContour.points);
  return points.length === 0 ? null : boundsFromPoints(points);
}

function hashChunk(value: string, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }
  return hash;
}

/**
 * Dependency-free deterministic fingerprint (same FNV-1a technique as
 * `@laserx/domain`'s `deriveStableId`) rather than `node:crypto`: this
 * package is bundled into a plain Vite/React browser app, not Electron's
 * Node-enabled main process, so a Node-only hash primitive would break
 * browser bundling.
 */
function computeFingerprint(value: unknown): string {
  const canonical = JSON.stringify(value);
  return [
    hashChunk(canonical, 2_166_136_261),
    hashChunk(canonical, 2_166_136_261 ^ 0x9e3779b9),
    hashChunk(canonical, 2_166_136_261 ^ 0x85ebca6b),
    hashChunk(canonical, 2_166_136_261 ^ 0xc2b2ae35),
  ]
    .map((chunk) => chunk.toString(16).padStart(8, "0"))
    .join("");
}

interface LayerProjection {
  previewLayer: PhysicalPreviewLayer;
  findings: PhysicalPreviewFinding[];
}

/**
 * The single source of per-layer contour/topology projection, shared by
 * `buildPhysicalPreviewScene` (one layer) and `buildPhysicalPreviewAssembly`
 * (all physical layers) so neither duplicates cutability's region logic.
 */
function buildLayerProjection(
  document: LaserxDocument,
  layer: Layer & { manufacturing: ManufacturingLayerMetadata },
): LayerProjection {
  const metadata = layer.manufacturing;
  const scoped = layerScopedDocument(document, layer.id);
  const analysis = analyzeDocumentCutability(scoped);

  const findings: PhysicalPreviewFinding[] = analysis.issues
    .filter((issue) => isTopologyFindingCode(issue.code))
    .map((issue) => ({
      code: issue.code as PhysicalPreviewFindingCode,
      layerId: layer.id,
      objectIds: [...issue.objectIds],
      message: issue.message,
    }));

  const shapes = analysis.status === "complete" ? buildShapes(analysis.regions) : [];

  const previewLayer: PhysicalPreviewLayer = {
    layerId: layer.id,
    name: layer.name,
    role: metadata.role as Exclude<ManufacturingLayerRole, "non-cut-preview">,
    thicknessMm: metadata.thicknessMm,
    material: {
      material: metadata.material,
      stockThicknessDesignation: cloneStockThicknessDesignation(
        metadata.stockThicknessDesignation,
      ),
      displayLabel: formatStockThickness(
        metadata.thicknessMm,
        metadata.stockThicknessDesignation ?? null,
      ),
    },
    shapes,
    boundsMm: shapesBounds(shapes),
  };

  return { previewLayer, findings };
}

export function buildPhysicalPreviewScene(
  project: LaserxProject,
  options: BuildPhysicalPreviewSceneOptions,
): PhysicalPreviewScene {
  const layer = project.document.layers.find(
    (candidate) => candidate.id === options.layerId,
  );
  if (layer === undefined) {
    throw new RangeError(
      `Physical preview layer ${options.layerId} does not exist in the project document.`,
    );
  }
  if (!isPhysicalManufacturingLayer(layer)) {
    throw new RangeError(
      `Layer ${options.layerId} is not an explicitly declared physical manufacturing layer.`,
    );
  }

  const { previewLayer, findings } = buildLayerProjection(project.document, layer);

  const sceneWithoutFingerprint: Omit<PhysicalPreviewScene, "fingerprint"> = {
    identity: {
      projectId: project.project.id,
      documentId: project.document.id,
      projectUpdatedAt: project.project.updatedAt,
    },
    stockMm: { ...project.document.dimensions },
    layers: [previewLayer],
    findings,
  };

  return {
    ...sceneWithoutFingerprint,
    fingerprint: computeFingerprint(sceneWithoutFingerprint),
  };
}

// --- Multi-layer assembly (Phase 2 slice 2) -------------------------------

/**
 * Ephemeral presentation spacing only — never persisted, never schema
 * fields, and distinct from the exact material `thicknessMm` carried by
 * each `PhysicalPreviewAssemblyLayer`. `assembledGapMm` is the (typically
 * zero, bonded-flush) gap between adjacent physical layers in the finished
 * stack; `explodedGapMm` is additional separation added only in the
 * exploded presentation, on top of `assembledGapMm`.
 */
export interface PhysicalPreviewSpacingOptionsMm {
  assembledGapMm: number;
  explodedGapMm: number;
}

export const DEFAULT_ASSEMBLED_GAP_MM = 0;
export const DEFAULT_EXPLODED_GAP_MM = 20;

export interface PhysicalPreviewZRangeMm {
  minZmm: number;
  maxZmm: number;
}

export interface PhysicalPreviewAssemblyLayer extends PhysicalPreviewLayer {
  /** 0-based position among physical layers, in authoritative document order. */
  order: number;
  assembledZRangeMm: PhysicalPreviewZRangeMm;
  explodedZRangeMm: PhysicalPreviewZRangeMm;
}

/**
 * `"complete"` — every physical layer produced shapes (or was legitimately
 * empty with no findings). `"partial"` — at least one physical layer exists
 * but at least one produced no shapes because its geometry was ambiguous
 * (see its findings); still positioned and readable (name/material/
 * thickness), just not rendered. `"unavailable"` — the document declares no
 * physical manufacturing layers at all, so there is nothing to assemble.
 * Never invented or repaired: an ambiguous layer's geometry is never
 * silently closed, simplified, or guessed.
 */
export type PhysicalPreviewAssemblyStatus = "complete" | "partial" | "unavailable";

export interface PhysicalPreviewAssembly {
  identity: PhysicalPreviewIdentity;
  stockMm: { widthMm: number; heightMm: number };
  status: PhysicalPreviewAssemblyStatus;
  spacing: PhysicalPreviewSpacingOptionsMm;
  layers: PhysicalPreviewAssemblyLayer[];
  /** Sum of every physical layer's exact `thicknessMm` plus `assembledGapMm` between them. Real depth, not presentation. */
  assembledDepthMm: number;
  findings: PhysicalPreviewFinding[];
  fingerprint: string;
}

export interface BuildPhysicalPreviewAssemblyOptions {
  spacing?: Partial<PhysicalPreviewSpacingOptionsMm>;
}

function resolveSpacing(
  spacing: Partial<PhysicalPreviewSpacingOptionsMm> | undefined,
): PhysicalPreviewSpacingOptionsMm {
  const assembledGapMm = spacing?.assembledGapMm ?? DEFAULT_ASSEMBLED_GAP_MM;
  const explodedGapMm = spacing?.explodedGapMm ?? DEFAULT_EXPLODED_GAP_MM;
  if (!Number.isFinite(assembledGapMm) || assembledGapMm < 0) {
    throw new RangeError("Assembled spacing must be a nonnegative finite number of millimeters.");
  }
  if (!Number.isFinite(explodedGapMm) || explodedGapMm < 0) {
    throw new RangeError("Exploded spacing must be a nonnegative finite number of millimeters.");
  }
  return { assembledGapMm, explodedGapMm };
}

/**
 * Builds a renderer-independent assembly from every explicit physical
 * manufacturing layer, in authoritative `document.layers` order. Untagged
 * and `non-cut-preview` layers are excluded mechanically before any other
 * processing (`isPhysicalManufacturingLayer`).
 *
 * Z convention (deterministic, documented — no existing contract mandates a
 * direction, so this is the one this package defines): the first physical
 * layer in document order is placed front-most, at the top of the Z range
 * (`maxZmm` of the whole stack); each subsequent layer stacks behind it
 * toward `Z = 0`, which is the back face of the last physical layer. This
 * keeps the degenerate single-physical-layer case identical to
 * `buildPhysicalPreviewScene`'s implicit `[0, thicknessMm]` extrusion range.
 */
export function buildPhysicalPreviewAssembly(
  project: LaserxProject,
  options: BuildPhysicalPreviewAssemblyOptions = {},
): PhysicalPreviewAssembly {
  const spacing = resolveSpacing(options.spacing);
  const physicalLayers = project.document.layers.filter(isPhysicalManufacturingLayer);
  const projections = physicalLayers.map((layer) =>
    buildLayerProjection(project.document, layer),
  );

  const totalThicknessMm = projections.reduce(
    (sum, projection) => sum + projection.previewLayer.thicknessMm,
    0,
  );
  const assembledDepthMm =
    physicalLayers.length === 0
      ? 0
      : totalThicknessMm + spacing.assembledGapMm * (physicalLayers.length - 1);
  const explodedTotalDepthMm =
    physicalLayers.length === 0
      ? 0
      : totalThicknessMm +
        (spacing.assembledGapMm + spacing.explodedGapMm) * (physicalLayers.length - 1);

  let assembledFrontZmm = assembledDepthMm;
  let explodedFrontZmm = explodedTotalDepthMm;
  const layers: PhysicalPreviewAssemblyLayer[] = projections.map((projection, index) => {
    const { previewLayer } = projection;

    const assembledBackZmm = assembledFrontZmm - previewLayer.thicknessMm;
    const assembledZRangeMm: PhysicalPreviewZRangeMm = {
      minZmm: assembledBackZmm,
      maxZmm: assembledFrontZmm,
    };
    assembledFrontZmm = assembledBackZmm - spacing.assembledGapMm;

    const explodedBackZmm = explodedFrontZmm - previewLayer.thicknessMm;
    const explodedZRangeMm: PhysicalPreviewZRangeMm = {
      minZmm: explodedBackZmm,
      maxZmm: explodedFrontZmm,
    };
    explodedFrontZmm = explodedBackZmm - (spacing.assembledGapMm + spacing.explodedGapMm);

    return { ...previewLayer, order: index, assembledZRangeMm, explodedZRangeMm };
  });

  const findings = projections.flatMap((projection) => projection.findings);
  const hasAmbiguousLayer = projections.some((projection) => projection.findings.length > 0);
  const status: PhysicalPreviewAssemblyStatus =
    physicalLayers.length === 0 ? "unavailable" : hasAmbiguousLayer ? "partial" : "complete";

  const assemblyWithoutFingerprint: Omit<PhysicalPreviewAssembly, "fingerprint"> = {
    identity: {
      projectId: project.project.id,
      documentId: project.document.id,
      projectUpdatedAt: project.project.updatedAt,
    },
    stockMm: { ...project.document.dimensions },
    status,
    spacing,
    layers,
    assembledDepthMm,
    findings,
  };

  return {
    ...assemblyWithoutFingerprint,
    fingerprint: computeFingerprint(assemblyWithoutFingerprint),
  };
}
