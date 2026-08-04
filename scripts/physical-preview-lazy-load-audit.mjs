// M14 G4B lazy-load boundary audit.
//
// ADR 0024 section 5 requires the physical preview -- Three.js, React Three
// Fiber, the renderer adapter, and the preview UI -- to be a lazily-loaded
// chunk, never shipped in the main editor entry: "Editing, import, analysis,
// save, and export must not pay for the preview." This inspects the actual
// built renderer output, not source, so a regression that pulls Three into
// the eager bundle (an accidental non-dynamic import, a bundler
// misconfiguration) is caught mechanically instead of by review alone.
//
// Requires `apps/desktop/dist/renderer` to already exist (built via
// `pnpm build` / `vite build`); it does not build it itself, matching
// `audit:packaged-identity`'s existing convention of auditing prior output.

import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

// Three's own exported revision constant (`export const REVISION = '185'`,
// minified to `REVISION:()=>` by esbuild/Rollup's property-shorthand output).
// Load-bearing and unique to bundled Three.js output -- not a name any other
// dependency in this app happens to share.
const THREE_SIGNATURE = "REVISION:()=>";
const MAIN_ENTRY_PATTERN = /(?:^|[/\\])index-[^/\\]*\.js$/u;

const exists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

async function jsAssetFiles(assetsDir) {
  const entries = await readdir(assetsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => join(assetsDir, entry.name));
}

export async function auditPhysicalPreviewLazyLoad(rendererDistDir) {
  const failures = [];
  const assetsDir = join(rendererDistDir, "assets");

  if (!(await exists(assetsDir))) {
    failures.push(
      `${assetsDir} does not exist. Build the renderer first (e.g. \`pnpm build\`) before running this audit.`,
    );
    return failures;
  }

  const files = await jsAssetFiles(assetsDir);
  const mainEntryFiles = files.filter((file) => MAIN_ENTRY_PATTERN.test(file));
  if (mainEntryFiles.length === 0) {
    failures.push(`No main entry chunk (index-*.js) found in ${assetsDir}.`);
    return failures;
  }

  for (const file of mainEntryFiles) {
    const contents = await readFile(file, "utf8");
    if (contents.includes(THREE_SIGNATURE)) {
      failures.push(
        `${file} is the main editor entry chunk but contains Three.js. Editing, import, analysis, save, and export must not pay for the physical preview -- keep it behind a dynamic import().`,
      );
    }
  }

  const otherFiles = files.filter((file) => !mainEntryFiles.includes(file));
  let foundLazyThreeChunk = false;
  for (const file of otherFiles) {
    const contents = await readFile(file, "utf8");
    if (contents.includes(THREE_SIGNATURE)) {
      foundLazyThreeChunk = true;
      break;
    }
  }
  if (!foundLazyThreeChunk) {
    failures.push(
      `No separately-chunked asset in ${assetsDir} contains Three.js. Expected the physical preview to be code-split into its own lazily-loaded chunk.`,
    );
  }

  return failures;
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === import.meta.filename;

if (invokedDirectly) {
  const root = resolve(import.meta.dirname, "..");
  const distDir = resolve(root, "apps/desktop/dist/renderer");
  const failures = await auditPhysicalPreviewLazyLoad(distDir);
  if (failures.length > 0) {
    throw new Error(`Physical preview lazy-load audit failed:\n- ${failures.join("\n- ")}`);
  }
  console.log(
    "Physical preview lazy-load audit passed: the main editor entry chunk excludes Three.js, and the physical preview is code-split into its own lazily-loaded chunk.",
  );
}
