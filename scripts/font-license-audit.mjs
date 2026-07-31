import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  await readFile(resolve(root, "packages/fonts/bundled-fonts.json"), "utf8"),
);
const packageJson = JSON.parse(
  await readFile(resolve(root, "packages/fonts/package.json"), "utf8"),
);
const licenseFiles = {
  "OFL-1.1": "OFL-1.1.txt",
  "Apache-2.0": "Apache-2.0.txt",
};
const requiredCategories = new Set([
  "stencil",
  "script",
  "serif",
  "slab",
  "western",
  "industrial",
  "display",
]);
const ids = new Set();

const ofl = await readFile(
  resolve(root, "packages/fonts/licenses/OFL-1.1.txt"),
  "utf8",
);
const apache = await readFile(
  resolve(root, "packages/fonts/licenses/Apache-2.0.txt"),
  "utf8",
);
if (!ofl.includes("SIL OPEN FONT LICENSE Version 1.1")) {
  throw new Error("The bundled OFL-1.1 license text is missing or invalid.");
}
if (!apache.includes("Apache License") || !apache.includes("Version 2.0")) {
  throw new Error("The bundled Apache-2.0 license text is missing or invalid.");
}
for (const record of manifest) {
  if (
    typeof record.id !== "string" ||
    typeof record.family !== "string" ||
    !(record.license in licenseFiles) ||
    typeof record.copyright !== "string" ||
    record.copyright.length === 0 ||
    !Array.isArray(record.categories) ||
    record.categories.length === 0
  ) {
    throw new Error("Every bundled font needs complete provenance metadata.");
  }
  if (ids.has(record.id)) {
    throw new Error(`Duplicate bundled font ID: ${record.id}`);
  }
  ids.add(record.id);
  if (packageJson.dependencies?.[record.package] !== record.version) {
    throw new Error(
      `${record.package} must be pinned to audited version ${record.version}.`,
    );
  }
  const upstreamMetadata = JSON.parse(
    await readFile(
      resolve(
        root,
        "packages/fonts/node_modules",
        record.package,
        "metadata.json",
      ),
      "utf8",
    ),
  );
  if (
    upstreamMetadata.license?.type !== record.license ||
    upstreamMetadata.license?.attribution !== record.copyright
  ) {
    throw new Error(
      `${record.package} license metadata does not match its installed audited package.`,
    );
  }
  for (const category of record.categories) {
    requiredCategories.delete(category);
  }
}
if (requiredCategories.size > 0) {
  throw new Error(
    `Bundled catalog lacks: ${[...requiredCategories].sort().join(", ")}`,
  );
}
console.log(`Font license audit passed for ${manifest.length} bundled families.`);
