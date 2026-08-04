// Negative probes for the M14 physical-preview boundary audit (ADR 0024).
//
// A guard that cannot fail is worthless, so every rule the audit claims to
// enforce is proven here against the *actual* accepted research patterns from
// `apps/physical-3d-preview-lab` — not synthetic literal variants. The
// false-positive probes matter just as much: a guard that fires on ordinary
// production code would be turned off.

import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

import { auditPhysicalPreviewBoundary } from "./physical-preview-boundary-audit.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const adrRelativePath = "docs/decisions/0024-production-physical-3d-preview-boundary.md";
const realAdr = await import("node:fs/promises").then((fs) =>
  fs.readFile(resolve(repositoryRoot, adrRelativePath), "utf8"),
);

/**
 * Removes a commitment from the ADR text.
 *
 * The ADR is hard-wrapped, so several of these phrases contain a newline. A
 * literal `String.replace` would silently be a no-op and the probe would pass
 * while proving nothing, so removal is whitespace-tolerant exactly like the
 * audit's own matching.
 */
function withoutPhrase(text, wording) {
  const pattern = new RegExp(
    wording
      .split(/\s+/u)
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
      .join("\\s+"),
    "gu",
  );
  assert.ok(pattern.test(text), `probe wording not present in the ADR: ${wording}`);
  return text.replace(pattern, "REMOVED");
}

/** Builds a throwaway repository containing a valid ADR plus the given files. */
async function withRepository(files, assertions) {
  const root = await mkdtemp(resolve(tmpdir(), "laserx-preview-audit-"));
  try {
    const contents = { [adrRelativePath]: realAdr, ...files };
    for (const [relativePath, body] of Object.entries(contents)) {
      if (body === null) continue;
      const absolute = resolve(root, relativePath);
      await mkdir(dirname(absolute), { recursive: true });
      await writeFile(absolute, body, "utf8");
    }
    await assertions(await auditPhysicalPreviewBoundary(root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const rejects = async (label, files, expected) => {
  await withRepository(files, (failures) => {
    assert.ok(
      failures.some((failure) => expected.test(failure)),
      `${label}: expected a failure matching ${String(expected)}, got ${JSON.stringify(failures)}`,
    );
  });
};

const accepts = async (label, files) => {
  await withRepository(files, (failures) => {
    assert.deepEqual(failures, [], `${label}: expected no failures, got ${JSON.stringify(failures)}`);
  });
};

// --- Baseline -------------------------------------------------------------

await accepts("a repository with no preview code yet", {});

// The preview packages do not exist during G0. Their absence must never be
// reported, so the audit cannot become a fake check for unbuilt packages.
await accepts("absent preview packages", {
  "packages/domain/src/index.ts": "export const canonical = true;\n",
  "apps/desktop/package.json": JSON.stringify({ name: "@laserx/desktop" }),
});

// --- ADR 0024 §8: research payloads and selectors --------------------------

await rejects(
  "the benchmark hook",
  { "apps/desktop/src/preview.ts": "export const r = window.__laserxPreviewLab;\n" },
  /benchmark hook/u,
);

// The real lab glob puts its path argument on the following line.
await rejects(
  "the accepted fixture glob",
  {
    "apps/desktop/src/load.ts":
      'const FIXTURE_SOURCES: Record<string, string> = import.meta.glob(\n  "../../../fixtures/physical-preview/*.laserx",\n  { query: "?raw", eager: true },\n);\n',
  },
  /must not bundle fixture payloads/u,
);

await rejects(
  "an inlined .laserx payload",
  { "apps/desktop/src/load.ts": 'import project from "./sample.laserx?raw";\n' },
  /must not inline \.laserx payloads/u,
);

await rejects(
  "a literal ?fixture= surface",
  { "apps/desktop/src/help.ts": 'export const url = "/?fixture=two-layer";\n' },
  /fixture\/material selection surface/u,
);

// The real selectors from loadFixtureProject.ts and materialSelection.ts.
await rejects(
  "the accepted URLSearchParams fixture selector",
  {
    "apps/desktop/src/select.ts":
      'export function fixtureKeyFromLocation(search: string): string | null {\n  const requested = new URLSearchParams(search).get("fixture");\n  return requested;\n}\n',
  },
  /URL-search-param fixture\/material selection/u,
);

await rejects(
  "the accepted URLSearchParams material selector",
  {
    "apps/desktop/src/select.ts":
      'export function requestedMaterialFromLocation(search: string): string | null {\n  return new URLSearchParams(search).get("material");\n}\n',
  },
  /URL-search-param fixture\/material selection/u,
);

// False-positive probe: an ordinary Map lookup keyed "material" is not a
// selector. The lab itself contains `materialByLayerId.get(...)` calls.
await accepts("an ordinary map lookup named material", {
  "apps/desktop/src/materials.ts":
    'const byId = new Map<string, string>();\nexport const chosen = byId.get("material");\n',
});

await rejects(
  "a static import from repository fixtures",
  { "apps/desktop/src/load.ts": 'import project from "../../../fixtures/projects/demo.laserx";\n' },
  /must not import or reference repository fixtures/u,
);

await rejects(
  "a new URL() reference into fixtures",
  {
    "apps/desktop/src/load.ts":
      'const asset = new URL("../../../fixtures/physical-preview/two-layer.laserx", import.meta.url);\n',
  },
  /must not import or reference repository fixtures/u,
);

await rejects(
  "a fixture registry import",
  { "apps/desktop/src/panel.ts": 'import { fixtureByKey } from "./fixtureRegistry";\n' },
  /fixture registry/u,
);

await rejects(
  "a research payload copied into static assets",
  { "apps/desktop/public/samples/demo.laserx": '{"schemaVersion":9}\n' },
  /must not ship as static assets/u,
);

// Build and packaging surfaces can copy payloads without touching app source.
await rejects(
  "a packaging config copying fixtures",
  {
    "apps/desktop/electron-builder.config.cjs":
      'module.exports = { extraResources: [{ from: "../../fixtures/physical-preview", to: "fixtures" }] };\n',
  },
  /must not copy repository fixtures into production output/u,
);

await rejects(
  "a vite config copying fixtures into the bundle",
  {
    "apps/desktop/vite.config.ts":
      'export default { publicDir: "../../fixtures/physical-preview" };\n',
  },
  /must not copy repository fixtures into production output/u,
);

// --- ADR 0024 §4: no CAD kernel, in any dependency field -------------------

for (const field of [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
]) {
  await rejects(
    `a CAD kernel hidden in ${field}`,
    {
      "packages/geometry/package.json": JSON.stringify({
        name: "@laserx/geometry",
        [field]: { replicad: "1.0.0" },
      }),
    },
    /replicad is a CAD kernel/u,
  );
}

// --- ADR 0024 §2 and §3: package boundaries --------------------------------

const pureManifest = (extra) =>
  JSON.stringify({ name: "@laserx/physical-preview-3d", ...extra });
const adapterManifest = (extra) =>
  JSON.stringify({ name: "@laserx/physical-preview-three", ...extra });

await rejects(
  "catalog coupling in the pure scene contract",
  {
    "packages/physical-preview-3d/package.json": pureManifest({
      dependencies: { "@laserx/material-catalog": "workspace:*" },
    }),
  },
  // Matched on package and field rather than the reason prose, so rewording the
  // message cannot silently turn this probe into a no-op.
  /@laserx\/material-catalog in dependencies/u,
);

await rejects(
  "production-export in the pure scene contract",
  {
    "packages/physical-preview-3d/package.json": pureManifest({
      dependencies: { "@laserx/production-export": "workspace:*" },
    }),
  },
  /@laserx\/production-export/u,
);

// project-format is test/tool-only for the scene package, but it is not a
// renderer-unsafe coupling, so it must not be rejected outright.
await accepts("project-format as a devDependency of the pure package", {
  "packages/physical-preview-3d/package.json": pureManifest({
    devDependencies: { "@laserx/project-format": "workspace:*" },
  }),
});

await rejects(
  "drei in the pure scene contract",
  {
    "packages/physical-preview-3d/package.json": pureManifest({
      dependencies: { "@react-three/drei": "10.7.7" },
    }),
  },
  /@react-three\/drei/u,
);

await rejects(
  "drei in the renderer adapter",
  {
    "packages/physical-preview-three/package.json": adapterManifest({
      dependencies: { "@react-three/drei": "10.7.7" },
    }),
  },
  /@react-three\/drei/u,
);

// Field coverage: a renderer or React coupling counts wherever it is declared.
await rejects(
  "three as a devDependency of the pure package",
  {
    "packages/physical-preview-3d/package.json": pureManifest({
      devDependencies: { three: "0.185.1" },
    }),
  },
  /found three in devDependencies/u,
);

await rejects(
  "react hidden in optionalDependencies of the adapter",
  {
    "packages/physical-preview-three/package.json": adapterManifest({
      optionalDependencies: { react: "19.2.8" },
    }),
  },
  /found react in optionalDependencies/u,
);

await rejects(
  "fiber hidden in peerDependencies of the pure package",
  {
    "packages/physical-preview-3d/package.json": pureManifest({
      peerDependencies: { "@react-three/fiber": "9.7.0" },
    }),
  },
  /@react-three\/fiber in peerDependencies/u,
);

// The adapter legitimately depends on three; that must not be rejected.
await accepts("three in the renderer adapter", {
  "packages/physical-preview-three/package.json": adapterManifest({
    dependencies: { three: "0.185.1", "@laserx/physical-preview-3d": "workspace:*" },
  }),
});

// --- ADR 0024 commitments --------------------------------------------------

for (const [label, removed] of [
  ["the no-CAD-kernel decision", "No CAD kernel is adopted for M14"],
  ["the lazy-loading boundary", "lazily-loaded chunk"],
  ["the privileged capture boundary", "typed Electron preload/main IPC boundary"],
  ["the component-by-component promotion rule", "never merged wholesale"],
  ["the G1 precondition", "before the preview is wired to arbitrary user documents"],
  ["the no-drei decision", "`@react-three/drei` is **not adopted**"],
]) {
  await rejects(
    `removing ${label} from the ADR`,
    { [adrRelativePath]: withoutPhrase(realAdr, removed) },
    /ADR 0024 no longer records/u,
  );
}

await rejects(
  "a missing ADR",
  { [adrRelativePath]: null },
  /0024-production-physical-3d-preview-boundary\.md is missing/u,
);

console.log(
  "Physical-preview boundary audit regression tests passed: the accepted research selectors, fixture payload/registry/static-asset ingress, packaging-config copies, CAD kernels in every dependency field, catalog/drei/React/renderer package couplings, and ADR commitment removal are all rejected, while ordinary production code and the adapter's legitimate three dependency are not.",
);
