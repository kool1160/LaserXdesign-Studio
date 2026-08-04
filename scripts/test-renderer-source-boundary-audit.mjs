import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { auditRendererSourceBoundary } from "./renderer-source-boundary-audit.mjs";

async function fixture({ source = "export const decode = atob;", productionTypes = [] } = {}) {
  const root = await mkdtemp(join(tmpdir(), "laserx-renderer-boundary-"));
  const packageRoot = join(root, "packages", "physical-preview-three");
  await mkdir(join(packageRoot, "src"), { recursive: true });
  await mkdir(join(packageRoot, "tests"), { recursive: true });
  await writeFile(join(packageRoot, "src", "index.ts"), source, "utf8");
  // Node imports remain valid in tests; only production source is scanned.
  await writeFile(
    join(packageRoot, "tests", "fixture.test.ts"),
    'import { deflateSync } from "node:zlib";\nvoid deflateSync;\n',
    "utf8",
  );
  await writeFile(
    join(packageRoot, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: { lib: ["ES2023", "DOM"], types: productionTypes },
        include: ["src/**/*.ts"],
      },
      null,
      2,
    ),
    "utf8",
  );
  await writeFile(
    join(packageRoot, "tsconfig.test.json"),
    JSON.stringify(
      {
        compilerOptions: { types: ["node"] },
        include: ["src/**/*.ts", "tests/**/*.ts"],
      },
      null,
      2,
    ),
    "utf8",
  );
  return root;
}

async function runCase(options, expectedPattern) {
  const root = await fixture(options);
  try {
    const failures = await auditRendererSourceBoundary(root);
    if (expectedPattern === null) {
      assert.deepEqual(failures, []);
    } else {
      assert.ok(
        failures.some((failure) => expectedPattern.test(failure)),
        `Expected ${String(expectedPattern)} in:\n${failures.join("\n")}`,
      );
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

await runCase(undefined, null);
await runCase(
  { source: 'import { deflateSync } from "node:zlib";\nvoid deflateSync;' },
  /node: module/u,
);
await runCase({ source: 'export const bytes = Buffer.from("x");' }, /Buffer global/u);
await runCase({ source: "export const mode = process.env.NODE_ENV;" }, /process global/u);
await runCase({ source: 'export const fs = require("fs");' }, /CommonJS require/u);
await runCase({ productionTypes: ["node"] }, /must not enable Node globals/u);

console.log(
  "Renderer-source boundary regression tests passed: Node imports/globals and Node-enabled production typing are rejected, while test-only Node utilities remain allowed.",
);
