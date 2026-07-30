import { describe, expect, it } from "vitest";

import {
  desktopStateSchema,
  openRecentRequestSchema,
  setDisplayUnitRequestSchema,
} from "../../electron/ipc-contract.js";

describe("typed IPC validation", () => {
  it("rejects arbitrary fields and invalid units", () => {
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
  });

  it("accepts only a complete renderer state snapshot", () => {
    const result = desktopStateSchema.safeParse({
      project: {
        id: "123e4567-e89b-42d3-a456-426614174000",
        name: "Untitled",
        displayUnit: "millimeters",
        pageWidthMm: 304.8,
        pageHeightMm: 304.8,
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
