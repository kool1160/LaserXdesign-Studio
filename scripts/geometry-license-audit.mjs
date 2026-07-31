import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const geometryPackage = JSON.parse(
  await readFile(resolve(root, "packages/geometry/package.json"), "utf8"),
);
const expectedVersion = "2.0.1-18";
if (geometryPackage.dependencies?.["clipper2-ts"] !== expectedVersion) {
  throw new Error(`clipper2-ts must remain pinned to ${expectedVersion}.`);
}

const installedRoot = resolve(
  root,
  "packages/geometry/node_modules/clipper2-ts",
);
const installedPackage = JSON.parse(
  await readFile(resolve(installedRoot, "package.json"), "utf8"),
);
const installedLicense = await readFile(resolve(installedRoot, "LICENSE"), "utf8");
const reviewedLicense = await readFile(
  resolve(root, "packages/geometry/licenses/Boost-1.0.txt"),
  "utf8",
);

if (
  installedPackage.version !== expectedVersion ||
  installedPackage.license !== "BSL-1.0" ||
  !installedLicense.startsWith("Boost Software License - Version 1.0") ||
  installedLicense.trim() !== reviewedLicense.trim()
) {
  throw new Error("The installed geometry engine does not match the reviewed license record.");
}

console.log(
  `Geometry license audit passed for clipper2-ts ${expectedVersion} (BSL-1.0).`,
);
