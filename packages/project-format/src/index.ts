import {
  DEFAULT_VIEWPORT_PREFERENCES,
  PROJECT_SCHEMA_VERSION,
  type LaserxProject,
} from "@laserx/domain";
import { z } from "zod";

const positiveNumber = z.number().positive();
const finiteNumber = z.number();
const pointSchema = z.strictObject({
  xMm: finiteNumber,
  yMm: finiteNumber,
});
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

const lineObjectSchema = z.strictObject({
  id: z.uuid(),
  type: z.literal("line"),
  start: pointSchema,
  end: pointSchema,
});
const rectangleObjectSchema = z.strictObject({
  id: z.uuid(),
  type: z.literal("rectangle"),
  origin: pointSchema,
  widthMm: positiveNumber,
  heightMm: positiveNumber,
});
const ellipseObjectSchema = z.strictObject({
  id: z.uuid(),
  type: z.literal("ellipse"),
  center: pointSchema,
  radiusXmm: positiveNumber,
  radiusYmm: positiveNumber,
});
const pathObjectSchema = z.strictObject({
  id: z.uuid(),
  type: z.literal("path"),
  closed: z.boolean(),
  points: z.array(pointSchema).min(2),
});

const documentObjectSchema = z.discriminatedUnion("type", [
  lineObjectSchema,
  rectangleObjectSchema,
  ellipseObjectSchema,
  pathObjectSchema,
]);

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
        }),
      }),
    }),
    objects: z.array(documentObjectSchema),
  }),
  migrationHistory: z.array(migrationRecordSchema),
});

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
  migrate(value: unknown): LaserxProject;
}

export function migrateProjectV1(value: unknown): LaserxProject {
  const legacy = laserxProjectV1Schema.safeParse(value);
  if (!legacy.success) {
    throw new ProjectFormatError(
      "INVALID_PROJECT",
      "This schema-v1 project is damaged and cannot be migrated.",
    );
  }
  const project = legacy.data;
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
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
          ...DEFAULT_VIEWPORT_PREFERENCES,
          snapping: { ...DEFAULT_VIEWPORT_PREFERENCES.snapping },
        },
      },
      objects: [],
    },
    migrationHistory: [
      ...project.migrationHistory.map((record) => ({ ...record })),
      {
        fromVersion: 1,
        toVersion: PROJECT_SCHEMA_VERSION,
        migratedAt: project.project.updatedAt,
      },
    ],
  };
}

export const projectMigrationRegistry: readonly ProjectMigration[] = [
  {
    fromVersion: 1,
    toVersion: PROJECT_SCHEMA_VERSION,
    migrate: migrateProjectV1,
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

export function parseProjectValue(candidate: unknown): LaserxProject {
  const schemaVersion = readSchemaVersion(candidate);
  if (
    schemaVersion !== undefined &&
    schemaVersion > PROJECT_SCHEMA_VERSION
  ) {
    throw new ProjectFormatError(
      "UNSUPPORTED_FUTURE_VERSION",
      `This project uses schema version ${String(schemaVersion)}. This version of LaserX supports up to schema version ${String(PROJECT_SCHEMA_VERSION)}.`,
    );
  }
  if (schemaVersion === 1) {
    return migrateProjectV1(candidate);
  }
  const result = laserxProjectSchema.safeParse(candidate);
  if (!result.success) {
    throw new ProjectFormatError(
      "INVALID_PROJECT",
      "This file is damaged or is not a supported LaserX project.",
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
  return `${JSON.stringify(normalized.data, null, 2)}\n`;
}
