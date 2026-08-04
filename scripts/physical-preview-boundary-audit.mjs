// M14 physical-preview boundary audit (ADR 0024).
//
// Enforces the production exclusions and package boundaries mechanically, so a
// debug renderer handle, a bundled research fixture, or a forbidden dependency
// cannot reach production by surviving code review.
//
// The physical-preview packages are promoted in later M14 slices. Rules that
// depend on them apply only once they exist; this audit never asserts that an
// unbuilt package is present.

import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const failures = [];

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const exists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

/** Recursively collects source files under a directory, skipping build output. */
async function sourceFiles(dir) {
  const skipped = new Set(["node_modules", "dist", "build", "out", "coverage", ".vite"]);
  const found = [];
  const walk = async (current) => {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        if (!skipped.has(entry.name)) await walk(path);
      } else if (/\.(ts|tsx|js|jsx|mjs|cjs|html)$/u.test(entry.name)) {
        found.push(path);
      }
    }
  };
  await walk(dir);
  return found;
}

// Production source only. Test and fixture directories are deliberately out of
// scope: fixtures are expected to load from disk at test time.
const productionRoots = [
  "apps/desktop/src",
  "apps/desktop/electron",
  ...(await readdir(resolve(root, "packages"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => `packages/${entry.name}/src`),
];

const forbiddenPatterns = [
  {
    pattern: /__laserxPreviewLab/u,
    message:
      "the experiment benchmark hook exposes the live WebGLRenderer and must never ship (ADR 0024 §8)",
  },
  {
    pattern: /import\.meta\.glob\s*\(\s*["'`][^"'`]*fixtures\//u,
    message: "production code must not bundle fixture payloads (ADR 0024 §8)",
  },
  {
    pattern: /["'`][^"'`]*\.laserx\?raw["'`]/u,
    message: "production code must not inline .laserx payloads (ADR 0024 §8)",
  },
  {
    pattern: /\?fixture=/u,
    message: "the research fixture-selection surface must never ship (ADR 0024 §8)",
  },
];

for (const relativeRoot of productionRoots) {
  const absolute = resolve(root, relativeRoot);
  if (!(await exists(absolute))) continue;
  for (const file of await sourceFiles(absolute)) {
    const contents = await readFile(file, "utf8");
    for (const { pattern, message } of forbiddenPatterns) {
      if (pattern.test(contents)) {
        failures.push(`${relative(root, file)}: ${message}`);
      }
    }
  }
}

// No CAD kernel may enter any production package (ADR 0024 §4).
const forbiddenDependencies = [
  "replicad",
  "opencascade.js",
  "opencascade-js",
  "@jscad/modeling",
  "manifold-3d",
];
const manifests = [
  "apps/desktop/package.json",
  ...(await readdir(resolve(root, "packages"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => `packages/${entry.name}/package.json`),
];
for (const relativeManifest of manifests) {
  const absolute = resolve(root, relativeManifest);
  if (!(await exists(absolute))) continue;
  const manifest = JSON.parse(await readFile(absolute, "utf8"));
  const declared = {
    ...(manifest.dependencies ?? {}),
    ...(manifest.devDependencies ?? {}),
  };
  for (const forbidden of forbiddenDependencies) {
    if (forbidden in declared) {
      failures.push(
        `${relativeManifest}: ${forbidden} is a CAD kernel and is not adopted for M14 (ADR 0024 §4)`,
      );
    }
  }
}

// Package-boundary rules apply once the packages exist (ADR 0024 §2).
const boundaries = [
  {
    manifest: "packages/physical-preview-3d/package.json",
    forbidden: ["three", "react", "react-dom", "electron", "@react-three/fiber"],
    reason: "the pure scene contract must stay renderer-, React-, and Electron-independent",
  },
  {
    manifest: "packages/physical-preview-three/package.json",
    forbidden: ["react", "react-dom", "electron", "@react-three/fiber"],
    reason: "the renderer adapter must stay React- and Electron-independent",
  },
];
for (const { manifest: relativeManifest, forbidden, reason } of boundaries) {
  const absolute = resolve(root, relativeManifest);
  if (!(await exists(absolute))) continue;
  const manifest = JSON.parse(await readFile(absolute, "utf8"));
  const declared = {
    ...(manifest.dependencies ?? {}),
    ...(manifest.peerDependencies ?? {}),
  };
  for (const name of forbidden) {
    if (name in declared) {
      failures.push(`${relativeManifest}: ${reason} (ADR 0024 §2); found ${name}`);
    }
  }
}

// The decision record itself must remain accepted and keep its load-bearing
// commitments, matching how the other policy audits guard their ADRs.
const adrPath = resolve(root, "docs/decisions/0024-production-physical-3d-preview-boundary.md");
if (!(await exists(adrPath))) {
  failures.push("docs/decisions/0024-production-physical-3d-preview-boundary.md is missing");
} else {
  const adr = await readFile(adrPath, "utf8");
  // Phrases are matched whitespace-tolerantly: the ADR is hard-wrapped prose, so
  // an ordinary reflow must not be reported as a removed commitment.
  const phrase = (text) => new RegExp(text.split(/\s+/u).map(escapeRegExp).join("\\s+"), "u");
  const required = [
    [/## Status\s+Accepted for M14 G0\./u, "the accepted status"],
    [phrase("No CAD kernel is adopted for M14"), "the no-CAD-kernel decision"],
    [phrase("lazily-loaded chunk"), "the lazy-loading boundary"],
    [phrase("typed Electron preload/main IPC boundary"), "the privileged capture boundary"],
    [phrase("never merged wholesale"), "the component-by-component promotion rule"],
    [
      phrase("before the preview is wired to arbitrary user documents"),
      "the G1 precondition",
    ],
  ];
  for (const [pattern, description] of required) {
    if (!pattern.test(adr)) {
      failures.push(`ADR 0024 no longer records ${description}`);
    }
  }
}

if (failures.length > 0) {
  throw new Error(
    `Physical-preview boundary audit failed:\n- ${failures.join("\n- ")}`,
  );
}

console.log(
  "Physical-preview boundary audit passed: no experiment hook, fixture payload, fixture-selection surface, or CAD kernel in production source, and ADR 0024 remains accepted.",
);
