import { describe, expect, it } from "vitest";

import {
  createDocumentRequestSchema,
  desktopStateSchema,
  openRecentRequestSchema,
  setDisplayUnitRequestSchema,
  setViewportPreferencesRequestSchema,
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
              snapping: { enabled: false, snapToGrid: true },
            },
          },
          objects: [],
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
});
