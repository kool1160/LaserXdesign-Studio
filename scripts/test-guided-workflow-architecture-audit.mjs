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

// DOM and ambient globals: reachable without any import, so the no-DOM
// guarantee has to be checked directly rather than inferred from imports.
await runCase("export const w = window.innerWidth;", /window global/u);
await runCase('export const el = document.getElementById("x");', /document global/u);
await runCase('export const v = localStorage.getItem("k");', /browser storage/u);
await runCase('export const v = sessionStorage["k"];', /browser storage/u);
await runCase("export const ua = navigator.userAgent;", /navigator global/u);
await runCase("export const g = globalThis.crypto;", /ambient globals/u);
await runCase("export const mode = process.env.NODE_ENV;", /ambient globals/u);

// Bare references and typeof bypass any pattern anchored on property access,
// yet are exactly the coupling being prevented.
await runCase("export const root = document;", /document global/u);
await runCase('export const hasDom = typeof window !== "undefined";', /window global/u);
await runCase("export const storage = localStorage;", /browser storage/u);
await runCase("export function f(target: EventTarget): void { void target; }", /DOM type/u);
await runCase("export function f(el: HTMLElement): void { void el; }", /DOM type/u);
await runCase("export let node: Node | null = null;", /DOM type/u);

// Must NOT fire on ordinary identifiers that merely contain a global's name,
// or on property accesses of the caller's own objects -- a guard that blocks
// legitimate code gets disabled, which is worse than no guard.
await runCase(
  [
    "interface Options { windowSize: number; documentId: string; nodeCount: number; }",
    "export function read(options: Options, host: { document: { title: string } }): string {",
    "  void options.windowSize;",
    "  void options.documentId;",
    "  void options.nodeCount;",
    "  return host.document.title;",
    "}",
  ].join("\n"),
  null,
);

// The real production module must itself pass -- proves the audit doesn't
// false-positive on the actual guided-workflow state machine, not just on a
// synthetic clean fixture.
const realFailures = await auditGuidedWorkflowArchitecture(resolve(import.meta.dirname, ".."));
assert.deepEqual(realFailures, []);

console.log(
  "Guided-workflow architecture regression tests passed: forbidden React/Electron/Node imports and DOM/ambient globals are rejected, ordinary identifiers that merely contain a global's name are allowed, and the real production module passes cleanly.",
);
