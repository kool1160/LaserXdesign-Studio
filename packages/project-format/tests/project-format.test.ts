import { readFileSync } from "node:fs";

import {
  createBlankProject,
  identityTransform,
  setViewportPreferences,
  type DocumentObject,
  type LaserxProject,
} from "@laserx/domain";
import { describe, expect, it } from "vitest";

import {
  parseProject,
  ProjectFormatError,
  projectMigrationRegistry,
  serializeProject,
} from "../src/index.js";

const PROJECT_ID = "123e4567-e89b-42d3-a456-426614174000";
const DOCUMENT_ID = "123e4567-e89b-42d3-a456-426614174001";
const ARTWORK_LAYER = "223e4567-e89b-42d3-a456-426614174001";
const NOTES_LAYER = "323e4567-e89b-42d3-a456-426614174001";
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

function editingProject(): LaserxProject {
  const groupChildren: DocumentObject[] = [
    {
      id: "123e4567-e89b-42d3-a456-426614174011",
      type: "rectangle",
      layerId: ARTWORK_LAYER,
      transform: identityTransform(),
      origin: { xMm: 120, yMm: 30 },
      widthMm: 80,
      heightMm: 50,
    },
    {
      id: "123e4567-e89b-42d3-a456-426614174012",
      type: "ellipse",
      layerId: ARTWORK_LAYER,
      transform: identityTransform(),
      center: { xMm: 270, yMm: 70 },
      radiusXmm: 40,
      radiusYmm: 25,
    },
  ];
  const objects: DocumentObject[] = [
    {
      id: "123e4567-e89b-42d3-a456-426614174010",
      type: "line",
      layerId: ARTWORK_LAYER,
      transform: {
        ...identityTransform(),
        eMm: 5,
        fMm: 10,
      },
      start: { xMm: 10, yMm: 10 },
      end: { xMm: 100, yMm: 80 },
    },
    {
      id: "123e4567-e89b-42d3-a456-426614174020",
      type: "group",
      layerId: ARTWORK_LAYER,
      transform: {
        a: 0,
        b: 1,
        c: -1,
        d: 0,
        eMm: 300,
        fMm: -100,
      },
      children: groupChildren,
    },
    {
      id: "123e4567-e89b-42d3-a456-426614174013",
      type: "path",
      layerId: NOTES_LAYER,
      transform: identityTransform(),
      closed: true,
      points: [
        { xMm: 350, yMm: 20 },
        { xMm: 430, yMm: 20 },
        { xMm: 390, yMm: 90 },
      ],
    },
  ];
  return setViewportPreferences(
    createBlankProject({
      id: PROJECT_ID,
      documentId: DOCUMENT_ID,
      now: NOW,
      width: 24,
      height: 12,
      inputUnit: "inches",
      displayUnit: "inches",
      layers: [
        {
          id: ARTWORK_LAYER,
          name: "Artwork",
          visible: true,
          locked: false,
        },
        {
          id: NOTES_LAYER,
          name: "Reference",
          visible: false,
          locked: true,
        },
      ],
      activeLayerId: ARTWORK_LAYER,
      guides: [
        {
          id: "423e4567-e89b-42d3-a456-426614174001",
          axis: "x",
          positionMm: 304.8,
        },
      ],
      objects,
    }),
    {
      gridSpacingMm: 12.7,
      snappingEnabled: true,
    },
    NOW,
  );
}

describe("schema version 3", () => {
  it("round trips layers, groups, transforms, guides, and order deterministically", () => {
    const project = editingProject();
    const first = serializeProject(project);
    const reopened = parseProject(first);

    expect(reopened).toEqual(project);
    expect(serializeProject(reopened)).toBe(first);
    expect(first).toBe(fixture("editing-v3.laserx"));
    expect(reopened.document.layers.map((layer) => layer.id)).toEqual([
      ARTWORK_LAYER,
      NOTES_LAYER,
    ]);
    expect(reopened.document.objects[1]?.type).toBe("group");
  });

  it("migrates the reviewed schema-v2 fixture deterministically", () => {
    const migrated = parseProject(fixture("populated-v2.laserx"));
    expect(migrated.schemaVersion).toBe(3);
    expect(serializeProject(migrated)).toBe(
      fixture("migrated-v2-to-v3.laserx"),
    );
    expect(
      migrated.document.objects.every(
        (object) =>
          object.layerId === migrated.document.activeLayerId &&
          object.transform.a === 1 &&
          object.transform.d === 1,
      ),
    ).toBe(true);
  });

  it("chains schema v1 through v2 to v3 without rewriting source metadata", () => {
    const migrated = parseProject(fixture("blank-v1.laserx"));
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.document.id).toBe(PROJECT_ID);
    expect(migrated.document.dimensions).toEqual({
      widthMm: 304.8,
      heightMm: 304.8,
    });
    expect(migrated.migrationHistory).toEqual([
      { fromVersion: 1, toVersion: 2, migratedAt: NOW },
      { fromVersion: 2, toVersion: 3, migratedAt: NOW },
    ]);
  });

  it("rejects corrupt, future, duplicate-ID, and dangling-layer projects safely", () => {
    expectProjectError(
      () => parseProject(fixture("corrupt-v1.laserx")),
      "INVALID_JSON",
    );
    expectProjectError(
      () => parseProject(fixture("future-v99.laserx")),
      "UNSUPPORTED_FUTURE_VERSION",
    );
    const project = editingProject();
    project.document.objects[0] = {
      ...(project.document.objects[0] as DocumentObject),
      layerId: "f23e4567-e89b-42d3-a456-426614174001",
    };
    expectProjectError(
      () => parseProject(JSON.stringify(project)),
      "INVALID_PROJECT",
    );
    const duplicate = editingProject();
    const secondObject = duplicate.document.objects[1];
    if (secondObject === undefined) {
      throw new Error("Expected the fixture to contain two objects.");
    }
    secondObject.id = duplicate.document.objects[0]?.id ?? secondObject.id;
    expectProjectError(
      () => parseProject(JSON.stringify(duplicate)),
      "INVALID_PROJECT",
    );
    const singular = editingProject();
    const firstObject = singular.document.objects[0];
    if (firstObject === undefined) {
      throw new Error("Expected the fixture to contain an object.");
    }
    firstObject.transform = {
      a: 1,
      b: 0,
      c: 1,
      d: 0,
      eMm: 0,
      fMm: 0,
    };
    expectProjectError(
      () => parseProject(JSON.stringify(singular)),
      "INVALID_PROJECT",
    );
  });

  it("registers explicit v1-to-v2 and v2-to-v3 migrations", () => {
    expect(projectMigrationRegistry).toHaveLength(2);
    expect(projectMigrationRegistry).toMatchObject([
      { fromVersion: 1, toVersion: 2 },
      { fromVersion: 2, toVersion: 3 },
    ]);
  });
});
