import { readFileSync } from "node:fs";

import {
  createBlankProject,
  setViewportPreferences,
  type DocumentObject,
} from "@laserx/domain";
import { describe, expect, it } from "vitest";

import {
  parseProject,
  ProjectFormatError,
  projectMigrationRegistry,
  serializeProject,
} from "../src/index.js";

const PROJECT_ID = "123e4567-e89b-42d3-a456-426614174000";
const NOW = "2026-07-30T12:00:00.000Z";

function fixture(name: string): string {
  return readFileSync(
    new URL(`../../../fixtures/projects/${name}`, import.meta.url),
    "utf8",
  );
}

function expectProjectError(
  action: () => unknown,
  code: ProjectFormatError["code"],
): void {
  try {
    action();
    throw new Error("Expected parsing to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(ProjectFormatError);
    expect((error as ProjectFormatError).code).toBe(code);
  }
}

const objects: DocumentObject[] = [
  {
    id: "123e4567-e89b-42d3-a456-426614174010",
    type: "line",
    start: { xMm: 10, yMm: 10 },
    end: { xMm: 100, yMm: 80 },
  },
  {
    id: "123e4567-e89b-42d3-a456-426614174011",
    type: "rectangle",
    origin: { xMm: 120, yMm: 30 },
    widthMm: 80,
    heightMm: 50,
  },
  {
    id: "123e4567-e89b-42d3-a456-426614174012",
    type: "ellipse",
    center: { xMm: 270, yMm: 70 },
    radiusXmm: 40,
    radiusYmm: 25,
  },
  {
    id: "123e4567-e89b-42d3-a456-426614174013",
    type: "path",
    closed: true,
    points: [
      { xMm: 350, yMm: 20 },
      { xMm: 430, yMm: 20 },
      { xMm: 390, yMm: 90 },
    ],
  },
];

describe("schema version 2", () => {
  it("round trips dimensions, preferences, IDs, and placeholder objects deterministically", () => {
    const project = setViewportPreferences(
      createBlankProject({
        id: PROJECT_ID,
        documentId: "123e4567-e89b-42d3-a456-426614174001",
        now: NOW,
        width: 24,
        height: 12,
        inputUnit: "inches",
        displayUnit: "inches",
        objects,
      }),
      {
        gridSpacingMm: 12.7,
        snappingEnabled: true,
      },
      NOW,
    );

    const first = serializeProject(project);
    const reopened = parseProject(first);

    expect(reopened).toEqual(project);
    expect(serializeProject(reopened)).toBe(first);
    expect(first).toBe(fixture("populated-v2.laserx"));
    expect(reopened.document.dimensions).toEqual({
      widthMm: 609.6,
      heightMm: 304.8,
    });
    expect(reopened.document.objects.map((object) => object.id)).toEqual(
      objects.map((object) => object.id),
    );
  });

  it("migrates schema v1 deterministically and matches the reviewed fixture", () => {
    const migrated = parseProject(fixture("blank-v1.laserx"));
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.document.id).toBe(PROJECT_ID);
    expect(migrated.document.dimensions).toEqual({
      widthMm: 304.8,
      heightMm: 304.8,
    });
    expect(serializeProject(migrated)).toBe(
      fixture("migrated-v1-to-v2.laserx"),
    );
  });

  it("rejects corrupt and future projects safely", () => {
    expectProjectError(
      () => parseProject(fixture("corrupt-v1.laserx")),
      "INVALID_JSON",
    );
    expectProjectError(
      () => parseProject(fixture("future-v99.laserx")),
      "UNSUPPORTED_FUTURE_VERSION",
    );
  });

  it("registers the explicit v1-to-v2 migration", () => {
    expect(projectMigrationRegistry).toHaveLength(1);
    expect(projectMigrationRegistry[0]).toMatchObject({
      fromVersion: 1,
      toVersion: 2,
    });
  });
});
