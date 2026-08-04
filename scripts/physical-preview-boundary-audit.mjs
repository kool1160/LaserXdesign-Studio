// M14 physical-preview boundary audit (ADR 0024).
//
// Enforces the production exclusions and package boundaries mechanically, so a
// debug renderer handle, a bundled research fixture, a fixture selector, or a
// forbidden dependency cannot reach production by surviving code review.
//
// The physical-preview packages are promoted in later M14 slices. Rules that
// depend on them apply only once they exist; this audit never asserts that an
// unbuilt package is present.
//
// `auditPhysicalPreviewBoundary` is exported so the negative probes in
// `test-physical-preview-boundary-audit.mjs` can prove each rule actually
// fails on the real accepted research patterns.

import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/** Whitespace-tolerant phrase match: hard-wrapped prose must not read as a removed commitment. */
const phrase = (text) => new RegExp(text.split(/\s+/u).map(escapeRegExp).join("\\s+"), "u");

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

/**
 * Every dependency field is inspected. A forbidden runtime coupling is a
 * violation wherever it is declared: `devDependencies` and
 * `optionalDependencies` install just as really as `dependencies`, and the
 * pure scene contract must not need a renderer even to run its own tests.
 */
const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

const declaredDependencies = (manifest) => {
  const declared = new Map();
  for (const field of DEPENDENCY_FIELDS) {
    for (const name of Object.keys(manifest[field] ?? {})) {
      if (!declared.has(name)) declared.set(name, field);
    }
  }
  return declared;
};

// Patterns that must never appear in production source (ADR 0024 §8).
// Each entry is checked per file; `requires` adds a same-file precondition so a
// precise rule does not fire on ordinary code.
const FORBIDDEN_SOURCE_PATTERNS = [
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
    pattern: /\?(?:fixture|material)=/u,
    message: "the research fixture/material selection surface must never ship (ADR 0024 §8)",
  },
  {
    // The accepted lab selects research fixtures with
    // `new URLSearchParams(search).get("fixture")` and materials with
    // `.get("material")`. Requiring a search-param source in the same file
    // keeps an ordinary `someMap.get("material")` from being flagged.
    pattern: /\.get\(\s*["'`](?:fixture|material)["'`]\s*\)/u,
    requires: /URLSearchParams|location\.search|useSearchParams/u,
    message:
      "URL-search-param fixture/material selection must never ship (ADR 0024 §8)",
  },
  {
    pattern:
      /(?:\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(\s*|new\s+URL\s*\(\s*)["'`][^"'`]*\bfixtures\//u,
    message:
      "production code must not import or reference repository fixtures (ADR 0024 §8)",
  },
  {
    pattern: /\bfixtureRegistry\b|\bloadFixtureProject\b|\bfixtureByKey\b/u,
    message: "the research fixture registry must never ship (ADR 0024 §8)",
  },
];

const FORBIDDEN_CAD_KERNELS = [
  "replicad",
  "opencascade.js",
  "opencascade-js",
  "@jscad/modeling",
  "manifold-3d",
];

// Package boundaries (ADR 0024 §2 and §3). Applied only once a package exists.
const PACKAGE_BOUNDARIES = [
  {
    manifest: "packages/physical-preview-3d/package.json",
    forbidden: [
      "three",
      "react",
      "react-dom",
      "electron",
      "@react-three/fiber",
      "@react-three/drei",
      "@laserx/material-catalog",
      // Imports `node:crypto`, so it cannot enter the lazily loaded renderer
      // chunk. The physical-layer predicate is replicated in the scene package
      // rather than imported from here.
      "@laserx/production-export",
    ],
    reason:
      "the pure scene contract must stay renderer-, React-, Electron-, catalog-, and Node-crypto-independent",
  },
  {
    manifest: "packages/physical-preview-three/package.json",
    forbidden: [
      "react",
      "react-dom",
      "electron",
      "@react-three/fiber",
      "@react-three/drei",
    ],
    reason: "the renderer adapter must stay React- and Electron-independent",
  },
];

// Build and packaging configs reference paths as ordinary config values
// (`{ from: "../../fixtures/..." }`), not as imports, so they get a broader
// rule than application source: any quoted repository fixtures path at all.
const FORBIDDEN_CONFIG_PATTERNS = [
  {
    pattern: /["'`][^"'`]*\bfixtures\//u,
    message:
      "build/packaging configuration must not copy repository fixtures into production output (ADR 0024 §8)",
  },
];

// Build, packaging, and static-asset surfaces that can copy research payloads
// into production output without appearing in application source.
const PRODUCTION_CONFIG_FILES = [
  "apps/desktop/vite.config.ts",
  "apps/desktop/build.mjs",
  "apps/desktop/electron-builder.config.cjs",
  "apps/desktop/index.html",
];

export async function auditPhysicalPreviewBoundary(root) {
  const failures = [];

  const packageDirectories = (await exists(resolve(root, "packages")))
    ? (await readdir(resolve(root, "packages"), { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : [];

  // Production source only. Test and fixture directories are deliberately out
  // of scope: fixtures are expected to load from disk at test time.
  const productionRoots = [
    "apps/desktop/src",
    "apps/desktop/electron",
    ...packageDirectories.map((name) => `packages/${name}/src`),
  ];

  const scanned = [];
  for (const relativeRoot of productionRoots) {
    const absolute = resolve(root, relativeRoot);
    if (!(await exists(absolute))) continue;
    for (const file of await sourceFiles(absolute)) scanned.push({ file, isConfig: false });
  }
  for (const relativeConfig of PRODUCTION_CONFIG_FILES) {
    const absolute = resolve(root, relativeConfig);
    if (await exists(absolute)) scanned.push({ file: absolute, isConfig: true });
  }

  for (const { file, isConfig } of scanned) {
    const contents = await readFile(file, "utf8");
    const rules = isConfig
      ? [...FORBIDDEN_SOURCE_PATTERNS, ...FORBIDDEN_CONFIG_PATTERNS]
      : FORBIDDEN_SOURCE_PATTERNS;
    const reported = new Set();
    for (const { pattern, requires, message } of rules) {
      if (requires !== undefined && !requires.test(contents)) continue;
      if (pattern.test(contents) && !reported.has(message)) {
        reported.add(message);
        failures.push(`${relative(root, file).replace(/\\/gu, "/")}: ${message}`);
      }
    }
  }

  // No research project payload may be copied through the static asset folder.
  const publicDir = resolve(root, "apps/desktop/public");
  if (await exists(publicDir)) {
    const walk = async (current) => {
      for (const entry of await readdir(current, { withFileTypes: true })) {
        const path = join(current, entry.name);
        if (entry.isDirectory()) await walk(path);
        else if (entry.name.endsWith(".laserx")) {
          failures.push(
            `${relative(root, path).replace(/\\/gu, "/")}: research project payloads must not ship as static assets (ADR 0024 §8)`,
          );
        }
      }
    };
    await walk(publicDir);
  }

  // No CAD kernel may enter any production package (ADR 0024 §4).
  const manifests = [
    "apps/desktop/package.json",
    ...packageDirectories.map((name) => `packages/${name}/package.json`),
  ];
  for (const relativeManifest of manifests) {
    const absolute = resolve(root, relativeManifest);
    if (!(await exists(absolute))) continue;
    const declared = declaredDependencies(JSON.parse(await readFile(absolute, "utf8")));
    for (const forbidden of FORBIDDEN_CAD_KERNELS) {
      const field = declared.get(forbidden);
      if (field !== undefined) {
        failures.push(
          `${relativeManifest}: ${forbidden} is a CAD kernel and is not adopted for M14 (ADR 0024 §4); found in ${field}`,
        );
      }
    }
  }

  for (const { manifest: relativeManifest, forbidden, reason } of PACKAGE_BOUNDARIES) {
    const absolute = resolve(root, relativeManifest);
    if (!(await exists(absolute))) continue;
    const declared = declaredDependencies(JSON.parse(await readFile(absolute, "utf8")));
    for (const name of forbidden) {
      const field = declared.get(name);
      if (field !== undefined) {
        failures.push(
          `${relativeManifest}: ${reason} (ADR 0024 §2); found ${name} in ${field}`,
        );
      }
    }
  }

  // The decision record itself must remain accepted and keep its load-bearing
  // commitments, matching how the other policy audits guard their ADRs.
  const adrPath = resolve(root, "docs/decisions/0024-production-physical-3d-preview-boundary.md");
  if (!(await exists(adrPath))) {
    failures.push("docs/decisions/0024-production-physical-3d-preview-boundary.md is missing");
  } else {
    // Emphasis and code markers are stripped before matching so that moving a
    // `**bold**` span or a backtick does not read as a removed commitment;
    // only the words themselves are load-bearing.
    const adr = (await readFile(adrPath, "utf8")).replace(/[*`_]/gu, "");
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
      [phrase("@react-three/drei is not adopted"), "the no-drei decision"],
    ];
    for (const [pattern, description] of required) {
      if (!pattern.test(adr)) {
        failures.push(`ADR 0024 no longer records ${description}`);
      }
    }
  }

  return failures;
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === import.meta.filename;

if (invokedDirectly) {
  const failures = await auditPhysicalPreviewBoundary(resolve(import.meta.dirname, ".."));
  if (failures.length > 0) {
    throw new Error(`Physical-preview boundary audit failed:\n- ${failures.join("\n- ")}`);
  }
  console.log(
    "Physical-preview boundary audit passed: no experiment hook, fixture payload, fixture/material selector, fixture registry, or CAD kernel in production source or build surfaces, forbidden package couplings rejected across every dependency field, and ADR 0024 remains accepted.",
  );
}
