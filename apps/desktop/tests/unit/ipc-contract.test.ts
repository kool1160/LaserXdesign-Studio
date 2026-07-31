import { describe, expect, it } from "vitest";

import {
  createDocumentRequestSchema,
  desktopStateSchema,
  editorActionRequestSchema,
  fontCatalogSchema,
  openRecentRequestSchema,
  setDisplayUnitRequestSchema,
  setViewportPreferencesRequestSchema,
  textLayoutRequestSchema,
  textUpdateRequestSchema,
} from "../../electron/ipc-contract.js";

describe("typed IPC validation", () => {
  it("rejects arbitrary fields, pixels, and invalid viewport values", () => {
    expect(
      setDisplayUnitRequestSchema.safeParse({
        displayUnit: "pixels",
      }).success,
    ).toBe(false);
    expect(
      openRecentRequestSchema.safeParse({
        filePath: "C:\\safe.laserx",
        command: "rm",
      }).success,
    ).toBe(false);
    expect(
      createDocumentRequestSchema.safeParse({
        width: -1,
        height: 12,
        inputUnit: "inches",
      }).success,
    ).toBe(false);
    expect(
      setViewportPreferencesRequestSchema.safeParse({
        gridSpacingMm: 0,
      }).success,
    ).toBe(false);
    expect(
      editorActionRequestSchema.safeParse({
        type: "objects.move",
        objectIds: ["123e4567-e89b-42d3-a456-426614174002"],
        deltaXmm: 1,
        deltaYmm: 2,
        document: { arbitrary: true },
      }).success,
    ).toBe(false);
    expect(
      editorActionRequestSchema.safeParse({
        type: "objects.duplicate",
        objectIds: ["123e4567-e89b-42d3-a456-426614174002"],
        idMap: {},
        offsetXmm: 10,
        offsetYmm: 10,
      }).success,
    ).toBe(false);
  });

  it("accepts only a complete renderer document snapshot", () => {
    const result = desktopStateSchema.safeParse({
      project: {
        id: "123e4567-e89b-42d3-a456-426614174000",
        name: "Untitled",
        document: {
          kind: "document",
          id: "123e4567-e89b-42d3-a456-426614174001",
          dimensions: { widthMm: 609.6, heightMm: 304.8 },
          origin: { xMm: 0, yMm: 0 },
          settings: {
            displayUnit: "inches",
            viewport: {
              rulersVisible: true,
              gridVisible: true,
              gridSpacingMm: 12.7,
              snapping: {
                enabled: false,
                snapToGrid: true,
                snapToGuides: true,
                snapToObjects: true,
                snapToDocument: true,
              },
            },
          },
          layers: [
            {
              id: "123e4567-e89b-42d3-a456-426614174002",
              name: "Layer 1",
              visible: true,
              locked: false,
            },
          ],
          activeLayerId: "123e4567-e89b-42d3-a456-426614174002",
          guides: [],
          objects: [],
        },
      },
      editor: {
        selectionIds: [],
        selectionBounds: null,
        clipboardHasContent: false,
        history: {
          undoDepth: 0,
          redoDepth: 0,
          limit: 100,
          transactionActive: false,
        },
      },
      filePath: null,
      dirty: false,
      recovered: false,
      recentProjects: [],
      recovery: null,
    });
    expect(result.success).toBe(true);
  });

  it("keeps font paths and generated contours outside renderer requests", () => {
    expect(
      textLayoutRequestSchema.safeParse({
        fontId: "bundled:noto-sans",
        content: "LaserX",
        sizeMm: 20,
        trackingMm: 0,
        wordSpacingMm: 0,
        lineSpacing: 1.2,
        alignment: "left",
        arc: null,
        fontPath: "C:\\Windows\\Fonts\\arial.ttf",
      }).success,
    ).toBe(false);
    expect(
      textUpdateRequestSchema.safeParse({
        fontId: "bundled:noto-sans",
        content: "LaserX",
        sizeMm: 20,
        trackingMm: 0,
        wordSpacingMm: 0,
        lineSpacing: 1.2,
        alignment: "left",
        arc: null,
      }).success,
    ).toBe(false);
    expect(
      textUpdateRequestSchema.safeParse({
        fontId: "bundled:noto-sans",
        content: "LaserX",
        sizeMm: 20,
        trackingMm: 0,
        wordSpacingMm: 0,
        lineSpacing: 1.2,
        alignment: "left",
        arc: null,
        mode: "explicit",
      }).success,
    ).toBe(true);
    expect(
      fontCatalogSchema.safeParse([
        {
          id: "bundled:noto-sans",
          family: "Noto Sans",
          style: "Regular",
          source: "bundled",
          categories: ["industrial"],
          fingerprint: "a".repeat(64),
          license: {
            spdx: "OFL-1.1",
            copyright: "Copyright holder",
            licenseFile: "packages/fonts/licenses/OFL-1.1.txt",
            provenance: "@fontsource-variable/noto-sans@5.3.0",
          },
          path: "C:\\secret.ttf",
        },
      ]).success,
    ).toBe(false);
  });

  it("accepts signed exact coordinates and zero line extents", () => {
    const result = editorActionRequestSchema.safeParse({
      type: "objects.set-bounds",
      objectIds: ["123e4567-e89b-42d3-a456-426614174002"],
      xMm: 0,
      yMm: -25,
      widthMm: 120,
      heightMm: 0,
      lockAspectRatio: false,
    });
    expect(result.success).toBe(true);
    expect(
      editorActionRequestSchema.safeParse({
        type: "objects.set-bounds",
        objectIds: ["123e4567-e89b-42d3-a456-426614174002"],
        widthMm: -1,
        lockAspectRatio: false,
      }).success,
    ).toBe(false);
  });
});
