import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, extname, resolve } from "node:path";

const MAX_VECTOR_BYTES = 5_000_000;

export type VectorFileFormat = "svg" | "dxf";

export interface VectorFileService {
  read(filePath: string): Promise<string>;
  write(filePath: string, contents: string, format: VectorFileFormat): Promise<void>;
}

export function validateVectorPath(
  filePath: string,
  expectedFormat?: VectorFileFormat,
): string {
  const normalized = resolve(filePath);
  const extension = extname(normalized).toLowerCase();
  if (extension !== ".svg" && extension !== ".dxf") {
    throw new RangeError("Vector interchange files must use the .svg or .dxf extension.");
  }
  if (expectedFormat !== undefined && extension !== `.${expectedFormat}`) {
    throw new RangeError(`The selected export path must use the .${expectedFormat} extension.`);
  }
  return normalized;
}

export class VectorStorage implements VectorFileService {
  public async read(filePath: string): Promise<string> {
    const normalized = validateVectorPath(filePath);
    let details;
    try {
      details = await stat(normalized);
    } catch (error) {
      throw new Error("The selected vector file could not be found or read.", { cause: error });
    }
    if (!details.isFile() || details.size > MAX_VECTOR_BYTES) {
      throw new RangeError("The selected vector file exceeds the 5 MB safety limit or is not a regular file.");
    }
    const contents = await readFile(normalized, "utf8");
    if (contents.includes("\0")) {
      throw new RangeError("The selected vector file contains unsupported binary data.");
    }
    return contents;
  }

  public async write(
    filePath: string,
    contents: string,
    format: VectorFileFormat,
  ): Promise<void> {
    const normalized = validateVectorPath(filePath, format);
    if (Buffer.byteLength(contents, "utf8") > MAX_VECTOR_BYTES) {
      throw new RangeError("The vector export exceeds the 5 MB safety limit.");
    }
    await mkdir(dirname(normalized), { recursive: true });
    const temporaryPath = `${normalized}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, contents, { encoding: "utf8", flag: "wx" });
      await rename(temporaryPath, normalized);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw new Error("The vector export could not be written.", { cause: error });
    }
  }
}
