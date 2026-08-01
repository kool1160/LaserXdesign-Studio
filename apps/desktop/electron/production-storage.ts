import { randomUUID } from "node:crypto";
import {
  mkdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import type { ProductionPackage } from "@laserx/production-export";

const MAX_PRODUCTION_FILE_BYTES = 5_000_000;

export type ProductionConflictPolicy = "fail" | "replace";

export interface ProductionPackageWriteResult {
  ok: boolean;
  targetDirectory: string;
  writtenFiles: string[];
  failedFile: string | null;
  error: string | null;
}

export interface ProductionPackageFileService {
  write(
    targetDirectory: string,
    productionPackage: ProductionPackage,
    conflictPolicy: ProductionConflictPolicy,
  ): Promise<ProductionPackageWriteResult>;
}

function safeTargetDirectory(targetDirectory: string): string {
  const normalized = resolve(targetDirectory);
  if (basename(normalized).trim().length === 0) {
    throw new RangeError("Choose a specific production package folder.");
  }
  return normalized;
}

function safePackageFileName(fileName: string): string {
  if (
    basename(fileName) !== fileName ||
    !/^[a-z0-9][a-z0-9.-]{0,199}$/u.test(fileName)
  ) {
    throw new RangeError("Production package filenames must be flat, bounded, and portable.");
  }
  return fileName;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export class ProductionStorage implements ProductionPackageFileService {
  public async write(
    targetDirectory: string,
    productionPackage: ProductionPackage,
    conflictPolicy: ProductionConflictPolicy,
  ): Promise<ProductionPackageWriteResult> {
    const normalized = safeTargetDirectory(targetDirectory);
    const parent = dirname(normalized);
    await mkdir(parent, { recursive: true });
    if ((await exists(normalized)) && conflictPolicy === "fail") {
      return {
        ok: false,
        targetDirectory: normalized,
        writtenFiles: [],
        failedFile: null,
        error: "The production package folder already exists. Choose Replace existing package to overwrite it.",
      };
    }

    const staging = join(parent, `.${basename(normalized)}.${randomUUID()}.staging`);
    const backup = join(parent, `.${basename(normalized)}.${randomUUID()}.backup`);
    const writtenFiles: string[] = [];
    let failedFile: string | null = null;
    let movedExisting = false;
    const seenNames = new Set<string>();
    try {
      await mkdir(staging, { recursive: false });
      for (const file of productionPackage.files) {
        failedFile = file.name;
        const fileName = safePackageFileName(file.name);
        if (seenNames.has(fileName)) {
          throw new RangeError("Production package filenames must be unique.");
        }
        seenNames.add(fileName);
        if (Buffer.byteLength(file.content, "utf8") > MAX_PRODUCTION_FILE_BYTES) {
          throw new RangeError("A production package file exceeds the 5 MB safety limit.");
        }
        await writeFile(join(staging, fileName), file.content, {
          encoding: "utf8",
          flag: "wx",
        });
        writtenFiles.push(file.name);
      }
      failedFile = null;
      if (await exists(normalized)) {
        await rename(normalized, backup);
        movedExisting = true;
      }
      await rename(staging, normalized);
      if (movedExisting) {
        await rm(backup, { recursive: true, force: true }).catch(() => undefined);
      }
      return {
        ok: true,
        targetDirectory: normalized,
        writtenFiles,
        failedFile: null,
        error: null,
      };
    } catch (error) {
      await rm(staging, { recursive: true, force: true }).catch(() => undefined);
      if (movedExisting && !(await exists(normalized))) {
        await rename(backup, normalized).catch(() => undefined);
      }
      return {
        ok: false,
        targetDirectory: normalized,
        writtenFiles,
        failedFile,
        error: `Production export failed${failedFile === null ? "" : ` while writing ${failedFile}`}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
