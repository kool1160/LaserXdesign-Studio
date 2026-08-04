// M14 G4A renderer-source boundary audit.
//
// The Three adapter is imported into the lazily loaded renderer feature. Its
// production source must therefore compile against browser APIs only. Node
// utilities remain allowed in tests, Electron main/preload code, and build
// scripts, but never in packages/physical-preview-three/src.

import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const exists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

async function sourceFiles(dir) {
  const found = [];
  const walk = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (/\.(?:ts|tsx|js|jsx|mjs|cjs)$/u.test(entry.name)) found.push(path);
    }
  };
  if (await exists(dir)) await walk(dir);
  return found;
}

const FORBIDDEN_RENDERER_SOURCE = [
  {
    pattern: /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["'`]node:/u,
    message: "renderer-bound source must not import a node: module",
  },
  {
    pattern: /\bBuffer\s*(?:\.|\[|\()/u,
    message: "renderer-bound source must not depend on Node's Buffer global",
  },
  {
    pattern: /\bprocess\s*\./u,
    message: "renderer-bound source must not depend on Node's process global",
  },
  {
    pattern: /\brequire\s*\(/u,
    message: "renderer-bound source must not call CommonJS require",
  },
  {
    pattern: /\b__dirname\b|\b__filename\b/u,
    message: "renderer-bound source must not depend on CommonJS path globals",
  },
];

export async function auditRendererSourceBoundary(root) {
  const failures = [];
  const sourceRoot = resolve(root, "packages/physical-preview-three/src");

  for (const file of await sourceFiles(sourceRoot)) {
    const contents = await readFile(file, "utf8");
    for (const { pattern, message } of FORBIDDEN_RENDERER_SOURCE) {
      if (pattern.test(contents)) {
        failures.push(`${relative(root, file).replace(/\\/gu, "/")}: ${message}`);
      }
    }
  }

  const productionConfigPath = resolve(root, "packages/physical-preview-three/tsconfig.json");
  if (!(await exists(productionConfigPath))) {
    failures.push("packages/physical-preview-three/tsconfig.json is missing");
  } else {
    const config = JSON.parse(await readFile(productionConfigPath, "utf8"));
    const types = config.compilerOptions?.types ?? [];
    const include = config.include ?? [];
    const libs = config.compilerOptions?.lib ?? [];
    if (types.includes("node")) {
      failures.push("packages/physical-preview-three/tsconfig.json must not enable Node globals");
    }
    if (!libs.includes("DOM")) {
      failures.push("packages/physical-preview-three/tsconfig.json must compile against DOM browser APIs");
    }
    if (include.some((entry) => String(entry).includes("tests"))) {
      failures.push("packages/physical-preview-three/tsconfig.json must include production source only");
    }
  }

  const testConfigPath = resolve(root, "packages/physical-preview-three/tsconfig.test.json");
  if (!(await exists(testConfigPath))) {
    failures.push("packages/physical-preview-three/tsconfig.test.json is missing");
  } else {
    const config = JSON.parse(await readFile(testConfigPath, "utf8"));
    const types = config.compilerOptions?.types ?? [];
    const include = config.include ?? [];
    if (!types.includes("node")) {
      failures.push("packages/physical-preview-three/tsconfig.test.json must enable Node types for test utilities");
    }
    if (!include.some((entry) => String(entry).includes("tests"))) {
      failures.push("packages/physical-preview-three/tsconfig.test.json must include adapter tests");
    }
  }

  return failures;
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === import.meta.filename;

if (invokedDirectly) {
  const failures = await auditRendererSourceBoundary(resolve(import.meta.dirname, ".."));
  if (failures.length > 0) {
    throw new Error(`Renderer-source boundary audit failed:\n- ${failures.join("\n- ")}`);
  }
  console.log(
    "Renderer-source boundary audit passed: the Three adapter production source uses browser APIs only, while Node globals remain isolated to its test configuration.",
  );
}
