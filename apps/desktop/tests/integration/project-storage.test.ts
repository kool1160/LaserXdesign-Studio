import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createBlankProject } from "@laserx/domain";
import { afterEach, describe, expect, it } from "vitest";

import {
  ProjectStorage,
  ProjectStorageError,
} from "../../electron/project-storage.js";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "laserx-storage-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("ProjectStorage", () => {
  it("atomically saves and reopens a schema-v9 project", async () => {
    const directory = await temporaryDirectory();
    const filePath = join(directory, "blank.laserx");
    const project = createBlankProject({
      id: "123e4567-e89b-42d3-a456-426614174000",
      now: "2026-07-30T12:00:00.000Z",
    });
    const storage = new ProjectStorage();

    await storage.write(filePath, project);

    await expect(storage.read(filePath)).resolves.toEqual(project);
    expect(await readFile(filePath, "utf8")).toContain('"schemaVersion": 9');
  });

  it("replaces an existing project and reopens the replacement", async () => {
    const directory = await temporaryDirectory();
    const filePath = join(directory, "replacement.laserx");
    const storage = new ProjectStorage();
    const first = createBlankProject({
      id: "123e4567-e89b-42d3-a456-426614174000",
      documentId: "123e4567-e89b-42d3-a456-426614174001",
      now: "2026-07-30T12:00:00.000Z",
      width: 600,
      height: 300,
    });
    const replacement = createBlankProject({
      id: "123e4567-e89b-42d3-a456-426614174002",
      documentId: "123e4567-e89b-42d3-a456-426614174003",
      now: "2026-07-30T12:01:00.000Z",
      width: 24,
      height: 12,
      inputUnit: "inches",
    });

    await storage.write(filePath, first);
    await storage.write(filePath, replacement);

    await expect(storage.read(filePath)).resolves.toEqual(replacement);
  });

  it("fails safely for corrupt and future-version projects", async () => {
    const directory = await temporaryDirectory();
    const corruptPath = join(directory, "corrupt.laserx");
    const futurePath = join(directory, "future.laserx");
    await writeFile(corruptPath, "{", "utf8");
    await writeFile(
      futurePath,
      JSON.stringify({ schemaVersion: 99 }),
      "utf8",
    );
    const storage = new ProjectStorage();

    await expect(storage.read(corruptPath)).rejects.toThrow(
      "not valid JSON",
    );
    await expect(storage.read(futurePath)).rejects.toThrow(
      "schema version 99",
    );
  });

  it("rejects non-laserx paths", async () => {
    const storage = new ProjectStorage();
    await expect(storage.read("unsafe.txt")).rejects.toBeInstanceOf(
      ProjectStorageError,
    );
  });
});
