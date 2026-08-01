import { readFileSync } from "node:fs";

import {
  DEFAULT_MANUFACTURING_SETTINGS,
  createBlankProject,
  identityTransform,
  objectUsesLayerRecursively,
  setViewportPreferences,
  type DocumentObject,
  type LaserxProject,
} from "@laserx/domain";
import { describe, expect, it } from "vitest";

import {
  parseProject,
  parseProjectValue,
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

describe("schema version 8", () => {
  it("round trips layers, groups, transforms, guides, and order deterministically", () => {
    const project = editingProject();
    const first = serializeProject(project);
    const reopened = parseProject(first);

    expect(reopened).toEqual(project);
    expect(serializeProject(reopened)).toBe(first);
    expect(first).toContain('"schemaVersion": 8');
    expect(reopened.document.layers.map((layer) => layer.id)).toEqual([
      ARTWORK_LAYER,
      NOTES_LAYER,
    ]);
    expect(reopened.document.objects[1]?.type).toBe("group");
    expect(
      reopened.document.objects.every((object) =>
        objectUsesLayerRecursively(object),
      ),
    ).toBe(true);
  });

  it("migrates the reviewed schema-v2 fixture deterministically", () => {
    const migrated = parseProject(fixture("populated-v2.laserx"));
    expect(migrated.schemaVersion).toBe(8);
    expect(migrated.migrationHistory.at(-1)).toEqual({
      fromVersion: 7,
      toVersion: 8,
      migratedAt: NOW,
    });
    expect(migrated.document.settings.manufacturing).toEqual(
      DEFAULT_MANUFACTURING_SETTINGS,
    );
    expect(
      migrated.document.layers.every((layer) => layer.manufacturing === undefined),
    ).toBe(true);
    expect(
      migrated.document.objects.every(
        (object) =>
          object.layerId === migrated.document.activeLayerId &&
          object.transform.a === 1 &&
          object.transform.d === 1,
      ),
    ).toBe(true);
  });

  it("chains schema v1 through v8 without rewriting source metadata", () => {
    const migrated = parseProject(fixture("blank-v1.laserx"));
    expect(migrated.schemaVersion).toBe(8);
    expect(migrated.document.id).toBe(PROJECT_ID);
    expect(migrated.document.dimensions).toEqual({
      widthMm: 304.8,
      heightMm: 304.8,
    });
    expect(migrated.migrationHistory).toEqual([
      { fromVersion: 1, toVersion: 2, migratedAt: NOW },
      { fromVersion: 2, toVersion: 3, migratedAt: NOW },
      { fromVersion: 3, toVersion: 4, migratedAt: NOW },
      { fromVersion: 4, toVersion: 5, migratedAt: NOW },
      { fromVersion: 5, toVersion: 6, migratedAt: NOW },
      { fromVersion: 6, toVersion: 7, migratedAt: NOW },
      { fromVersion: 7, toVersion: 8, migratedAt: NOW },
    ]);
  });

  it("migrates schema v3 through v8 and persists editable text geometry", () => {
    const v3 = JSON.parse(fixture("editing-v3.laserx")) as unknown;
    const migrated = parseProjectValue(v3);
    expect(migrated.migrationHistory.at(-5)).toEqual({
      fromVersion: 3,
      toVersion: 4,
      migratedAt: NOW,
    });
    expect(migrated.migrationHistory.at(-4)).toEqual({
      fromVersion: 4,
      toVersion: 5,
      migratedAt: NOW,
    });
    expect(migrated.migrationHistory.at(-3)).toEqual({
      fromVersion: 5,
      toVersion: 6,
      migratedAt: NOW,
    });
    expect(migrated.migrationHistory.at(-2)).toEqual({
      fromVersion: 6,
      toVersion: 7,
      migratedAt: NOW,
    });
    expect(migrated.migrationHistory.at(-1)).toEqual({
      fromVersion: 7,
      toVersion: 8,
      migratedAt: NOW,
    });

    const project = editingProject();
    project.document.objects.push({
      id: "523e4567-e89b-42d3-a456-426614174001",
      type: "text",
      layerId: ARTWORK_LAYER,
      transform: identityTransform(),
      content: "O",
      origin: { xMm: 20, yMm: 30 },
      style: {
        fontId: "bundled:noto-sans",
        fontFamily: "Noto Sans",
        fontStyle: "Regular",
        fontFingerprint: "a".repeat(64),
        sizeMm: 24,
        trackingMm: 0,
        wordSpacingMm: 0,
        lineSpacing: 1.2,
        alignment: "left",
      },
      arc: { radiusMm: 80, startAngleDeg: -45, clockwise: false },
      contours: [
        {
          compoundIndex: 0,
          closed: true,
          points: [
            { xMm: 0, yMm: 0 },
            { xMm: 10, yMm: 0 },
            { xMm: 10, yMm: 16 },
          ],
        },
      ],
      missingFont: false,
    });
    const reopened = parseProject(serializeProject(project));
    expect(reopened.document.objects.at(-1)).toEqual(
      project.document.objects.at(-1),
    );
  });

  it("migrates schema v4 without rewriting geometry and persists curve handles", () => {
    const legacy = JSON.parse(fixture("editing-v4.laserx")) as {
      document: unknown;
    };
    const migrated = parseProjectValue(legacy);
    expect(migrated.schemaVersion).toBe(8);
    const { manufacturing, ...migratedSettings } = migrated.document.settings;
    const { templates, ...migratedDocument } = migrated.document;
    expect({ ...migratedDocument, settings: migratedSettings }).toEqual(
      legacy.document,
    );
    expect(templates).toEqual([]);
    expect(manufacturing).toEqual(DEFAULT_MANUFACTURING_SETTINGS);
    expect(migrated.migrationHistory.at(-4)).toEqual({
      fromVersion: 4,
      toVersion: 5,
      migratedAt: NOW,
    });
    expect(migrated.migrationHistory.at(-3)).toEqual({
      fromVersion: 5,
      toVersion: 6,
      migratedAt: NOW,
    });
    expect(migrated.migrationHistory.at(-2)).toEqual({
      fromVersion: 6,
      toVersion: 7,
      migratedAt: NOW,
    });
    expect(migrated.migrationHistory.at(-1)).toEqual({
      fromVersion: 7,
      toVersion: 8,
      migratedAt: NOW,
    });

    const project = editingProject();
    const path = project.document.objects.find(
      (object): object is Extract<DocumentObject, { type: "path" }> =>
        object.type === "path",
    );
    if (path === undefined) {
      throw new Error("Expected an editable path.");
    }
    path.handles = [
      { incoming: null, outgoing: { xMm: 365, yMm: 0 } },
      { incoming: { xMm: 415, yMm: 0 }, outgoing: null },
      { incoming: null, outgoing: null },
    ];
    const reopened = parseProject(serializeProject(project));
    expect(reopened.document.objects.find((object) => object.id === path.id)).toEqual(
      path,
    );

    path.handles.pop();
    expectProjectError(() => serializeProject(project), "INVALID_PROJECT");
  });

  it("persists accepted raster traces as ordinary editable schema-v8 paths", () => {
    const project = createBlankProject({
      id: PROJECT_ID,
      documentId: DOCUMENT_ID,
      now: NOW,
      width: 200,
      height: 100,
      layers: [
        { id: ARTWORK_LAYER, name: "Raster Trace", visible: true, locked: false },
      ],
      activeLayerId: ARTWORK_LAYER,
      objects: [
        {
          id: "723e4567-e89b-42d3-a456-426614174070",
          type: "path",
          layerId: ARTWORK_LAYER,
          transform: identityTransform(),
          closed: true,
          points: [
            { xMm: 10, yMm: 10 },
            { xMm: 90, yMm: 10 },
            { xMm: 90, yMm: 60 },
            { xMm: 10, yMm: 60 },
          ],
        },
      ],
    });

    const serialized = serializeProject(project);
    const reopened = parseProject(serialized);
    expect(reopened.document.objects[0]).toEqual(project.document.objects[0]);
    expect(serializeProject(reopened)).toBe(serialized);
    expect(serialized).not.toContain("png");
    expect(serialized).not.toContain("data:image");
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

  it("rejects mixed-layer nested groups during parsing and serialization", () => {
    const mixed = editingProject();
    const group = mixed.document.objects.find(
      (object) => object.type === "group",
    );
    if (group?.type !== "group") {
      throw new Error("Expected the fixture to contain a group.");
    }
    const [firstChild, ...remainingChildren] = group.children;
    if (firstChild === undefined) {
      throw new Error("Expected the group to contain a child.");
    }
    group.children = [
      {
        id: "123e4567-e89b-42d3-a456-426614174021",
        type: "group",
        layerId: ARTWORK_LAYER,
        transform: identityTransform(),
        children: [{ ...firstChild, layerId: NOTES_LAYER }],
      },
      ...remainingChildren,
    ];

    expectProjectError(
      () => parseProject(JSON.stringify(mixed)),
      "INVALID_PROJECT",
    );
    expectProjectError(() => serializeProject(mixed), "INVALID_PROJECT");
  });

  it("persists manufacturing settings and layer metadata through schema v8", () => {
    const project = editingProject();
    project.document.settings.manufacturing = {
      ...project.document.settings.manufacturing,
      kerfWidthMm: 0.35,
      minimumBridgeWidthMm: 2.5,
      customizedFields: ["kerfWidthMm", "minimumBridgeWidthMm"],
    };
    project.document.layers[0] = {
      ...(project.document.layers[0] as NonNullable<typeof project.document.layers[0]>),
      manufacturing: {
        role: "face",
        material: "mild-steel",
        thicknessMm: 3,
        process: "laser",
        notes: "Front face",
        registrationGroup: "main-holes",
      },
    };
    expect(parseProject(serializeProject(project)).document.settings.manufacturing).toEqual(
      project.document.settings.manufacturing,
    );
    expect(parseProject(serializeProject(project)).document.layers[0]?.manufacturing).toEqual(
      project.document.layers[0].manufacturing,
    );
    expect(projectMigrationRegistry).toHaveLength(7);
    expect(projectMigrationRegistry).toMatchObject([
      { fromVersion: 1, toVersion: 2 },
      { fromVersion: 2, toVersion: 3 },
      { fromVersion: 3, toVersion: 4 },
      { fromVersion: 4, toVersion: 5 },
      { fromVersion: 5, toVersion: 6 },
      { fromVersion: 6, toVersion: 7 },
      { fromVersion: 7, toVersion: 8 },
    ]);
  });

  it("round trips a versioned saved sign template and migrates schema v6 with an empty library", () => {
    const project = editingProject();
    project.document.templates.push({
      id: "823e4567-e89b-42d3-a456-426614174080",
      name: "Twenty-four inch address",
      templateVersion: 1,
      stylePresetId: "industrial-stencil",
      parameters: {
        kind: "address",
        shape: "rounded-rectangle",
        widthMm: 609.6,
        heightMm: 304.8,
        borderWidthMm: 12,
        holeDiameterMm: 6,
        holeInsetMm: 25.4,
        fontId: "bundled:saira-stencil-one",
        fontSizeMm: 42,
        primaryText: "1042",
        secondaryText: "OAK STREET",
        arcRadiusMm: null,
      },
    });
    expect(parseProject(serializeProject(project)).document.templates).toEqual(
      project.document.templates,
    );

    const current = JSON.parse(serializeProject(project)) as {
      schemaVersion: number;
      document: { templates?: unknown };
      migrationHistory: unknown[];
    };
    current.schemaVersion = 6;
    delete current.document.templates;
    current.migrationHistory = [];
    expect(parseProjectValue(current).document.templates).toEqual([]);
  });
});
