import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";

import type { LaserxProjectV1 } from "@laserx/domain";
import { parseProject, serializeProject } from "@laserx/project-format";

const MAX_PROJECT_BYTES = 10 * 1024 * 1024;

export class ProjectStorageError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ProjectStorageError";
  }
}

export function validateProjectPath(filePath: string): string {
  const normalized = resolve(filePath);
  if (extname(normalized).toLowerCase() !== ".laserx") {
    throw new ProjectStorageError(
      "LaserX projects must use the .laserx file extension.",
    );
  }
  return normalized;
}

async function atomicWrite(filePath: string, contents: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, contents, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporaryPath, filePath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

export class ProjectStorage {
  public async read(filePath: string): Promise<LaserxProjectV1> {
    const normalized = validateProjectPath(filePath);
    let fileStats;
    try {
      fileStats = await stat(normalized);
    } catch (error) {
      throw new ProjectStorageError(
        "The selected project could not be found or read.",
        { cause: error },
      );
    }
    if (!fileStats.isFile() || fileStats.size > MAX_PROJECT_BYTES) {
      throw new ProjectStorageError(
        "The selected project is not a supported file or exceeds the 10 MB M01 limit.",
      );
    }
    try {
      return parseProject(await readFile(normalized, "utf8"));
    } catch (error) {
      if (error instanceof Error) {
        throw new ProjectStorageError(error.message, { cause: error });
      }
      throw error;
    }
  }

  public async write(
    filePath: string,
    project: LaserxProjectV1,
  ): Promise<void> {
    const normalized = validateProjectPath(filePath);
    try {
      await atomicWrite(normalized, serializeProject(project));
    } catch (error) {
      if (error instanceof ProjectStorageError) {
        throw error;
      }
      throw new ProjectStorageError("The project could not be saved.", {
        cause: error,
      });
    }
  }
}
