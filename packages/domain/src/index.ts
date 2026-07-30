export const PROJECT_SCHEMA_VERSION = 1 as const;

export type DisplayUnit = "millimeters" | "inches";

export interface ProjectSettings {
  displayUnit: DisplayUnit;
  pageWidthMm: number;
  pageHeightMm: number;
}

export interface EmptyDocument {
  kind: "empty";
  settings: ProjectSettings;
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

export interface LaserxProjectV1 {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION;
  project: ProjectMetadata;
  document: EmptyDocument;
  migrationHistory: MigrationRecord[];
}

export interface CreateBlankProjectInput {
  id: string;
  now: string;
  name?: string;
  settings?: Partial<ProjectSettings>;
}

export const DEFAULT_PROJECT_SETTINGS: Readonly<ProjectSettings> = {
  displayUnit: "millimeters",
  pageWidthMm: 304.8,
  pageHeightMm: 304.8,
};

export function createBlankProject(
  input: CreateBlankProjectInput,
): LaserxProjectV1 {
  const name = input.name ?? "Untitled";
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    project: {
      id: input.id,
      name,
      createdAt: input.now,
      updatedAt: input.now,
    },
    document: {
      kind: "empty",
      settings: {
        ...DEFAULT_PROJECT_SETTINGS,
        ...input.settings,
      },
    },
    migrationHistory: [],
  };
}

export function updateProjectSettings(
  project: LaserxProjectV1,
  settings: Partial<ProjectSettings>,
  updatedAt: string,
): LaserxProjectV1 {
  return {
    ...project,
    project: {
      ...project.project,
      updatedAt,
    },
    document: {
      ...project.document,
      settings: {
        ...project.document.settings,
        ...settings,
      },
    },
  };
}
