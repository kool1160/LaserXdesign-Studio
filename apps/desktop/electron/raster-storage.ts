import { readFile, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";

import {
  MAX_RASTER_SOURCE_BYTES,
} from "@laserx/import-raster";

export interface RasterFileService {
  read(filePath: string): Promise<Uint8Array>;
}

export function validateRasterPath(filePath: string): string {
  const normalized = resolve(filePath);
  const extension = extname(normalized).toLowerCase();
  if (![".png", ".jpg", ".jpeg"].includes(extension)) {
    throw new RangeError("Raster tracing files must use a .png, .jpg, or .jpeg extension.");
  }
  return normalized;
}

export class RasterStorage implements RasterFileService {
  public async read(filePath: string): Promise<Uint8Array> {
    const normalized = validateRasterPath(filePath);
    let details;
    try {
      details = await stat(normalized);
    } catch (error) {
      throw new Error("The selected raster file could not be found or read.", {
        cause: error,
      });
    }
    if (!details.isFile() || details.size === 0 || details.size > MAX_RASTER_SOURCE_BYTES) {
      throw new RangeError(
        `The selected raster must be a regular file no larger than ${String(MAX_RASTER_SOURCE_BYTES)} bytes.`,
      );
    }
    return new Uint8Array(await readFile(normalized));
  }
}
