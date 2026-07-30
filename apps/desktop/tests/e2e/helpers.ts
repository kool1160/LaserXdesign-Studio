import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

import { _electron as electron, type ElectronApplication } from "playwright";

export const executablePath = join(
  process.cwd(),
  "dist-packaged",
  "win-unpacked",
  "LaserX Design Studio.exe",
);
const execFileAsync = promisify(execFile);

export interface TestLaunch {
  electronApp: ElectronApplication;
  directory: string;
  projectPath: string;
  userDataPath: string;
}

export interface LaunchEnvironment {
  deviceScaleFactor?: string;
  failInitialGetState?: boolean;
}

export async function launchPackaged(
  directory?: string,
  closeResponse: "save" | "discard" | "cancel" = "cancel",
  launchEnvironment: LaunchEnvironment = {},
): Promise<TestLaunch> {
  const testDirectory =
    directory ?? (await mkdtemp(join(tmpdir(), "laserx-e2e-")));
  const projectPath = join(testDirectory, "lifecycle.laserx");
  const userDataPath = join(testDirectory, "user-data");
  const electronApp = await electron.launch({
    executablePath,
    env: {
      ...process.env,
      LASERX_AUTOSAVE_INTERVAL_MS: "40",
      LASERX_TEST_CLOSE_RESPONSE: closeResponse,
      LASERX_TEST_PROJECT_PATH: projectPath,
      LASERX_USER_DATA_PATH: userDataPath,
      ...(launchEnvironment.deviceScaleFactor === undefined
        ? {}
        : {
            LASERX_TEST_DEVICE_SCALE_FACTOR:
              launchEnvironment.deviceScaleFactor,
          }),
      ...(launchEnvironment.failInitialGetState === true
        ? { LASERX_TEST_GET_STATE_FAILURE: "1" }
        : {}),
    },
  });
  return {
    electronApp,
    directory: testDirectory,
    projectPath,
    userDataPath,
  };
}

export async function killAndRemove(testLaunch: TestLaunch): Promise<void> {
  await kill(testLaunch);
  await rm(testLaunch.directory, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 100,
  });
}

export async function kill(testLaunch: TestLaunch): Promise<void> {
  const child = testLaunch.electronApp.process();
  const processId = child.pid;
  if (processId === undefined || child.exitCode !== null) {
    return;
  }
  await execFileAsync("taskkill.exe", [
    "/PID",
    String(processId),
    "/T",
    "/F",
  ]).catch(() => undefined);
}
