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
  // Import checks alone would let `window.localStorage` or `document.body`
  // through, so the advertised no-DOM guarantee is enforced directly rather
  // than implied.
  //
  // Matching any *reference*, not just property access: `const root = document`
  // and `typeof window` are bypasses of a `\.`-anchored pattern but are exactly
  // the coupling this is meant to prevent. The trailing `(?![\w$:])` keeps
  // ordinary property names (`{ document: ... }`, `windowSize`) passing, and
  // the leading `(?<![.\w$])` keeps member access on the caller's own objects
  // (`host.document.title`) passing -- a guard that rejects legitimate code
  // gets switched off, which is worse than no guard.
  {
    pattern: /(?<![.\w$])window(?![\w$:])/u,
    message: "guided-workflow state must not reference the window global",
  },
  {
    pattern: /(?<![.\w$])document(?![\w$:])/u,
    message: "guided-workflow state must not reference the document global",
  },
  {
    pattern: /(?<![.\w$])(?:localStorage|sessionStorage)(?![\w$:])/u,
    message: "guided-workflow state must not reference browser storage",
  },
  {
    pattern: /(?<![.\w$])navigator(?![\w$:])/u,
    message: "guided-workflow state must not reference the navigator global",
  },
  {
    pattern: /(?<![.\w$])(?:globalThis|process)(?![\w$:])/u,
    message: "guided-workflow state must not reach for ambient globals",
  },
  {
    // Representative DOM types: a type-only dependency still couples this
    // module to a DOM lib it must compile without.
    pattern:
      /(?<![.\w$])(?:HTMLElement|HTMLInputElement|HTMLDivElement|Element|Document|Window|Node|NodeList|Event|EventTarget|DOMRect|MutationObserver)(?![\w$:])/u,
    message: "guided-workflow state must not reference a DOM type",
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
    "Guided-workflow architecture audit passed: the guided-workflow state module stays free of React, Electron, Node, and DOM/browser-global dependencies.",
  );
}
