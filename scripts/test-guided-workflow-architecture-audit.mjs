import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { auditGuidedWorkflowArchitecture } from "./guided-workflow-architecture-audit.mjs";

const VALID_PURE_CONFIG = {
  extends: "../../tsconfig.base.json",
  compilerOptions: {
    target: "ES2023",
    module: "ESNext",
    lib: ["ES2023"],
    types: [],
    noEmit: true,
  },
  include: ["src/features/onboarding/guidedWorkflowState.ts"],
};

async function fixture({
  source = 'export const idle = { status: "idle" };',
  pureConfig = VALID_PURE_CONFIG,
  omitPureConfig = false,
} = {}) {
  const root = await mkdtemp(join(tmpdir(), "laserx-guided-workflow-boundary-"));
  const desktopRoot = join(root, "apps", "desktop");
  const featureRoot = join(desktopRoot, "src", "features", "onboarding");
  await mkdir(featureRoot, { recursive: true });
  await writeFile(join(featureRoot, "guidedWorkflowState.ts"), source, "utf8");
  if (!omitPureConfig) {
    await writeFile(
      join(desktopRoot, "tsconfig.onboarding-pure.json"),
      JSON.stringify(pureConfig, null, 2),
      "utf8",
    );
  }
  return root;
}

async function runCase(options, expectedPattern) {
  const root = await fixture(options);
  try {
    const failures = await auditGuidedWorkflowArchitecture(root);
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

// Clean baseline.
await runCase(undefined, null);

// Import boundary -- what a text scan genuinely can prove.
await runCase(
  { source: 'import { randomUUID } from "node:crypto";\nvoid randomUUID;' },
  /node: module/u,
);
await runCase({ source: 'export const id = require("node:crypto");' }, /CommonJS require/u);
await runCase(
  { source: 'import { BrowserWindow } from "electron";\nvoid BrowserWindow;' },
  /must not import electron/u,
);
await runCase(
  { source: 'import { useState } from "react";\nvoid useState;' },
  /must not import react/u,
);

// Bare Node built-ins resolve regardless of `types: []`, so the `node:`
// spelling alone is not the whole boundary.
await runCase({ source: 'import { readFile } from "fs";\nvoid readFile;' }, /bare specifier/u);
await runCase({ source: 'import { join } from "path";\nvoid join;' }, /bare specifier/u);
await runCase(
  { source: 'import { randomUUID } from "crypto";\nvoid randomUUID;' },
  /bare specifier/u,
);
await runCase(
  { source: 'import { readFile } from "fs/promises";\nvoid readFile;' },
  /bare specifier/u,
);

// Triple-slash directives re-add ambient libraries from inside the source,
// leaving the ES-only tsconfig untouched while DOM or Node types come back.
await runCase(
  { source: '/// <reference lib="dom" />\nexport const x = 1;' },
  /triple-slash reference directive/u,
);
await runCase(
  { source: '/// <reference types="node" />\nexport const x = 1;' },
  /triple-slash reference directive/u,
);

// The DOM/browser-global boundary is enforced by the ES-only typecheck, so
// what this audit must protect is the configuration that performs it. Each
// case below is a real way that enforcement could be silently weakened.
await runCase({ omitPureConfig: true }, /tsconfig\.onboarding-pure\.json is missing/u);
await runCase(
  {
    pureConfig: {
      ...VALID_PURE_CONFIG,
      compilerOptions: { ...VALID_PURE_CONFIG.compilerOptions, lib: ["ES2023", "DOM"] },
    },
  },
  /must not enable DOM libraries/u,
);
await runCase(
  {
    pureConfig: {
      ...VALID_PURE_CONFIG,
      compilerOptions: { ...VALID_PURE_CONFIG.compilerOptions, lib: ["ES2023", "DOM.Iterable"] },
    },
  },
  /must not enable DOM libraries/u,
);
await runCase(
  {
    pureConfig: {
      ...VALID_PURE_CONFIG,
      compilerOptions: { ...VALID_PURE_CONFIG.compilerOptions, types: ["node"] },
    },
  },
  /must not enable ambient types/u,
);
await runCase(
  {
    pureConfig: {
      ...VALID_PURE_CONFIG,
      compilerOptions: { ...VALID_PURE_CONFIG.compilerOptions, types: undefined },
    },
  },
  /must not enable ambient types/u,
);
await runCase(
  { pureConfig: { ...VALID_PURE_CONFIG, include: ["src/**/*.ts"] } },
  /must cover exactly the guided-workflow state module/u,
);

// The real production module and its real configuration must both pass --
// not just synthetic stand-ins.
const realFailures = await auditGuidedWorkflowArchitecture(resolve(import.meta.dirname, ".."));
assert.deepEqual(realFailures, []);

console.log(
  "Guided-workflow architecture regression tests passed: forbidden React/Electron/Node imports are rejected, every way of weakening the ES-only typecheck configuration is rejected, and the real module and configuration pass cleanly.",
);
