import { performance } from "node:perf_hooks";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import {
  clickAndWaitForCommand,
  killAndRemove,
  launchInstalledBeta,
  waitForProjectSchema,
} from "./helpers.js";

const installedExecutablePath = process.env.LASERX_INSTALLED_EXECUTABLE_PATH;
const expectedUserDataPath = process.env.LASERX_EXPECTED_USER_DATA_PATH;

test("installed beta launches, remains accessible at high DPI, and completes the primary vector workflow", async () => {
  test.skip(
    installedExecutablePath === undefined,
    "Runs only against the clean-installed M13 executable.",
  );
  if (installedExecutablePath === undefined) return;
  if (expectedUserDataPath === undefined) {
    throw new Error("LASERX_EXPECTED_USER_DATA_PATH is required for installed lifecycle validation.");
  }

  const directory = await mkdtemp(join(tmpdir(), "laserx-installed-beta-"));
  const importPath = join(directory, "representative-sign.svg");
  const exportPath = join(directory, "representative-sign.dxf");
  await writeFile(
    importPath,
    '<svg width="600mm" height="300mm" viewBox="0 0 600 300"><g data-layer="Face"><polygon points="20,20 580,20 580,280 20,280"/></g></svg>',
    "utf8",
  );

  const startedAt = performance.now();
  const launched = await launchInstalledBeta(installedExecutablePath, directory, {
    aiMock: true,
    aiCredentialMode: "application",
    deviceScaleFactor: "1.5",
    importPath,
    exportPath,
    useDefaultUserData: true,
  });
  try {
    const page = await launched.electronApp.firstWindow();
    await expect(page.getByTestId("viewport")).toBeVisible();
    const runtimeIdentity = await launched.electronApp.evaluate(({ app }) => ({
      name: app.getName(),
      userData: app.getPath("userData"),
      sessionData: app.getPath("sessionData"),
      logs: app.getPath("logs"),
      crashDumps: app.getPath("crashDumps"),
    }));
    expect(runtimeIdentity.name).toBe("LaserX Design Studio");
    expect(runtimeIdentity.userData.toLowerCase()).toBe(expectedUserDataPath.toLowerCase());
    expect(launched.userDataPath.toLowerCase()).toBe(expectedUserDataPath.toLowerCase());
    expect(runtimeIdentity.sessionData.toLowerCase()).toBe(
      join(expectedUserDataPath, "session").toLowerCase(),
    );
    expect(runtimeIdentity.logs.toLowerCase()).toBe(
      join(expectedUserDataPath, "logs").toLowerCase(),
    );
    expect(runtimeIdentity.crashDumps.toLowerCase()).toBe(
      join(expectedUserDataPath, "crash-dumps").toLowerCase(),
    );
    for (const directoryPath of [
      runtimeIdentity.userData,
      runtimeIdentity.sessionData,
      runtimeIdentity.logs,
      runtimeIdentity.crashDumps,
    ]) {
      expect((await stat(directoryPath)).isDirectory()).toBe(true);
    }
    const startupMs = performance.now() - startedAt;
    expect(startupMs).toBeLessThan(15_000);
    expect(await page.evaluate(() => window.devicePixelRatio)).toBe(1.5);

    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to design workspace" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#design-workspace")).toBeFocused();

    const acceptedCredential = "laserx-installed-beta-credential-valid-1234567890";
    const credentialWindowPromise = launched.electronApp.waitForEvent("window");
    await page.getByTestId("connect-ai").click();
    const credentialWindow = await credentialWindowPromise;
    await credentialWindow.getByTestId("credential-input").fill(acceptedCredential);
    await credentialWindow.getByTestId("credential-submit").click();
    await expect(page.getByTestId("ai-connection-message")).toContainText("stored");
    const credentialPath = join(
      expectedUserDataPath,
      "credentials",
      "ai-provider.json",
    );
    const credentialEnvelope = await readFile(credentialPath, "utf8");
    expect(credentialEnvelope).not.toContain(acceptedCredential);

    await page.getByTestId("preview-vector-import").click();
    await expect(page.getByTestId("import-preview-summary")).toContainText(
      "600.000 × 300.000 mm",
    );
    await page.getByTestId("commit-vector-import").click();
    const recoveryPath = join(
      expectedUserDataPath,
      "recovery",
      "active.laserx.autosave",
    );
    await expect.poll(async () => {
      try {
        return (await readFile(recoveryPath, "utf8")).length;
      } catch {
        return 0;
      }
    }).toBeGreaterThan(0);
    await page.getByTestId("run-cutability-analysis").click();
    await expect
      .poll(async () =>
        (await page.evaluate(() => window.laserx.getState())).analysis.cutability?.status,
      )
      .toBe("complete");

    await clickAndWaitForCommand(page, "Save as");
    await waitForProjectSchema(launched.projectPath, 9);
    expect((await stat(join(expectedUserDataPath, "recent-projects.json"))).isFile()).toBe(true);
    expect((await stat(join(expectedUserDataPath, "logs", "main.log"))).isFile()).toBe(true);
    await page.getByTestId("export-dxf").click();
    await expect(page.getByTestId("export-summary")).toContainText(
      "Exported 1 path(s) as DXF in millimeters",
    );
    expect(await readFile(exportPath, "utf8")).toContain("$INSUNITS\n70\n4\n");
  } finally {
    await killAndRemove(launched);
  }
});
