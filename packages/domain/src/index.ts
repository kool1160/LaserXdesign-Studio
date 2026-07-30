import type { BoundsMm, PointMm } from "@laserx/geometry";

export type { BoundsMm, PointMm } from "@laserx/geometry";

export const PROJECT_SCHEMA_VERSION = 2 as const;
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

export interface DocumentObjectBase {
  id: string;
  type: "line" | "rectangle" | "ellipse" | "path";
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

export type DocumentObject =
  | LineObject
  | RectangleObject
  | EllipseObject
  | PathObject;

export interface LaserxDocument {
  kind: "document";
  id: string;
  dimensions: DocumentDimensions;
  origin: DocumentOrigin;
  settings: DocumentSettings;
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

export interface LaserxProjectV2 {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION;
  project: ProjectMetadata;
  document: LaserxDocument;
  migrationHistory: MigrationRecord[];
}

export type LaserxProject = LaserxProjectV2;

export interface CreateDocumentInput {
  id: string;
  width: number;
  height: number;
  inputUnit: DisplayUnit;
  displayUnit?: DisplayUnit;
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
  objects?: DocumentObject[];
}

export interface UpdateViewportPreferences {
  rulersVisible?: boolean;
  gridVisible?: boolean;
  gridSpacingMm?: number;
  snappingEnabled?: boolean;
  snapToGrid?: boolean;
}

export interface HitTestRequest {
  point: PointMm;
  toleranceMm: number;
  objects: readonly DocumentObject[];
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
  },
};

function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be positive and finite.`);
  }
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

export function createDocument(input: CreateDocumentInput): LaserxDocument {
  const widthMm = toMillimeters(input.width, input.inputUnit);
  const heightMm = toMillimeters(input.height, input.inputUnit);
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
      viewport: {
        ...DEFAULT_VIEWPORT_PREFERENCES,
        snapping: { ...DEFAULT_VIEWPORT_PREFERENCES.snapping },
      },
    },
    objects: (input.objects ?? []).map(copyDocumentObject),
  };
}

export function createBlankProject(
  input: CreateBlankProjectInput,
): LaserxProject {
  const documentInput: CreateDocumentInput = {
    id: input.documentId ?? input.id,
    width: input.width ?? 304.8,
    height: input.height ?? 304.8,
    inputUnit: input.inputUnit ?? "millimeters",
    ...(input.displayUnit === undefined
      ? {}
      : { displayUnit: input.displayUnit }),
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
            snapToGrid: updates.snapToGrid ?? current.snapping.snapToGrid,
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

export function getObjectBounds(object: DocumentObject): BoundsMm {
  switch (object.type) {
    case "line":
      return {
        minXmm: Math.min(object.start.xMm, object.end.xMm),
        minYmm: Math.min(object.start.yMm, object.end.yMm),
        maxXmm: Math.max(object.start.xMm, object.end.xMm),
        maxYmm: Math.max(object.start.yMm, object.end.yMm),
      };
    case "rectangle":
      return {
        minXmm: object.origin.xMm,
        minYmm: object.origin.yMm,
        maxXmm: object.origin.xMm + object.widthMm,
        maxYmm: object.origin.yMm + object.heightMm,
      };
    case "ellipse":
      return {
        minXmm: object.center.xMm - object.radiusXmm,
        minYmm: object.center.yMm - object.radiusYmm,
        maxXmm: object.center.xMm + object.radiusXmm,
        maxYmm: object.center.yMm + object.radiusYmm,
      };
    case "path": {
      const xValues = object.points.map((point) => point.xMm);
      const yValues = object.points.map((point) => point.yMm);
      return {
        minXmm: Math.min(...xValues),
        minYmm: Math.min(...yValues),
        maxXmm: Math.max(...xValues),
        maxYmm: Math.max(...yValues),
      };
    }
  }
}

export function getDocumentBounds(document: LaserxDocument): BoundsMm {
  return document.objects.reduce<BoundsMm>((bounds, object) => {
    const objectBounds = getObjectBounds(object);
    return {
      minXmm: Math.min(bounds.minXmm, objectBounds.minXmm),
      minYmm: Math.min(bounds.minYmm, objectBounds.minYmm),
      maxXmm: Math.max(bounds.maxXmm, objectBounds.maxXmm),
      maxYmm: Math.max(bounds.maxYmm, objectBounds.maxYmm),
    };
  }, getStockRegion(document));
}

export function copyDocumentObject(object: DocumentObject): DocumentObject {
  switch (object.type) {
    case "line":
      return {
        ...object,
        start: { ...object.start },
        end: { ...object.end },
      };
    case "rectangle":
      return { ...object, origin: { ...object.origin } };
    case "ellipse":
      return { ...object, center: { ...object.center } };
    case "path":
      return {
        ...object,
        points: object.points.map((point) => ({ ...point })),
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
      viewport: {
        ...document.settings.viewport,
        snapping: { ...document.settings.viewport.snapping },
      },
    },
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
