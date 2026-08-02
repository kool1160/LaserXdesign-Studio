const { readFileSync } = require("node:fs");
const { join, resolve } = require("node:path");

const [, , asarArgument, expectedVersion] = process.argv;
if (asarArgument === undefined || expectedVersion === undefined) {
  throw new Error("Usage: electron verify-packaged-app-identity.cjs <app.asar> <expected-version>");
}

const asarPath = resolve(asarArgument);
const packagedMetadata = JSON.parse(
  readFileSync(join(asarPath, "package.json"), "utf8"),
);
const expected = {
  name: "@laserx/desktop",
  productName: "LaserX Design Studio",
  version: expectedVersion,
};
for (const [field, value] of Object.entries(expected)) {
  if (packagedMetadata[field] !== value) {
    throw new Error(
      `Packaged app.asar/package.json ${field} mismatch: expected ${value}, observed ${String(packagedMetadata[field])}.`,
    );
  }
}

console.log(
  `Packaged app identity passed: ${expected.productName} ${expected.version} (${expected.name}).`,
);
process.exit(0);
