import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { auditPhysicalPreviewLazyLoad } from "./physical-preview-lazy-load-audit.mjs";

const THREE_SIGNATURE = "REVISION:()=>";

async function fixture({
  mainContainsThree = false,
  includeLazyThreeChunk = true,
  includeAssetsDir = true,
  includeMainEntry = true,
} = {}) {
  const root = await mkdtemp(join(tmpdir(), "laserx-lazy-load-audit-"));
  const distDir = join(root, "renderer");
  if (includeAssetsDir) {
    const assetsDir = join(distDir, "assets");
    await mkdir(assetsDir, { recursive: true });
    if (includeMainEntry) {
      await writeFile(
        join(assetsDir, "index-abc123.js"),
        mainContainsThree
          ? `console.log("editor entry");const t={${THREE_SIGNATURE}"185"};`
          : 'console.log("editor entry");',
        "utf8",
      );
    }
    if (includeLazyThreeChunk) {
      await writeFile(
        join(assetsDir, "PhysicalPreviewScreen-def456.js"),
        `const t={${THREE_SIGNATURE}"185"};console.log(t);`,
        "utf8",
      );
    } else {
      await writeFile(
        join(assetsDir, "PhysicalPreviewScreen-def456.js"),
        'console.log("no three here");',
        "utf8",
      );
    }
  }
  return { root, distDir };
}

async function runCase(options, expectedPattern) {
  const { root, distDir } = await fixture(options);
  try {
    const failures = await auditPhysicalPreviewLazyLoad(distDir);
    assert.equal(failures.length, 1, JSON.stringify(failures));
    assert.match(failures[0], expectedPattern);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function runPassingCase(options) {
  const { root, distDir } = await fixture(options);
  try {
    const failures = await auditPhysicalPreviewLazyLoad(distDir);
    assert.deepEqual(failures, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

await runCase(
  { mainContainsThree: true },
  /is the main editor entry chunk but contains Three\.js/u,
);

await runCase(
  { includeLazyThreeChunk: false },
  /No separately-chunked asset .* contains Three\.js/u,
);

await runCase(
  { includeAssetsDir: false },
  /does not exist\. Build the renderer first/u,
);

await runCase(
  { includeMainEntry: false },
  /No main entry chunk \(index-\*\.js\) found/u,
);

// Proves the audit does not fire on a correctly code-split build: the exact
// shape `pnpm build` produces today (verified against a real vite build
// during development of this audit).
await runPassingCase({});

console.log(
  "Physical preview lazy-load audit guard passed: every rule fires on the real failure it targets, and the audit does not fire on a correctly code-split build.",
);
