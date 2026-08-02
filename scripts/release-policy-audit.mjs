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
const validator = await text("scripts/validate-windows-installer.ps1");
const provenance = await text("scripts/write-release-provenance.ps1");
const signingPolicy = await text("scripts/authenticode-policy.ps1");
const signingPolicyTest = await text("scripts/test-authenticode-policy.ps1");
const releaseGate = await text("scripts/validate-controlled-beta-release.mjs");
const releaseGateTest = await text("scripts/test-controlled-beta-release-gate.mjs");
const packagedIdentityAudit = await text("scripts/verify-packaged-app-identity.cjs");
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
requireText(rootPackage.scripts.verify, "audit:signing-policy", "root verification gate");
requireText(rootPackage.scripts.verify, "audit:release-gate", "root verification gate");
if (desktopPackage.productName !== "LaserX Design Studio") {
  throw new Error("Desktop package metadata must pin productName to LaserX Design Studio.");
}
for (const script of [
  "package:win",
  "package:installer",
  "package:installer:signed",
  "package:installer:signed:prepared",
  "package:installer:upgrade-fixture",
  "package:installer:upgrade-fixture:prepared",
]) {
  if (typeof desktopPackage.scripts[script] !== "string") {
    throw new Error(`Desktop package is missing ${script}.`);
  }
}
requireText(
  desktopPackage.scripts["package:installer:signed"],
  "package:installer:signed:prepared",
  "signed package script",
);
requireText(
  desktopPackage.scripts["package:installer:signed:prepared"],
  "LASERX_REQUIRE_CODE_SIGNING=1",
  "prepared signed package script",
);
requireText(
  desktopPackage.scripts["package:installer:signed"],
  "audit:packaged-identity",
  "signed package script",
);
requireText(
  desktopPackage.scripts["audit:packaged-identity"],
  "verify-packaged-app-identity.cjs",
  "packaged identity script",
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
  'app.setName("LaserX Design Studio")',
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
  "authenticode-policy.ps1",
  "Assert-LaserxAuthenticodeSignature",
  "LASERX_EXPECTED_USER_DATA_PATH",
  "credentials\\ai-provider.json",
]) requireText(validator, marker, "installer lifecycle boundary");
for (const marker of [
  "LASERX_CI_SIGNING_THUMBPRINT",
  "LASERX_EXPECTED_SIGNER_THUMBPRINT",
  "signer identity mismatch",
  'Status -cne "Valid"',
  '@("NotSigned", "HashMismatch")',
]) requireText(signingPolicy, marker, "exact Authenticode identity policy");
for (const marker of [
  "production-wrong-certificate.exe",
  "signer identity mismatch",
  "production-untrusted.exe",
]) requireText(signingPolicyTest, marker, "Authenticode regression test");
for (const marker of [
  "authenticode-policy.ps1",
  "expectedThumbprint",
  "observedThumbprint",
  "requiresTrustedChain",
  "schemaVersion = 2",
]) requireText(provenance, marker, "signed provenance policy");
for (const marker of [
  'name: "@laserx/desktop"',
  'productName: "LaserX Design Studio"',
  "app.asar/package.json",
]) requireText(packagedIdentityAudit, marker, "packaged app identity audit");
for (const marker of [
  "workflow_dispatch",
  "WIN_CSC_LINK",
  "WIN_CSC_KEY_PASSWORD",
  "package:installer:upgrade-fixture:prepared",
  "package:installer:signed:prepared",
  "audit:packaged-identity",
  "forceCodeSigning",
  "gh release create",
  "--prerelease",
]) requireText(releaseWorkflow, marker, "controlled beta release workflow");
for (const marker of [
  "GH_TOKEN is required",
  "LASERX_EXPECTED_SIGNER_THUMBPRINT",
  "gh",
  "release",
  "list",
]) requireText(releaseGate, marker, "executable controlled release gate");
for (const marker of [
  'GH_TOKEN: ""',
  "/GH_TOKEN is required/u",
]) requireText(releaseGateTest, marker, "controlled release gate regression test");

const releaseJobPreamble = releaseWorkflow.split(/\r?\n[ ]{4}steps:/u)[0];
rejectText(
  releaseJobPreamble,
  /WIN_CSC_LINK|WIN_CSC_KEY_PASSWORD/u,
  "controlled release job scope",
);
const releaseStepBlocks = releaseWorkflow
  .split(/\r?\n(?=[ ]{6}- name: )/u)
  .filter((block) => block.startsWith("      - name: "));
const signingStepNames = new Set([
  "Build production-signed upgrade fixture",
  "Build production-signed beta with forceCodeSigning",
]);
for (const block of releaseStepBlocks) {
  const name = block.slice("      - name: ".length).split(/\r?\n/u)[0];
  const exposesSigningSecrets = /secrets\.WIN_CSC_LINK|secrets\.WIN_CSC_KEY_PASSWORD/u.test(block);
  if (signingStepNames.has(name)) {
    requireText(block, "secrets.WIN_CSC_LINK", `${name} step`);
    requireText(block, "secrets.WIN_CSC_KEY_PASSWORD", `${name} step`);
  } else if (exposesSigningSecrets) {
    throw new Error(`${name} must not receive production signing secrets.`);
  }
}
for (const [secretName, expectedCount] of [
  ["secrets.WIN_CSC_LINK", 2],
  ["secrets.WIN_CSC_KEY_PASSWORD", 2],
]) {
  const count = releaseWorkflow.split(secretName).length - 1;
  if (count !== expectedCount) {
    throw new Error(`${secretName} must appear only on the two signing build steps; observed ${String(count)} occurrences.`);
  }
}
for (const marker of [
  "GH_TOKEN: ${{ github.token }}",
  "node scripts/validate-controlled-beta-release.mjs",
  "LASERX_EXPECTED_SIGNER_THUMBPRINT: ${{ vars.WINDOWS_CODE_SIGNING_THUMBPRINT }}",
  "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
  "pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1",
  "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
  "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
]) requireText(releaseWorkflow, marker, "controlled production release boundary");
rejectText(
  releaseWorkflow,
  /uses:\s+(?:actions\/(?:checkout|setup-node|upload-artifact)|pnpm\/action-setup)@v\d/u,
  "controlled production release action pinning",
);

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
