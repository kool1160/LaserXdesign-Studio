import { describe, expect, it } from "vitest";

import { classifyImportSource } from "../../electron/import-source.js";

describe("import source classification", () => {
  it.each([
    ["artwork.svg", { kind: "vector", format: "svg" }],
    ["ARTWORK.DXF", { kind: "vector", format: "dxf" }],
    ["logo.png", { kind: "raster", format: "png" }],
    ["photo.jpg", { kind: "raster", format: "jpeg" }],
    ["photo.JPEG", { kind: "raster", format: "jpeg" }],
  ] as const)("classifies %s without exposing or reading it", (filePath, expected) => {
    expect(classifyImportSource(filePath)).toEqual(expected);
  });

  it.each(["artwork", "project.laserx", "archive.svg.exe", ".svg-backup"])(
    "rejects unsupported source %s",
    (filePath) => {
      expect(classifyImportSource(filePath)).toBeNull();
    },
  );
});
