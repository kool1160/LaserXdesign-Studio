import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

async function source(path) {
  return readFile(resolve(root, path), "utf8");
}

function requireText(value, marker, label) {
  if (!value.includes(marker)) throw new Error(`${label} is missing: ${marker}`);
}

function rejectText(value, pattern, label) {
  if (pattern.test(value)) throw new Error(`${label} contains forbidden ${String(pattern)}.`);
}

const domain = await source("packages/domain/src/model.ts");
const projectFormat = await source("packages/project-format/src/index.ts");
const production = await source("packages/production-export/src/index.ts");
const storage = await source("apps/desktop/electron/production-storage.ts");
const renderer = await source("apps/desktop/src/app/App.tsx");
const contract = await source("apps/desktop/electron/ipc-contract.ts");
const documentation = await source("docs/PRODUCTION_PACKAGES.md");
const golden = JSON.parse(await source("fixtures/production/m12-package-goldens.json"));

for (const marker of [
  "PROJECT_SCHEMA_VERSION = 8",
  "manufacturing?: ManufacturingLayerMetadata",
  '"non-cut-preview"',
]) requireText(domain, marker, "schema-v8 manufacturing layer contract");

for (const marker of [
  "migrateProjectV7ToV8",
  "laserxProjectV7Schema",
  "manufacturingLayerMetadataSchema.optional()",
]) requireText(projectFormat, marker, "project migration contract");

for (const marker of [
  "PRODUCTION_PACKAGE_SCHEMA_VERSION = 1",
  'layer.manufacturing?.role !== "non-cut-preview"',
  "sha256",
  'originMm: { xMm: 0, yMm: 0 }',
  'name: "manifest.json"',
]) requireText(production, marker, "production package contract");

for (const marker of [
  'conflictPolicy === "fail"',
  ".staging",
  ".backup",
  "movedExisting",
  "failedFile",
]) requireText(storage, marker, "atomic folder storage");

for (const marker of [
  "exportProductionPackage",
  "runManufacturingLayerAnalysis",
  'conflictPolicy: z.enum(["fail", "replace"])',
]) requireText(contract, marker, "strict production IPC");

rejectText(renderer, /node:fs|node:path|writeFile|rename\(/u, "renderer source");

for (const marker of [
  "An ordinary editing layer is not a physical part.",
  "no incomplete destination is called successful",
  "never emitted as SVG or DXF manufacturing artifacts",
]) requireText(documentation, marker, "production documentation");

if (
  !Array.isArray(golden.twoLayer?.roles) ||
  golden.twoLayer.roles.length !== 2 ||
  !Array.isArray(golden.threeLayer?.roles) ||
  golden.threeLayer.roles.length !== 3
) {
  throw new Error("M12 golden must retain representative two- and three-layer summaries.");
}

const forbidden = await Promise.all([
  source("packages/production-export/src/index.ts"),
  source("apps/desktop/electron/production-storage.ts"),
]).then((parts) => parts.join("\n"));
rejectText(forbidden, /\bG-?code\b|\bDWG\b|\btoolpath\b|\bnesting\b/iu, "production source");

console.log("Production package audit passed: explicit schema-v8 layers, preview exclusion, exact manifest, atomic storage, and no CAM surface.");
