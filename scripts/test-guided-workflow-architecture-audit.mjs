import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { auditGuidedWorkflowArchitecture } from "./guided-workflow-architecture-audit.mjs";

async function fixture(source = "export const idle = { status: \"idle\" };") {
  const root = await mkdtemp(join(tmpdir(), "laserx-guided-workflow-boundary-"));
  const featureRoot = join(root, "apps", "desktop", "src", "features", "onboarding");
  await mkdir(featureRoot, { recursive: true });
  await writeFile(join(featureRoot, "guidedWorkflowState.ts"), source, "utf8");
  return root;
}

async function runCase(source, expectedPattern) {
  const root = await fixture(source);
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

await runCase(undefined, null);
await runCase('import { randomUUID } from "node:crypto";\nvoid randomUUID;', /node: module/u);
await runCase('export const id = require("node:crypto");', /CommonJS require/u);
await runCase('import { BrowserWindow } from "electron";\nvoid BrowserWindow;', /must not import electron/u);
await runCase('import { useState } from "react";\nvoid useState;', /must not import react/u);

// The real production module must itself pass -- proves the audit doesn't
// false-positive on the actual guided-workflow state machine, not just on a
// synthetic clean fixture.
const realFailures = await auditGuidedWorkflowArchitecture(resolve(import.meta.dirname, ".."));
assert.deepEqual(realFailures, []);

console.log(
  "Guided-workflow architecture regression tests passed: forbidden React/Electron/Node dependencies are rejected, and the real production module passes cleanly.",
);
