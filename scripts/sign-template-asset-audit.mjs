import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(
  resolve(root, "packages/sign-tools/sign-assets.json"),
  "utf8",
));
const fontManifest = JSON.parse(await readFile(
  resolve(root, "packages/fonts/bundled-fonts.json"),
  "utf8",
));
const presetSource = await readFile(
  resolve(root, "packages/sign-tools/src/presets.ts"),
  "utf8",
);

if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.provenance) || !Array.isArray(manifest.presets)) {
  throw new Error("The sign-asset manifest must use reviewed schema version 1.");
}
const fontById = new Map(fontManifest.map((font) => [font.id, font]));
const provenanceById = new Map();
for (const record of manifest.provenance) {
  if (
    typeof record.id !== "string" ||
    typeof record.source !== "string" ||
    typeof record.license !== "string" ||
    provenanceById.has(record.id)
  ) {
    throw new Error("Every sign asset needs unique, complete provenance metadata.");
  }
  provenanceById.set(record.id, record);
  if (!presetSource.includes(`id: "${record.id}"`)) {
    throw new Error(`Runtime provenance is missing manifest asset ${record.id}.`);
  }
  if (record.kind === "bundled-font") {
    const font = fontById.get(record.id);
    if (font === undefined || font.license !== record.license) {
      throw new Error(`Template font ${record.id} does not match the audited bundled-font catalog.`);
    }
    if (typeof record.licenseFile !== "string") {
      throw new Error(`Template font ${record.id} requires a repository license file.`);
    }
    await access(resolve(root, record.licenseFile));
  } else if (record.kind !== "algorithmic-geometry" || record.license !== "LaserX-original") {
    throw new Error(`Unsupported template asset provenance for ${record.id}.`);
  }
}
const presetIds = new Set();
for (const preset of manifest.presets) {
  if (
    typeof preset.id !== "string" ||
    typeof preset.fontId !== "string" ||
    presetIds.has(preset.id) ||
    !fontById.has(preset.fontId) ||
    !Array.isArray(preset.provenanceIds) ||
    !preset.provenanceIds.includes(preset.fontId) ||
    !preset.provenanceIds.includes("laserx:algorithmic-sign-primitives-v1") ||
    preset.provenanceIds.some((id) => !provenanceById.has(id))
  ) {
    throw new Error("Every sign preset must reference one audited font and original geometry provenance.");
  }
  presetIds.add(preset.id);
  if (
    !presetSource.includes(`id: "${preset.id}"`) ||
    !presetSource.includes(`fontId: "${preset.fontId}"`)
  ) {
    throw new Error(`Runtime preset ${preset.id} does not match the audited manifest.`);
  }
}

console.log(
  `Sign template asset audit passed for ${manifest.presets.length} presets and ${manifest.provenance.length} provenance records.`,
);
