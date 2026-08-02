import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  configureRuntimePaths,
  pathsForUserData,
  type RuntimePathApp,
} from "../../electron/runtime-paths.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("Windows-owned runtime paths", () => {
  it("keeps session data, logs, and crash dumps under the per-user data root", async () => {
    const directory = await mkdtemp(join(tmpdir(), "laserx-runtime-paths-"));
    temporaryDirectories.push(directory);
    const userData = join(directory, "LaserX Design Studio");
    const assigned = new Map<string, string>();
    let currentUserData = join(directory, "initial");
    const application: RuntimePathApp = {
      getPath: () => currentUserData,
      setPath(name, path) {
        assigned.set(name, path);
        if (name === "userData") currentUserData = path;
      },
      setAppLogsPath(path) {
        assigned.set("logs", path);
      },
    };

    const paths = configureRuntimePaths(application, userData);

    expect(paths).toEqual(pathsForUserData(userData));
    expect(assigned).toEqual(new Map([
      ["userData", resolve(userData)],
      ["sessionData", join(resolve(userData), "session")],
      ["crashDumps", join(resolve(userData), "crash-dumps")],
      ["logs", join(resolve(userData), "logs")],
    ]));
    await Promise.all([
      stat(paths.userData),
      stat(paths.sessionData),
      stat(paths.logs),
      stat(paths.crashDumps),
    ]);
  });
});
