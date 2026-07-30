import {
  AFFINE_DETERMINANT_TOLERANCE,
  IDENTITY_AFFINE_TRANSFORM,
  applyAffineTransform,
  boundsFromPoints,
  composeAffineTransforms,
  copyAffineTransform,
  unionBounds,
  type AffineTransformMm,
  type BoundsMm,
  type PointMm,
} from "@laserx/geometry";

export type {
  AffineTransformMm,
  BoundsMm,
  PointMm,
} from "@laserx/geometry";

export const PROJECT_SCHEMA_VERSION = 3 as const;
export const MILLIMETERS_PER_INCH = 25.4;
export const DEFAULT_GRID_SPACING_MM = 10;

export type DisplayUnit = "millimeters" | "inches";

export interface DocumentDimensions {
  widthMm: number;
  heightMm: number;
}

export interface DocumentOrigin {
  xMm: 0;
  yMm: 0;
}

export interface SnappingPreferences {
  enabled: boolean;
  snapToGrid: boolean;
  snapToGuides: boolean;
  snapToObjects: boolean;
  snapToDocument: boolean;
}

export interface ViewportPreferences {
  rulersVisible: boolean;
  gridVisible: boolean;
  gridSpacingMm: number;
  snapping: SnappingPreferences;
}

export interface DocumentSettings {
  displayUnit: DisplayUnit;
  viewport: ViewportPreferences;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
}

export interface Guide {
  id: string;
  axis: "x" | "y";
  positionMm: number;
}

export interface DocumentObjectBase {
  id: string;
  type: "line" | "rectangle" | "ellipse" | "path" | "group";
  layerId: string;
  transform: AffineTransformMm;
}

export interface LineObject extends DocumentObjectBase {
  type: "line";
  start: PointMm;
  end: PointMm;
}

export interface RectangleObject extends DocumentObjectBase {
  type: "rectangle";
  origin: PointMm;
  widthMm: number;
  heightMm: number;
}

export interface EllipseObject extends DocumentObjectBase {
  type: "ellipse";
  center: PointMm;
  radiusXmm: number;
  radiusYmm: number;
}

export interface PathObject extends DocumentObjectBase {
  type: "path";
  closed: boolean;
  points: PointMm[];
}

export interface GroupObject extends DocumentObjectBase {
  type: "group";
  children: DocumentObject[];
}

export type DocumentObject =
  | LineObject
  | RectangleObject
  | EllipseObject
  | PathObject
  | GroupObject;

export interface LaserxDocument {
  kind: "document";
  id: string;
  dimensions: DocumentDimensions;
  origin: DocumentOrigin;
  settings: DocumentSettings;
  layers: Layer[];
  activeLayerId: string;
  guides: Guide[];
  objects: DocumentObject[];
}

export interface ProjectMetadata {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface MigrationRecord {
  fromVersion: number;
  toVersion: number;
  migratedAt: string;
}

export interface LaserxProjectV3 {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION;
  project: ProjectMetadata;
  document: LaserxDocument;
  migrationHistory: MigrationRecord[];
}

export type LaserxProject = LaserxProjectV3;

export interface CreateDocumentInput {
  id: string;
  width: number;
  height: number;
  inputUnit: DisplayUnit;
  displayUnit?: DisplayUnit;
  layers?: Layer[];
  activeLayerId?: string;
  guides?: Guide[];
  objects?: DocumentObject[];
}

export interface CreateBlankProjectInput {
  id: string;
  now: string;
  name?: string;
  documentId?: string;
  width?: number;
  height?: number;
  inputUnit?: DisplayUnit;
  displayUnit?: DisplayUnit;
  layers?: Layer[];
  activeLayerId?: string;
  guides?: Guide[];
  objects?: DocumentObject[];
}

export interface UpdateViewportPreferences {
  rulersVisible?: boolean;
  gridVisible?: boolean;
  gridSpacingMm?: number;
  snappingEnabled?: boolean;
  snapToGrid?: boolean;
  snapToGuides?: boolean;
  snapToObjects?: boolean;
  snapToDocument?: boolean;
}

export interface HitTestRequest {
  point: PointMm;
  toleranceMm: number;
  document: LaserxDocument;
}

export interface HitTestResult {
  objectId: string;
  distanceMm: number;
}

export interface HitTestService {
  hitTest(request: HitTestRequest): readonly HitTestResult[];
}

export const DEFAULT_VIEWPORT_PREFERENCES: Readonly<ViewportPreferences> = {
  rulersVisible: true,
  gridVisible: true,
  gridSpacingMm: DEFAULT_GRID_SPACING_MM,
  snapping: {
    enabled: false,
    snapToGrid: true,
    snapToGuides: true,
    snapToObjects: true,
    snapToDocument: true,
  },
};

function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be positive and finite.`);
  }
}

function hashText(value: string, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }
  return hash;
}

export function deriveStableId(sourceId: string, purpose: string): string {
  const source = `${sourceId}:${purpose}`;
  const chunks = [
    hashText(source, 2_166_136_261),
    hashText(source, 2_166_136_261 ^ 0x9e3779b9),
    hashText(source, 2_166_136_261 ^ 0x85ebca6b),
    hashText(source, 2_166_136_261 ^ 0xc2b2ae35),
  ];
  const hex = chunks
    .map((chunk) => chunk.toString(16).padStart(8, "0"))
    .join("")
    .split("");
  hex[12] = "5";
  const variant = Number.parseInt(hex[16] ?? "0", 16);
  hex[16] = ((variant & 0x3) | 0x8).toString(16);
  const joined = hex.join("");
  return `${joined.slice(0, 8)}-${joined.slice(8, 12)}-${joined.slice(12, 16)}-${joined.slice(16, 20)}-${joined.slice(20)}`;
}

export function identityTransform(): AffineTransformMm {
  return copyAffineTransform(IDENTITY_AFFINE_TRANSFORM);
}

export function isInvertibleTransform(
  transform: AffineTransformMm,
): boolean {
  const values = [
    transform.a,
    transform.b,
    transform.c,
    transform.d,
    transform.eMm,
    transform.fMm,
  ];
  return (
    values.every(Number.isFinite) &&
    Math.abs(transform.a * transform.d - transform.b * transform.c) >
      AFFINE_DETERMINANT_TOLERANCE
  );
}

export function toMillimeters(value: number, unit: DisplayUnit): number {
  assertPositiveFinite(value, "Length");
  return unit === "inches" ? (value * 254) / 10 : value;
}

export function fromMillimeters(valueMm: number, unit: DisplayUnit): number {
  if (!Number.isFinite(valueMm)) {
    throw new RangeError("Length must be finite.");
  }
  return unit === "inches" ? (valueMm * 10) / 254 : valueMm;
}

function defaultLayer(documentId: string): Layer {
  return {
    id: deriveStableId(documentId, "default-layer"),
    name: "Layer 1",
    visible: true,
    locked: false,
  };
}

export function createDocument(input: CreateDocumentInput): LaserxDocument {
  const widthMm = toMillimeters(input.width, input.inputUnit);
  const heightMm = toMillimeters(input.height, input.inputUnit);
  const layers =
    input.layers === undefined
      ? [defaultLayer(input.id)]
      : input.layers.map(copyLayer);
  if (layers.length === 0) {
    throw new RangeError("A document must contain at least one layer.");
  }
  const activeLayerId = input.activeLayerId ?? layers[0]?.id;
  if (
    activeLayerId === undefined ||
    !layers.some((layer) => layer.id === activeLayerId)
  ) {
    throw new RangeError("The active layer must exist in the document.");
  }
  return {
    kind: "document",
    id: input.id,
    dimensions: {
      widthMm,
      heightMm,
    },
    origin: {
      xMm: 0,
      yMm: 0,
    },
    settings: {
      displayUnit: input.displayUnit ?? input.inputUnit,
      viewport: copyViewportPreferences(DEFAULT_VIEWPORT_PREFERENCES),
    },
    layers,
    activeLayerId,
    guides: (input.guides ?? []).map(copyGuide),
    objects: (input.objects ?? []).map(copyDocumentObject),
  };
}

export function createBlankProject(
  input: CreateBlankProjectInput,
): LaserxProject {
  const documentId = input.documentId ?? input.id;
  const documentInput: CreateDocumentInput = {
    id: documentId,
    width: input.width ?? 304.8,
    height: input.height ?? 304.8,
    inputUnit: input.inputUnit ?? "millimeters",
    ...(input.displayUnit === undefined
      ? {}
      : { displayUnit: input.displayUnit }),
    ...(input.layers === undefined ? {} : { layers: input.layers }),
    ...(input.activeLayerId === undefined
      ? {}
      : { activeLayerId: input.activeLayerId }),
    ...(input.guides === undefined ? {} : { guides: input.guides }),
    ...(input.objects === undefined ? {} : { objects: input.objects }),
  };
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    project: {
      id: input.id,
      name: input.name ?? "Untitled",
      createdAt: input.now,
      updatedAt: input.now,
    },
    document: createDocument(documentInput),
    migrationHistory: [],
  };
}

export function replaceProjectDocument(
  project: LaserxProject,
  document: LaserxDocument,
  updatedAt: string,
): LaserxProject {
  return {
    ...copyProject(project),
    project: {
      ...project.project,
      updatedAt,
    },
    document: copyDocument(document),
  };
}

export function setProjectDisplayUnit(
  project: LaserxProject,
  displayUnit: DisplayUnit,
  updatedAt: string,
): LaserxProject {
  return {
    ...copyProject(project),
    project: {
      ...project.project,
      updatedAt,
    },
    document: {
      ...copyDocument(project.document),
      settings: {
        ...project.document.settings,
        displayUnit,
      },
    },
  };
}

export function setViewportPreferences(
  project: LaserxProject,
  updates: UpdateViewportPreferences,
  updatedAt: string,
): LaserxProject {
  const spacing =
    updates.gridSpacingMm ?? project.document.settings.viewport.gridSpacingMm;
  assertPositiveFinite(spacing, "Grid spacing");
  const current = project.document.settings.viewport;
  return {
    ...copyProject(project),
    project: {
      ...project.project,
      updatedAt,
    },
    document: {
      ...copyDocument(project.document),
      settings: {
        ...project.document.settings,
        viewport: {
          rulersVisible: updates.rulersVisible ?? current.rulersVisible,
          gridVisible: updates.gridVisible ?? current.gridVisible,
          gridSpacingMm: spacing,
          snapping: {
            enabled: updates.snappingEnabled ?? current.snapping.enabled,
            snapToGrid:
              updates.snapToGrid ?? current.snapping.snapToGrid,
            snapToGuides:
              updates.snapToGuides ?? current.snapping.snapToGuides,
            snapToObjects:
              updates.snapToObjects ?? current.snapping.snapToObjects,
            snapToDocument:
              updates.snapToDocument ?? current.snapping.snapToDocument,
          },
        },
      },
    },
  };
}

export function getStockRegion(document: LaserxDocument): BoundsMm {
  return {
    minXmm: document.origin.xMm,
    minYmm: document.origin.yMm,
    maxXmm: document.origin.xMm + document.dimensions.widthMm,
    maxYmm: document.origin.yMm + document.dimensions.heightMm,
  };
}

function transformedPrimitiveBounds(
  object: Exclude<DocumentObject, GroupObject>,
  transform: AffineTransformMm,
): BoundsMm {
  switch (object.type) {
    case "line":
      return boundsFromPoints([
        applyAffineTransform(object.start, transform),
        applyAffineTransform(object.end, transform),
      ]);
    case "rectangle":
      return boundsFromPoints(
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
        ].map((point) => applyAffineTransform(point, transform)),
      );
    case "ellipse": {
      const center = applyAffineTransform(object.center, transform);
      const extentXmm = Math.hypot(
        transform.a * object.radiusXmm,
        transform.c * object.radiusYmm,
      );
      const extentYmm = Math.hypot(
        transform.b * object.radiusXmm,
        transform.d * object.radiusYmm,
      );
      return {
        minXmm: center.xMm - extentXmm,
        minYmm: center.yMm - extentYmm,
        maxXmm: center.xMm + extentXmm,
        maxYmm: center.yMm + extentYmm,
      };
    }
    case "path":
      return boundsFromPoints(
        object.points.map((point) =>
          applyAffineTransform(point, transform),
        ),
      );
  }
}

export function getObjectBounds(
  object: DocumentObject,
  parentTransform: AffineTransformMm = IDENTITY_AFFINE_TRANSFORM,
): BoundsMm {
  const worldTransform = composeAffineTransforms(
    parentTransform,
    object.transform,
  );
  if (object.type !== "group") {
    return transformedPrimitiveBounds(object, worldTransform);
  }
  const first = object.children[0];
  if (first === undefined) {
    throw new RangeError("Groups must contain at least one child.");
  }
  return object.children
    .slice(1)
    .reduce(
      (bounds, child) =>
        unionBounds(bounds, getObjectBounds(child, worldTransform)),
      getObjectBounds(first, worldTransform),
    );
}

export function getSelectionBounds(
  document: LaserxDocument,
  objectIds: readonly string[],
): BoundsMm | null {
  const selected = document.objects.filter((object) =>
    objectIds.includes(object.id),
  );
  const first = selected[0];
  if (first === undefined) {
    return null;
  }
  return selected
    .slice(1)
    .reduce(
      (bounds, object) => unionBounds(bounds, getObjectBounds(object)),
      getObjectBounds(first),
    );
}

export function getDocumentBounds(document: LaserxDocument): BoundsMm {
  return document.objects.reduce<BoundsMm>(
    (bounds, object) => unionBounds(bounds, getObjectBounds(object)),
    getStockRegion(document),
  );
}

export function findLayer(
  document: LaserxDocument,
  layerId: string,
): Layer | undefined {
  return document.layers.find((layer) => layer.id === layerId);
}

export function isLayerEditable(
  document: LaserxDocument,
  layerId: string,
): boolean {
  const layer = findLayer(document, layerId);
  return layer?.visible === true && !layer.locked;
}

export function getObjectsInRenderOrder(
  document: LaserxDocument,
  includeHidden = false,
): DocumentObject[] {
  return document.layers.flatMap((layer) =>
    includeHidden || layer.visible
      ? document.objects.filter((object) => object.layerId === layer.id)
      : [],
  );
}

export function collectObjectIds(object: DocumentObject): string[] {
  return object.type === "group"
    ? [
        object.id,
        ...object.children.flatMap((child) => collectObjectIds(child)),
      ]
    : [object.id];
}

export function copyLayer(layer: Layer): Layer {
  return { ...layer };
}

export function copyGuide(guide: Guide): Guide {
  return { ...guide };
}

export function copyViewportPreferences(
  preferences: ViewportPreferences,
): ViewportPreferences {
  return {
    ...preferences,
    snapping: { ...preferences.snapping },
  };
}

export function copyDocumentObject(object: DocumentObject): DocumentObject {
  switch (object.type) {
    case "line":
      return {
        ...object,
        transform: copyAffineTransform(object.transform),
        start: { ...object.start },
        end: { ...object.end },
      };
    case "rectangle":
      return {
        ...object,
        transform: copyAffineTransform(object.transform),
        origin: { ...object.origin },
      };
    case "ellipse":
      return {
        ...object,
        transform: copyAffineTransform(object.transform),
        center: { ...object.center },
      };
    case "path":
      return {
        ...object,
        transform: copyAffineTransform(object.transform),
        points: object.points.map((point) => ({ ...point })),
      };
    case "group":
      return {
        ...object,
        transform: copyAffineTransform(object.transform),
        children: object.children.map(copyDocumentObject),
      };
  }
}

export function copyDocument(document: LaserxDocument): LaserxDocument {
  return {
    ...document,
    dimensions: { ...document.dimensions },
    origin: { ...document.origin },
    settings: {
      ...document.settings,
      viewport: copyViewportPreferences(document.settings.viewport),
    },
    layers: document.layers.map(copyLayer),
    guides: document.guides.map(copyGuide),
    objects: document.objects.map(copyDocumentObject),
  };
}

export function copyProject(project: LaserxProject): LaserxProject {
  return {
    ...project,
    project: { ...project.project },
    document: copyDocument(project.document),
    migrationHistory: project.migrationHistory.map((record) => ({
      ...record,
    })),
  };
}
