import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

export interface RuntimePathApp {
  getPath(name: "userData"): string;
  setPath(name: "userData" | "sessionData" | "crashDumps", path: string): void;
  setAppLogsPath(path: string): void;
}

export interface LaserxRuntimePaths {
  userData: string;
  sessionData: string;
  logs: string;
  crashDumps: string;
}

export function pathsForUserData(userDataPath: string): LaserxRuntimePaths {
  const userData = resolve(userDataPath);
  return {
    userData,
    sessionData: join(userData, "session"),
    logs: join(userData, "logs"),
    crashDumps: join(userData, "crash-dumps"),
  };
}

export function configureRuntimePaths(
  application: RuntimePathApp,
  userDataOverride?: string,
): LaserxRuntimePaths {
  if (userDataOverride !== undefined) {
    const override = resolve(userDataOverride);
    mkdirSync(override, { recursive: true });
    application.setPath("userData", override);
  }

  const paths = pathsForUserData(application.getPath("userData"));
  for (const directory of [
    paths.userData,
    paths.sessionData,
    paths.logs,
    paths.crashDumps,
  ]) {
    mkdirSync(directory, { recursive: true });
  }
  application.setPath("sessionData", paths.sessionData);
  application.setPath("crashDumps", paths.crashDumps);
  application.setAppLogsPath(paths.logs);
  return paths;
}
