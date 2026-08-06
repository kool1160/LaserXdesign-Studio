// M15 G0 guided-workflow architecture boundary audit (ADR 0027).
//
// guidedWorkflowState.ts must stay pure and framework-agnostic: no React, no
// DOM/Electron, no node: import. This is what lets it be tested in isolation
// now and reused unmodified once a later gate wires it into a real shell,
// without accidentally coupling guided-workflow state to Electron privilege
// or to React internals.

import { readFile, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";

const exists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

const FORBIDDEN_GUIDED_WORKFLOW_SOURCE = [
  {
    pattern: /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["'`]node:/u,
    message: "guided-workflow state must not import a node: module",
  },
  {
    pattern: /\brequire\s*\(/u,
    message: "guided-workflow state must not call CommonJS require",
  },
  {
    pattern: /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["'`]electron["'`]/u,
    message: "guided-workflow state must not import electron",
  },
  {
    pattern: /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["'`]react/u,
    message: "guided-workflow state must not import react",
  },
];

export async function auditGuidedWorkflowArchitecture(root) {
  const failures = [];
  const sourcePath = resolve(
    root,
    "apps/desktop/src/features/onboarding/guidedWorkflowState.ts",
  );

  if (!(await exists(sourcePath))) {
    failures.push("apps/desktop/src/features/onboarding/guidedWorkflowState.ts is missing");
    return failures;
  }

  const contents = await readFile(sourcePath, "utf8");
  for (const { pattern, message } of FORBIDDEN_GUIDED_WORKFLOW_SOURCE) {
    if (pattern.test(contents)) {
      failures.push(`${relative(root, sourcePath).replace(/\\/gu, "/")}: ${message}`);
    }
  }

  // The DOM/browser-global boundary is enforced by compiling this module
  // against ES libraries only (`pnpm audit:guided-workflow-types`). A finite
  // pattern list could never cover every global -- `self`, `location`,
  // `indexedDB`, `KeyboardEvent`, `Storage` and the rest -- and would silently
  // overclaim the moment a new one appeared. What this audit can usefully do
  // is prove the configuration that performs the enforcement still exists and
  // has not been weakened.
  const pureConfigPath = resolve(root, "apps/desktop/tsconfig.onboarding-pure.json");
  if (!(await exists(pureConfigPath))) {
    failures.push("apps/desktop/tsconfig.onboarding-pure.json is missing");
    return failures;
  }

  let config;
  try {
    config = JSON.parse(await readFile(pureConfigPath, "utf8"));
  } catch {
    failures.push("apps/desktop/tsconfig.onboarding-pure.json is not valid JSON");
    return failures;
  }

  const libs = config.compilerOptions?.lib ?? [];
  const types = config.compilerOptions?.types;
  const include = config.include ?? [];

  if (libs.some((lib) => String(lib).toUpperCase().startsWith("DOM"))) {
    failures.push("apps/desktop/tsconfig.onboarding-pure.json must not enable DOM libraries");
  }
  if (!Array.isArray(types) || types.length > 0) {
    failures.push("apps/desktop/tsconfig.onboarding-pure.json must not enable ambient types");
  }
  if (
    include.length !== 1 ||
    !String(include[0]).includes("features/onboarding/guidedWorkflowState.ts")
  ) {
    failures.push(
      "apps/desktop/tsconfig.onboarding-pure.json must cover exactly the guided-workflow state module",
    );
  }

  return failures;
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === import.meta.filename;

if (invokedDirectly) {
  const failures = await auditGuidedWorkflowArchitecture(resolve(import.meta.dirname, ".."));
  if (failures.length > 0) {
    throw new Error(`Guided-workflow architecture audit failed:\n- ${failures.join("\n- ")}`);
  }
  console.log(
    "Guided-workflow architecture audit passed: the guided-workflow state module imports no React, Electron, or node: module, and its ES-only typecheck configuration remains free of DOM libraries and ambient types.",
  );
}
