import {
  DEFAULT_VIEWPORT_PREFERENCES,
  PROJECT_SCHEMA_VERSION,
  collectObjectIds,
  deriveStableId,
  identityTransform,
  isInvertibleTransform,
  objectUsesLayerRecursively,
  type AffineTransformMm,
  type DocumentObject,
  type LaserxProject,
} from "@laserx/domain";
import { z } from "zod";

const positiveNumber = z.number().positive();
const finiteNumber = z.number();
const pointSchema = z.strictObject({
  xMm: finiteNumber,
  yMm: finiteNumber,
});
const transformSchema: z.ZodType<AffineTransformMm> = z
  .strictObject({
    a: finiteNumber,
    b: finiteNumber,
    c: finiteNumber,
    d: finiteNumber,
    eMm: finiteNumber,
    fMm: finiteNumber,
  })
  .refine(isInvertibleTransform, "Transform must be invertible.");
const metadataSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().trim().min(1).max(200),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
const migrationRecordSchema = z.strictObject({
  fromVersion: z.number().int().nonnegative(),
  toVersion: z.number().int().positive(),
  migratedAt: z.iso.datetime(),
});

const lineObjectV2Schema = z.strictObject({
  id: z.uuid(),
  type: z.literal("line"),
  start: pointSchema,
  end: pointSchema,
});
const rectangleObjectV2Schema = z.strictObject({
  id: z.uuid(),
  type: z.literal("rectangle"),
  origin: pointSchema,
  widthMm: positiveNumber,
  heightMm: positiveNumber,
});
const ellipseObjectV2Schema = z.strictObject({
  id: z.uuid(),
  type: z.literal("ellipse"),
  center: pointSchema,
  radiusXmm: positiveNumber,
  radiusYmm: positiveNumber,
});
const pathObjectV2Schema = z.strictObject({
  id: z.uuid(),
  type: z.literal("path"),
  closed: z.boolean(),
  points: z.array(pointSchema).min(2),
});
const documentObjectV2Schema = z.discriminatedUnion("type", [
  lineObjectV2Schema,
  rectangleObjectV2Schema,
  ellipseObjectV2Schema,
  pathObjectV2Schema,
]);

const objectBaseShape = {
  id: z.uuid(),
  layerId: z.uuid(),
  transform: transformSchema,
};

const documentObjectV3Schema: z.ZodType<DocumentObject> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.strictObject({
      ...objectBaseShape,
      type: z.literal("line"),
      start: pointSchema,
      end: pointSchema,
    }),
    z.strictObject({
      ...objectBaseShape,
      type: z.literal("rectangle"),
      origin: pointSchema,
      widthMm: positiveNumber,
      heightMm: positiveNumber,
    }),
    z.strictObject({
      ...objectBaseShape,
      type: z.literal("ellipse"),
      center: pointSchema,
      radiusXmm: positiveNumber,
      radiusYmm: positiveNumber,
    }),
    z.strictObject({
      ...objectBaseShape,
      type: z.literal("path"),
      closed: z.boolean(),
      points: z.array(pointSchema).min(2),
    }),
    z.strictObject({
      ...objectBaseShape,
      type: z.literal("group"),
      children: z.array(documentObjectV3Schema).min(1),
    }),
  ]),
);

const textStyleSchema = z.strictObject({
  fontId: z.string().trim().min(1).max(200),
  fontFamily: z.string().trim().min(1).max(200),
  fontStyle: z.string().trim().min(1).max(100),
  fontFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  sizeMm: positiveNumber,
  trackingMm: finiteNumber,
  wordSpacingMm: finiteNumber,
  lineSpacing: positiveNumber,
  alignment: z.enum(["left", "center", "right"]),
});
const textArcSchema = z.strictObject({
  radiusMm: positiveNumber,
  startAngleDeg: finiteNumber,
  clockwise: z.boolean(),
});
const textContourSchema = z.strictObject({
  compoundIndex: z.number().int().nonnegative(),
  closed: z.boolean(),
  points: z.array(pointSchema).min(2),
});
const editableTextSourceSchema = z.strictObject({
  content: z.string().min(1).max(10_000),
  origin: pointSchema,
  style: textStyleSchema,
  arc: textArcSchema.nullable(),
  contours: z.array(textContourSchema).min(1),
});
const documentObjectV4Schema: z.ZodType<DocumentObject> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.strictObject({
      ...objectBaseShape,
      type: z.literal("line"),
      start: pointSchema,
      end: pointSchema,
    }),
    z.strictObject({
      ...objectBaseShape,
      type: z.literal("rectangle"),
      origin: pointSchema,
      widthMm: positiveNumber,
      heightMm: positiveNumber,
    }),
    z.strictObject({
      ...objectBaseShape,
      type: z.literal("ellipse"),
      center: pointSchema,
      radiusXmm: positiveNumber,
      radiusYmm: positiveNumber,
    }),
    z.strictObject({
      ...objectBaseShape,
      type: z.literal("path"),
      closed: z.boolean(),
      points: z.array(pointSchema).min(2),
    }),
    z.strictObject({
      ...objectBaseShape,
      type: z.literal("text"),
      content: z.string().min(1).max(10_000),
      origin: pointSchema,
      style: textStyleSchema,
      arc: textArcSchema.nullable(),
      contours: z.array(textContourSchema).min(1),
      missingFont: z.boolean(),
    }),
    z.strictObject({
      ...objectBaseShape,
      type: z.literal("group"),
      children: z.array(documentObjectV4Schema).min(1),
      sourceText: editableTextSourceSchema.optional(),
    }),
  ]),
);

const pathControlHandlesSchema = z.strictObject({
  incoming: pointSchema.nullable(),
  outgoing: pointSchema.nullable(),
});
const documentObjectSchema: z.ZodType<DocumentObject> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.strictObject({
      ...objectBaseShape,
      type: z.literal("line"),
      start: pointSchema,
      end: pointSchema,
    }),
    z.strictObject({
      ...objectBaseShape,
      type: z.literal("rectangle"),
      origin: pointSchema,
      widthMm: positiveNumber,
      heightMm: positiveNumber,
    }),
    z.strictObject({
      ...objectBaseShape,
      type: z.literal("ellipse"),
      center: pointSchema,
      radiusXmm: positiveNumber,
      radiusYmm: positiveNumber,
    }),
    z.strictObject({
      ...objectBaseShape,
      type: z.literal("path"),
      closed: z.boolean(),
      points: z.array(pointSchema).min(2),
      handles: z.array(pathControlHandlesSchema).optional(),
    }),
    z.strictObject({
      ...objectBaseShape,
      type: z.literal("text"),
      content: z.string().min(1).max(10_000),
      origin: pointSchema,
      style: textStyleSchema,
      arc: textArcSchema.nullable(),
      contours: z.array(textContourSchema).min(1),
      missingFont: z.boolean(),
    }),
    z.strictObject({
      ...objectBaseShape,
      type: z.literal("group"),
      children: z.array(documentObjectSchema).min(1),
      sourceText: editableTextSourceSchema.optional(),
    }),
  ]),
);

const layerSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().trim().min(1).max(100),
  visible: z.boolean(),
  locked: z.boolean(),
});
const guideSchema = z.strictObject({
  id: z.uuid(),
  axis: z.enum(["x", "y"]),
  positionMm: finiteNumber,
});

export const laserxProjectV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  project: metadataSchema,
  document: z.strictObject({
    kind: z.literal("empty"),
    settings: z.strictObject({
      displayUnit: z.enum(["millimeters", "inches"]),
      pageWidthMm: positiveNumber,
      pageHeightMm: positiveNumber,
    }),
  }),
  migrationHistory: z.array(migrationRecordSchema),
});

export const laserxProjectV2Schema = z.strictObject({
  schemaVersion: z.literal(2),
  project: metadataSchema,
  document: z.strictObject({
    kind: z.literal("document"),
    id: z.uuid(),
    dimensions: z.strictObject({
      widthMm: positiveNumber,
      heightMm: positiveNumber,
    }),
    origin: z.strictObject({
      xMm: z.literal(0),
      yMm: z.literal(0),
    }),
    settings: z.strictObject({
      displayUnit: z.enum(["millimeters", "inches"]),
      viewport: z.strictObject({
        rulersVisible: z.boolean(),
        gridVisible: z.boolean(),
        gridSpacingMm: positiveNumber,
        snapping: z.strictObject({
          enabled: z.boolean(),
          snapToGrid: z.boolean(),
        }),
      }),
    }),
    objects: z.array(documentObjectV2Schema),
  }),
  migrationHistory: z.array(migrationRecordSchema),
});

export const laserxProjectV3Schema = z.strictObject({
  schemaVersion: z.literal(3),
  project: metadataSchema,
  document: z.strictObject({
    kind: z.literal("document"),
    id: z.uuid(),
    dimensions: z.strictObject({
      widthMm: positiveNumber,
      heightMm: positiveNumber,
    }),
    origin: z.strictObject({
      xMm: z.literal(0),
      yMm: z.literal(0),
    }),
    settings: z.strictObject({
      displayUnit: z.enum(["millimeters", "inches"]),
      viewport: z.strictObject({
        rulersVisible: z.boolean(),
        gridVisible: z.boolean(),
        gridSpacingMm: positiveNumber,
        snapping: z.strictObject({
          enabled: z.boolean(),
          snapToGrid: z.boolean(),
          snapToGuides: z.boolean(),
          snapToObjects: z.boolean(),
          snapToDocument: z.boolean(),
        }),
      }),
    }),
    layers: z.array(layerSchema).min(1),
    activeLayerId: z.uuid(),
    guides: z.array(guideSchema),
    objects: z.array(documentObjectV3Schema),
  }),
  migrationHistory: z.array(migrationRecordSchema),
});

export const laserxProjectV4Schema = z.strictObject({
  schemaVersion: z.literal(4),
  project: metadataSchema,
  document: z.strictObject({
    kind: z.literal("document"),
    id: z.uuid(),
    dimensions: z.strictObject({
      widthMm: positiveNumber,
      heightMm: positiveNumber,
    }),
    origin: z.strictObject({
      xMm: z.literal(0),
      yMm: z.literal(0),
    }),
    settings: z.strictObject({
      displayUnit: z.enum(["millimeters", "inches"]),
      viewport: z.strictObject({
        rulersVisible: z.boolean(),
        gridVisible: z.boolean(),
        gridSpacingMm: positiveNumber,
        snapping: z.strictObject({
          enabled: z.boolean(),
          snapToGrid: z.boolean(),
          snapToGuides: z.boolean(),
          snapToObjects: z.boolean(),
          snapToDocument: z.boolean(),
        }),
      }),
    }),
    layers: z.array(layerSchema).min(1),
    activeLayerId: z.uuid(),
    guides: z.array(guideSchema),
    objects: z.array(documentObjectV4Schema),
  }),
  migrationHistory: z.array(migrationRecordSchema),
});

export const laserxProjectSchema: z.ZodType<LaserxProject> = z.strictObject({
  schemaVersion: z.literal(PROJECT_SCHEMA_VERSION),
  project: metadataSchema,
  document: z.strictObject({
    kind: z.literal("document"),
    id: z.uuid(),
    dimensions: z.strictObject({
      widthMm: positiveNumber,
      heightMm: positiveNumber,
    }),
    origin: z.strictObject({
      xMm: z.literal(0),
      yMm: z.literal(0),
    }),
    settings: z.strictObject({
      displayUnit: z.enum(["millimeters", "inches"]),
      viewport: z.strictObject({
        rulersVisible: z.boolean(),
        gridVisible: z.boolean(),
        gridSpacingMm: positiveNumber,
        snapping: z.strictObject({
          enabled: z.boolean(),
          snapToGrid: z.boolean(),
          snapToGuides: z.boolean(),
          snapToObjects: z.boolean(),
          snapToDocument: z.boolean(),
        }),
      }),
    }),
    layers: z.array(layerSchema).min(1),
    activeLayerId: z.uuid(),
    guides: z.array(guideSchema),
    objects: z.array(documentObjectSchema),
  }),
  migrationHistory: z.array(migrationRecordSchema),
});

type LaserxProjectV2 = z.infer<typeof laserxProjectV2Schema>;
type LaserxProjectV3Format = z.infer<typeof laserxProjectV3Schema>;
type LaserxProjectV4Format = z.infer<typeof laserxProjectV4Schema>;
type DocumentObjectV2 = z.infer<typeof documentObjectV2Schema>;

export type ProjectFormatErrorCode =
  | "INVALID_JSON"
  | "INVALID_PROJECT"
  | "UNSUPPORTED_FUTURE_VERSION";

export class ProjectFormatError extends Error {
  public readonly code: ProjectFormatErrorCode;

  public constructor(code: ProjectFormatErrorCode, message: string) {
    super(message);
    this.name = "ProjectFormatError";
    this.code = code;
  }
}

export interface ProjectMigration {
  fromVersion: number;
  toVersion: number;
  migrate(value: unknown): unknown;
}

export function migrateProjectV1ToV2(value: unknown): LaserxProjectV2 {
  const legacy = laserxProjectV1Schema.safeParse(value);
  if (!legacy.success) {
    throw new ProjectFormatError(
      "INVALID_PROJECT",
      "This schema-v1 project is damaged and cannot be migrated.",
    );
  }
  const project = legacy.data;
  return {
    schemaVersion: 2,
    project: { ...project.project },
    document: {
      kind: "document",
      id: project.project.id,
      dimensions: {
        widthMm: project.document.settings.pageWidthMm,
        heightMm: project.document.settings.pageHeightMm,
      },
      origin: {
        xMm: 0,
        yMm: 0,
      },
      settings: {
        displayUnit: project.document.settings.displayUnit,
        viewport: {
          rulersVisible: DEFAULT_VIEWPORT_PREFERENCES.rulersVisible,
          gridVisible: DEFAULT_VIEWPORT_PREFERENCES.gridVisible,
          gridSpacingMm: DEFAULT_VIEWPORT_PREFERENCES.gridSpacingMm,
          snapping: {
            enabled: DEFAULT_VIEWPORT_PREFERENCES.snapping.enabled,
            snapToGrid:
              DEFAULT_VIEWPORT_PREFERENCES.snapping.snapToGrid,
          },
        },
      },
      objects: [],
    },
    migrationHistory: [
      ...project.migrationHistory.map((record) => ({ ...record })),
      {
        fromVersion: 1,
        toVersion: 2,
        migratedAt: project.project.updatedAt,
      },
    ],
  };
}

function migrateObjectV2(
  object: DocumentObjectV2,
  layerId: string,
): DocumentObject {
  const base = {
    id: object.id,
    layerId,
    transform: identityTransform(),
  };
  switch (object.type) {
    case "line":
      return {
        ...base,
        type: "line",
        start: { ...object.start },
        end: { ...object.end },
      };
    case "rectangle":
      return {
        ...base,
        type: "rectangle",
        origin: { ...object.origin },
        widthMm: object.widthMm,
        heightMm: object.heightMm,
      };
    case "ellipse":
      return {
        ...base,
        type: "ellipse",
        center: { ...object.center },
        radiusXmm: object.radiusXmm,
        radiusYmm: object.radiusYmm,
      };
    case "path":
      return {
        ...base,
        type: "path",
        closed: object.closed,
        points: object.points.map((point) => ({ ...point })),
      };
  }
}

export function migrateProjectV2ToV3(value: unknown): LaserxProjectV3Format {
  const legacy = laserxProjectV2Schema.safeParse(value);
  if (!legacy.success) {
    throw new ProjectFormatError(
      "INVALID_PROJECT",
      "This schema-v2 project is damaged and cannot be migrated.",
    );
  }
  const project = legacy.data;
  const layerId = deriveStableId(project.document.id, "default-layer");
  return {
    schemaVersion: 3,
    project: { ...project.project },
    document: {
      kind: "document",
      id: project.document.id,
      dimensions: { ...project.document.dimensions },
      origin: { ...project.document.origin },
      settings: {
        displayUnit: project.document.settings.displayUnit,
        viewport: {
          rulersVisible:
            project.document.settings.viewport.rulersVisible,
          gridVisible: project.document.settings.viewport.gridVisible,
          gridSpacingMm:
            project.document.settings.viewport.gridSpacingMm,
          snapping: {
            enabled: project.document.settings.viewport.snapping.enabled,
            snapToGrid:
              project.document.settings.viewport.snapping.snapToGrid,
            snapToGuides:
              DEFAULT_VIEWPORT_PREFERENCES.snapping.snapToGuides,
            snapToObjects:
              DEFAULT_VIEWPORT_PREFERENCES.snapping.snapToObjects,
            snapToDocument:
              DEFAULT_VIEWPORT_PREFERENCES.snapping.snapToDocument,
          },
        },
      },
      layers: [
        {
          id: layerId,
          name: "Layer 1",
          visible: true,
          locked: false,
        },
      ],
      activeLayerId: layerId,
      guides: [],
      objects: project.document.objects.map((object) =>
        migrateObjectV2(object, layerId),
      ),
    },
    migrationHistory: [
      ...project.migrationHistory.map((record) => ({ ...record })),
      {
        fromVersion: 2,
        toVersion: 3,
        migratedAt: project.project.updatedAt,
      },
    ],
  };
}

export function migrateProjectV3ToV4(value: unknown): LaserxProjectV4Format {
  const legacy = laserxProjectV3Schema.safeParse(value);
  if (!legacy.success) {
    throw new ProjectFormatError(
      "INVALID_PROJECT",
      "This schema-v3 project is damaged and cannot be migrated.",
    );
  }
  return {
    ...legacy.data,
    schemaVersion: 4,
    migrationHistory: [
      ...legacy.data.migrationHistory.map((record) => ({ ...record })),
      {
        fromVersion: 3,
        toVersion: 4,
        migratedAt: legacy.data.project.updatedAt,
      },
    ],
  };
}

export function migrateProjectV4ToV5(value: unknown): LaserxProject {
  const legacy = laserxProjectV4Schema.safeParse(value);
  if (!legacy.success) {
    throw new ProjectFormatError(
      "INVALID_PROJECT",
      "This schema-v4 project is damaged and cannot be migrated.",
    );
  }
  return {
    ...legacy.data,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    migrationHistory: [
      ...legacy.data.migrationHistory.map((record) => ({ ...record })),
      {
        fromVersion: 4,
        toVersion: PROJECT_SCHEMA_VERSION,
        migratedAt: legacy.data.project.updatedAt,
      },
    ],
  };
}

export function migrateProjectV1(value: unknown): LaserxProject {
  return migrateProjectV4ToV5(
    migrateProjectV3ToV4(
      migrateProjectV2ToV3(migrateProjectV1ToV2(value)),
    ),
  );
}

export const projectMigrationRegistry: readonly ProjectMigration[] = [
  {
    fromVersion: 1,
    toVersion: 2,
    migrate: migrateProjectV1ToV2,
  },
  {
    fromVersion: 2,
    toVersion: 3,
    migrate: migrateProjectV2ToV3,
  },
  {
    fromVersion: 3,
    toVersion: 4,
    migrate: migrateProjectV3ToV4,
  },
  {
    fromVersion: 4,
    toVersion: PROJECT_SCHEMA_VERSION,
    migrate: migrateProjectV4ToV5,
  },
];

function readSchemaVersion(value: unknown): number | undefined {
  if (
    typeof value === "object" &&
    value !== null &&
    "schemaVersion" in value &&
    typeof value.schemaVersion === "number"
  ) {
    return value.schemaVersion;
  }
  return undefined;
}

function objectLayerReferencesAreValid(
  object: DocumentObject,
  layerIds: ReadonlySet<string>,
): boolean {
  return layerIds.has(object.layerId) && objectUsesLayerRecursively(object);
}

function objectPathStateIsValid(object: DocumentObject): boolean {
  if (object.type === "path") {
    return (
      (!object.closed || object.points.length >= 3) &&
      (object.handles === undefined ||
        object.handles.length === object.points.length)
    );
  }
  return (
    object.type !== "group" ||
    object.children.every((child) => objectPathStateIsValid(child))
  );
}

export function parseProjectValue(candidate: unknown): LaserxProject {
  const sourceVersion = readSchemaVersion(candidate);
  if (
    sourceVersion !== undefined &&
    sourceVersion > PROJECT_SCHEMA_VERSION
  ) {
    throw new ProjectFormatError(
      "UNSUPPORTED_FUTURE_VERSION",
      `This project uses schema version ${String(sourceVersion)}. This version of LaserX supports up to schema version ${String(PROJECT_SCHEMA_VERSION)}.`,
    );
  }
  let migrated = candidate;
  let version = sourceVersion;
  while (version !== undefined && version < PROJECT_SCHEMA_VERSION) {
    const migration = projectMigrationRegistry.find(
      (candidateMigration) => candidateMigration.fromVersion === version,
    );
    if (migration === undefined) {
      break;
    }
    migrated = migration.migrate(migrated);
    version = readSchemaVersion(migrated);
  }
  const result = laserxProjectSchema.safeParse(migrated);
  if (!result.success) {
    throw new ProjectFormatError(
      "INVALID_PROJECT",
      "This file is damaged or is not a supported LaserX project.",
    );
  }
  const layerIds = new Set(
    result.data.document.layers.map((layer) => layer.id),
  );
  const entityIds = [
    ...result.data.document.layers.map((layer) => layer.id),
    ...result.data.document.guides.map((guide) => guide.id),
    ...result.data.document.objects.flatMap((object) =>
      collectObjectIds(object),
    ),
  ];
  if (
    new Set(entityIds).size !== entityIds.length ||
    !layerIds.has(result.data.document.activeLayerId) ||
    result.data.document.objects.some(
      (object) =>
        !objectLayerReferencesAreValid(object, layerIds) ||
        !objectPathStateIsValid(object),
    )
  ) {
    throw new ProjectFormatError(
      "INVALID_PROJECT",
      "This project contains duplicate IDs or invalid layer references.",
    );
  }
  return result.data;
}

export function parseProject(serialized: string): LaserxProject {
  let candidate: unknown;
  try {
    candidate = JSON.parse(serialized) as unknown;
  } catch {
    throw new ProjectFormatError(
      "INVALID_JSON",
      "This file is not valid JSON and cannot be opened as a LaserX project.",
    );
  }
  return parseProjectValue(candidate);
}

export function serializeProject(project: LaserxProject): string {
  const normalized = laserxProjectSchema.safeParse(project);
  if (!normalized.success) {
    throw new ProjectFormatError(
      "INVALID_PROJECT",
      "The project contains invalid data and cannot be saved.",
    );
  }
  const reparsed = parseProjectValue(normalized.data);
  return `${JSON.stringify(reparsed, null, 2)}\n`;
}
