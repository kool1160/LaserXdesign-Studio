import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

async function text(relativePath) {
  return readFile(resolve(root, relativePath), "utf8");
}

function requireText(source, marker, label) {
  if (!source.includes(marker)) {
    throw new Error(`${label} is missing required marker: ${marker}`);
  }
}

function rejectText(source, pattern, label) {
  if (pattern.test(source)) {
    throw new Error(`${label} contains forbidden ${String(pattern)}.`);
  }
}

const rootPackage = JSON.parse(await text("package.json"));
const desktopPackage = JSON.parse(await text("apps/desktop/package.json"));
const builder = await text("apps/desktop/electron-builder.config.cjs");
const installer = await text("apps/desktop/build-resources/installer.nsh");
const runtimePaths = await text("apps/desktop/electron/runtime-paths.ts");
const main = await text("apps/desktop/electron/main.ts");
const workflow = await text(".github/workflows/m13-windows-installer-beta.yml");
const releaseWorkflow = await text(".github/workflows/m13-controlled-beta-release.yml");
const releaseGuide = await text("docs/WINDOWS_BETA_RELEASE.md");
const security = await text("docs/SECURITY.md");
const decision = await text("docs/decisions/0023-windows-beta-installer-and-release-boundary.md");

if (
  rootPackage.version !== "0.13.0-beta.1" ||
  desktopPackage.version !== rootPackage.version
) {
  throw new Error("Root and desktop packages must share the reviewed 0.13.0-beta.1 version.");
}
requireText(rootPackage.scripts.verify, "audit:release", "root verification gate");
for (const script of [
  "package:win",
  "package:installer",
  "package:installer:signed",
  "package:installer:upgrade-fixture",
]) {
  if (typeof desktopPackage.scripts[script] !== "string") {
    throw new Error(`Desktop package is missing ${script}.`);
  }
}
requireText(
  desktopPackage.scripts["package:installer:signed"],
  "LASERX_REQUIRE_CODE_SIGNING=1",
  "signed package script",
);

for (const marker of [
  'appId: "studio.laserx.desktop"',
  'productName: "LaserX Design Studio"',
  'forceCodeSigning: requireCodeSigning',
  'target: [{ target: "nsis", arch: ["x64"] }]',
  "oneClick: false",
  "perMachine: false",
  "createStartMenuShortcut: true",
  "createDesktopShortcut: false",
  'include: path.join(__dirname, "build-resources", "installer.nsh")',
]) requireText(builder, marker, "electron-builder beta configuration");

for (const marker of [
  "laserxInstallOptionsPageCreate",
  "Create a desktop shortcut",
  "--desktop-shortcut",
  "--delete-app-data",
  "customUnInstallSection",
  "Also remove LaserX settings, credentials, recovery, logs, and caches",
  'RMDir /r "$APPDATA\\LaserX Design Studio"',
]) requireText(installer, marker, "NSIS choice boundary");

for (const marker of [
  'join(userData, "session")',
  'join(userData, "logs")',
  'join(userData, "crash-dumps")',
  'application.setPath("sessionData"',
  'application.setPath("crashDumps"',
]) requireText(runtimePaths, marker, "runtime path boundary");
for (const marker of [
  "prepareEmergencyRecovery",
  "render-process-gone",
  "main-process-uncaught-exception",
]) requireText(main, marker, "fatal recovery wiring");

for (const marker of [
  "create-ci-signing-certificate.ps1",
  "package:installer:upgrade-fixture",
  "package:installer:signed",
  "validate-windows-installer.ps1",
  "write-release-provenance.ps1",
  "remove-ci-signing-certificate.ps1",
]) requireText(workflow, marker, "M13 exact-head workflow");
for (const marker of [
  "LASERX_CI_SIGNING_THUMBPRINT",
  'signature.Status -in @(\"NotSigned\", \"HashMismatch\")',
]) requireText(await text("scripts/validate-windows-installer.ps1"), marker, "CI signature boundary");
for (const marker of [
  "workflow_dispatch",
  "WIN_CSC_LINK",
  "WIN_CSC_KEY_PASSWORD",
  "package:installer:signed",
  "forceCodeSigning",
  "gh release create",
  "--prerelease",
]) requireText(releaseWorkflow, marker, "controlled beta release workflow");

for (const marker of [
  "auto-update: deferred",
  "Windows-owned data locations",
  "Performance budgets",
  "Exact release procedure",
  "forceCodeSigning",
  "laserx-release-provenance.json",
]) requireText(releaseGuide, marker, "Windows beta release guide");
for (const marker of [
  "Crash records are local only",
  "WIN_CSC_LINK",
  "disposable self-signed identity",
]) requireText(security, marker, "security contract");
for (const marker of [
  "preserves projects",
  "manual, review-gated workflow",
  "M13 ships no telemetry",
]) requireText(decision, marker, "ADR 0023");

for (const requiredFile of [
  "CHANGELOG.md",
  "docs/BETA_FEEDBACK.md",
  "docs/KNOWN_ISSUES.md",
  "docs/releases/0.13.0-beta.1.md",
]) {
  const contents = await text(requiredFile);
  if (contents.trim().length === 0) throw new Error(`${requiredFile} is empty.`);
}

const productionDependencies = {
  ...rootPackage.dependencies,
  ...desktopPackage.dependencies,
};
if (Object.keys(productionDependencies).some((name) => /electron-updater/u.test(name))) {
  throw new Error("Auto-update is deferred and electron-updater must not be a production dependency.");
}
rejectText(builder + workflow + releaseWorkflow, /BEGIN (?:RSA )?PRIVATE KEY|\.pfx["']\s*:\s*["'][A-Za-z0-9+/=]{32,}/u, "release configuration");

console.log("M13 release policy audit passed: stable x64 NSIS identity, explicit shortcut/data choices, fail-closed signing, local recovery/diagnostics, and manual exact-tag publication.");
