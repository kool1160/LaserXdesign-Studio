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
function fingerprintScene(scene: Omit<PhysicalPreviewScene, "fingerprint">): string {
  const canonical = JSON.stringify(scene);
  return [
    hashChunk(canonical, 2_166_136_261),
    hashChunk(canonical, 2_166_136_261 ^ 0x9e3779b9),
    hashChunk(canonical, 2_166_136_261 ^ 0x85ebca6b),
    hashChunk(canonical, 2_166_136_261 ^ 0xc2b2ae35),
  ]
    .map((chunk) => chunk.toString(16).padStart(8, "0"))
    .join("");
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
  const metadata = layer.manufacturing;
  if (metadata === undefined || metadata.role === "non-cut-preview") {
    throw new RangeError(
      `Layer ${options.layerId} is not an explicitly declared physical manufacturing layer.`,
    );
  }

  const scoped = layerScopedDocument(project.document, layer.id);
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
    role: metadata.role,
    thicknessMm: metadata.thicknessMm,
    material: {
      material: metadata.material,
      stockThicknessDesignation: metadata.stockThicknessDesignation ?? null,
      displayLabel: formatStockThickness(
        metadata.thicknessMm,
        metadata.stockThicknessDesignation ?? null,
      ),
    },
    shapes,
    boundsMm: shapesBounds(shapes),
  };

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
    fingerprint: fingerprintScene(sceneWithoutFingerprint),
  };
}
