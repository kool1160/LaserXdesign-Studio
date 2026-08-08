import { extname } from "node:path";

export type ImportSourceClassification =
  | { readonly kind: "vector"; readonly format: "svg" | "dxf" }
  | { readonly kind: "raster"; readonly format: "png" | "jpeg" };

/**
 * Classifies only the source types LaserX already imports. The selected path
 * remains in Electron main; the renderer receives only this bounded result.
 */
export function classifyImportSource(
  filePath: string,
): ImportSourceClassification | null {
  switch (extname(filePath).toLowerCase()) {
    case ".svg":
      return { kind: "vector", format: "svg" };
    case ".dxf":
      return { kind: "vector", format: "dxf" };
    case ".png":
      return { kind: "raster", format: "png" };
    case ".jpg":
    case ".jpeg":
      return { kind: "raster", format: "jpeg" };
    default:
      return null;
  }
}
