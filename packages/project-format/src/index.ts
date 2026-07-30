import type { LaserxProjectV1 } from "@laserx/domain";
import { PROJECT_SCHEMA_VERSION } from "@laserx/domain";
import { z } from "zod";

const positiveFiniteNumber = z
  .number()
  .positive();

export const laserxProjectV1Schema: z.ZodType<LaserxProjectV1> = z.strictObject({
  schemaVersion: z.literal(PROJECT_SCHEMA_VERSION),
  project: z.strictObject({
    id: z.uuid(),
    name: z.string().trim().min(1).max(200),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  }),
  document: z.strictObject({
    kind: z.literal("empty"),
    settings: z.strictObject({
      displayUnit: z.enum(["millimeters", "inches"]),
      pageWidthMm: positiveFiniteNumber,
      pageHeightMm: positiveFiniteNumber,
    }),
  }),
  migrationHistory: z.array(
    z.strictObject({
      fromVersion: z.number().int().nonnegative(),
      toVersion: z.number().int().positive(),
      migratedAt: z.iso.datetime(),
    }),
  ),
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
  migrate(value: unknown, migratedAt: string): unknown;
}

export const projectMigrationRegistry: readonly ProjectMigration[] = [];

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

export function parseProject(serialized: string): LaserxProjectV1 {
  let candidate: unknown;
  try {
    candidate = JSON.parse(serialized) as unknown;
  } catch {
    throw new ProjectFormatError(
      "INVALID_JSON",
      "This file is not valid JSON and cannot be opened as a LaserX project.",
    );
  }

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

  const result = laserxProjectV1Schema.safeParse(candidate);
  if (!result.success) {
    throw new ProjectFormatError(
      "INVALID_PROJECT",
      "This file is damaged or is not a supported LaserX project.",
    );
  }
  return result.data;
}

export function serializeProject(project: LaserxProjectV1): string {
  const normalized = laserxProjectV1Schema.safeParse(project);
  if (!normalized.success) {
    throw new ProjectFormatError(
      "INVALID_PROJECT",
      "The project contains invalid data and cannot be saved.",
    );
  }
  return `${JSON.stringify(normalized.data, null, 2)}\n`;
}
