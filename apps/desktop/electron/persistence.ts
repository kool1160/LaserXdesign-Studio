import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import type { RecoverySnapshot } from "@laserx/application";
import {
  laserxProjectSchema,
  parseProjectValue,
} from "@laserx/project-format";
import { z } from "zod";

const recentProjectSchema = z.strictObject({
  filePath: z.string(),
  name: z.string().min(1),
});
const recentProjectsSchema = z.array(recentProjectSchema).max(10);
const recoveryEnvelopeSchema = z.strictObject({
  schemaVersion: z.literal(1),
  capturedAt: z.iso.datetime(),
  originalPath: z.string().nullable(),
  project: z.unknown(),
});

export interface RecentProject {
  filePath: string;
  name: string;
}

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(
      temporaryPath,
      `${JSON.stringify(value, null, 2)}\n`,
      "utf8",
    );
    await rename(temporaryPath, filePath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

export class RecentProjectsStore {
  readonly #filePath: string;

  public constructor(userDataPath: string) {
    this.#filePath = join(userDataPath, "recent-projects.json");
  }

  public async load(): Promise<RecentProject[]> {
    try {
      const parsed = recentProjectsSchema.safeParse(
        JSON.parse(await readFile(this.#filePath, "utf8")) as unknown,
      );
      return parsed.success ? parsed.data : [];
    } catch {
      return [];
    }
  }

  public async add(project: RecentProject): Promise<RecentProject[]> {
    const current = await this.load();
    const normalizedPath = resolve(project.filePath);
    const next = [
      { ...project, filePath: normalizedPath },
      ...current.filter((item) => resolve(item.filePath) !== normalizedPath),
    ].slice(0, 10);
    await atomicWriteJson(this.#filePath, next);
    return next;
  }
}

export interface RecoveryStorePort {
  load(): Promise<RecoverySnapshot | null>;
  save(snapshot: RecoverySnapshot): Promise<void>;
  remove(): Promise<void>;
}

export class RecoveryStore implements RecoveryStorePort {
  public readonly filePath: string;

  public constructor(userDataPath: string) {
    this.filePath = join(userDataPath, "recovery", "active.laserx.autosave");
  }

  public async load(): Promise<RecoverySnapshot | null> {
    try {
      const parsed = recoveryEnvelopeSchema.safeParse(
        JSON.parse(await readFile(this.filePath, "utf8")) as unknown,
      );
      if (!parsed.success) {
        return null;
      }
      return {
        ...parsed.data,
        project: parseProjectValue(parsed.data.project),
      };
    } catch {
      return null;
    }
  }

  public async save(snapshot: RecoverySnapshot): Promise<void> {
    const validated = {
      ...recoveryEnvelopeSchema.parse(snapshot),
      project: laserxProjectSchema.parse(snapshot.project),
    };
    await atomicWriteJson(this.filePath, validated);
  }

  public async remove(): Promise<void> {
    await unlink(this.filePath).catch(() => undefined);
  }
}
