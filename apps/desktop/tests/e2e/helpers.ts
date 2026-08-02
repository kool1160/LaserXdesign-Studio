import { execFile, type ChildProcess } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

import { expect, type Page } from "@playwright/test";
import { _electron as electron, type ElectronApplication } from "playwright";

export const executablePath = join(
  process.cwd(),
  "dist-packaged",
  "win-unpacked",
  "LaserX Design Studio.exe",
);
const execFileAsync = promisify(execFile);
const TRANSIENT_LAUNCH_ERROR =
  /Lock file can not be created|WebSocket error: read ECONNRESET|Target page, context or browser has been closed/;

async function waitForChildExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) {
    return;
  }
  await new Promise<void>((resolveExit) => {
    const onExit = () => {
      clearTimeout(timeoutId);
      resolveExit();
    };
    const timeoutId = setTimeout(() => {
      child.off("exit", onExit);
      resolveExit();
    }, 5_000);
    child.once("exit", onExit);
  });
}

async function launchElectron(
  options: Parameters<typeof electron.launch>[0],
): Promise<ElectronApplication> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await electron.launch(options);
    } catch (error) {
      lastError = error;
      if (
        attempt === 2 ||
        !(error instanceof Error) ||
        !TRANSIENT_LAUNCH_ERROR.test(error.message)
      ) {
        throw error;
      }
      await new Promise<void>((resolveRetry) => {
        setTimeout(resolveRetry, 250 * (attempt + 1));
      });
    }
  }
  throw lastError;
}

export interface TestLaunch {
  electronApp: ElectronApplication;
  directory: string;
  projectPath: string;
  userDataPath: string;
}

export interface LaunchEnvironment {
  aiMock?: boolean;
  aiDelayMs?: string;
  aiCredentialMode?: "application" | "wait";
  aiCredentialTimeoutMs?: string;
  deviceScaleFactor?: string;
  failInitialGetState?: boolean;
  geometryDelayMs?: string;
  importPath?: string;
  exportPath?: string;
  rasterPath?: string;
  productionPath?: string;
}

export async function launchPackaged(
  directory?: string,
  closeResponse: "save" | "discard" | "cancel" = "cancel",
  launchEnvironment: LaunchEnvironment = {},
): Promise<TestLaunch> {
  return launchLaserxExecutable(
    executablePath,
    directory,
    closeResponse,
    launchEnvironment,
  );
}

export async function launchInstalledBeta(
  installedExecutablePath: string,
  directory?: string,
  launchEnvironment: LaunchEnvironment = {},
): Promise<TestLaunch> {
  return launchLaserxExecutable(
    installedExecutablePath,
    directory,
    "discard",
    launchEnvironment,
  );
}

async function launchLaserxExecutable(
  targetExecutablePath: string,
  directory: string | undefined,
  closeResponse: "save" | "discard" | "cancel",
  launchEnvironment: LaunchEnvironment,
): Promise<TestLaunch> {
  const testDirectory =
    directory ?? (await mkdtemp(join(tmpdir(), "laserx-e2e-")));
  const projectPath = join(testDirectory, "lifecycle.laserx");
  const userDataPath = join(testDirectory, "user-data");
  const electronApp = await launchElectron({
    executablePath: targetExecutablePath,
    env: {
      ...process.env,
      LASERX_AUTOSAVE_INTERVAL_MS: "40",
      LASERX_TEST_CLOSE_RESPONSE: closeResponse,
      LASERX_TEST_PROJECT_PATH: projectPath,
      LASERX_USER_DATA_PATH: userDataPath,
      ...(launchEnvironment.aiMock === true
        ? { LASERX_TEST_AI_MOCK: "1" }
        : {}),
      ...(launchEnvironment.aiDelayMs === undefined
        ? {}
        : { LASERX_TEST_AI_DELAY_MS: launchEnvironment.aiDelayMs }),
      ...(launchEnvironment.aiCredentialMode === undefined
        ? {}
        : { LASERX_TEST_AI_CREDENTIAL_MODE: launchEnvironment.aiCredentialMode }),
      ...(launchEnvironment.aiCredentialTimeoutMs === undefined
        ? {}
        : { LASERX_TEST_AI_CREDENTIAL_TIMEOUT_MS: launchEnvironment.aiCredentialTimeoutMs }),
      ...(launchEnvironment.deviceScaleFactor === undefined
        ? {}
        : {
            LASERX_TEST_DEVICE_SCALE_FACTOR:
              launchEnvironment.deviceScaleFactor,
          }),
      ...(launchEnvironment.failInitialGetState === true
        ? { LASERX_TEST_GET_STATE_FAILURE: "1" }
        : {}),
      ...(launchEnvironment.geometryDelayMs === undefined
        ? {}
        : { LASERX_TEST_GEOMETRY_DELAY_MS: launchEnvironment.geometryDelayMs }),
      ...(launchEnvironment.importPath === undefined
        ? {}
        : { LASERX_TEST_IMPORT_PATH: launchEnvironment.importPath }),
      ...(launchEnvironment.exportPath === undefined
        ? {}
        : { LASERX_TEST_EXPORT_PATH: launchEnvironment.exportPath }),
      ...(launchEnvironment.rasterPath === undefined
        ? {}
        : { LASERX_TEST_RASTER_PATH: launchEnvironment.rasterPath }),
      ...(launchEnvironment.productionPath === undefined
        ? {}
        : { LASERX_TEST_PRODUCTION_PATH: launchEnvironment.productionPath }),
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
  await waitForChildExit(child);
}

export async function clickAndWaitForCommand(
  page: Page,
  buttonName: "Save" | "Save as",
): Promise<void> {
  const button = page.getByRole("button", {
    name: buttonName,
    exact: true,
  });
  await expect(button).toBeEnabled();
  await button.evaluate(async (element) => {
    const commandButton = element as HTMLButtonElement;
    await new Promise<void>((resolveCommand, rejectCommand) => {
      let observedBusy = commandButton.disabled;
      const observer = new MutationObserver(() => {
        if (commandButton.disabled) {
          observedBusy = true;
        } else if (observedBusy) {
          window.clearTimeout(timeoutId);
          observer.disconnect();
          resolveCommand();
        }
      });
      const timeoutId = window.setTimeout(() => {
        observer.disconnect();
        rejectCommand(
          new Error(
            `${commandButton.textContent} did not complete its disabled-to-enabled UI cycle within 10 seconds.`,
          ),
        );
      }, 10_000);
      observer.observe(commandButton, {
        attributes: true,
        attributeFilter: ["disabled"],
      });
      commandButton.click();
    });
  });
}

export async function waitForProjectSchema(
  projectPath: string,
  schemaVersion: number,
): Promise<void> {
  await expect
    .poll(
      async () => {
        try {
          const candidate = JSON.parse(
            await readFile(projectPath, "utf8"),
          ) as { schemaVersion?: unknown };
          return candidate.schemaVersion;
        } catch (error) {
          return error instanceof Error
            ? `parse/read error: ${error.message}`
            : "parse/read error: unknown failure";
        }
      },
      {
        message: `Expected the saved .laserx file to become valid schema version ${String(schemaVersion)}.`,
        timeout: 10_000,
        intervals: [50, 100, 250, 500],
      },
    )
    .toBe(schemaVersion);
}
