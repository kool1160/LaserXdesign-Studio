import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { basename, extname, join } from "node:path";

import { create } from "fontkit";

import type {
  FontCatalogEntry,
  FontCategory,
  FontSource,
} from "./index.js";

function categoriesFor(name: string): FontCategory[] {
  const normalized = name.toLowerCase();
  const categories: FontCategory[] = [];
  if (normalized.includes("stencil")) categories.push("stencil");
  if (
    normalized.includes("script") ||
    normalized.includes("hand") ||
    normalized.includes("cursive")
  ) {
    categories.push("script");
  }
  if (normalized.includes("slab")) categories.push("slab");
  if (normalized.includes("serif")) categories.push("serif");
  if (
    normalized.includes("western") ||
    normalized.includes("cowboy")
  ) {
    categories.push("western");
  }
  if (
    normalized.includes("mono") ||
    normalized.includes("industrial") ||
    normalized.includes("condensed")
  ) {
    categories.push("industrial");
  }
  if (categories.length === 0) categories.push("display");
  return categories;
}

export function discoverWindowsFontSources(
  directories: readonly string[],
): FontSource[] {
  const sources: FontSource[] = [];
  const seen = new Set<string>();
  for (const directory of directories) {
    let names: string[];
    try {
      names = readdirSync(directory);
    } catch {
      continue;
    }
    for (const name of names.sort()) {
      const extension = extname(name).toLowerCase();
      if (extension !== ".ttf" && extension !== ".otf") {
        continue;
      }
      const filePath = join(directory, name);
      try {
        const bytes = readFileSync(filePath);
        const opened = create(bytes);
        if (!("layout" in opened)) {
          continue;
        }
        const fingerprint = createHash("sha256")
          .update(bytes)
          .digest("hex");
        const family = opened.familyName || basename(name, extension);
        const style = opened.subfamilyName || "Regular";
        const key = `${family}\0${style}\0${fingerprint}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const entry: FontCatalogEntry = {
          id: `system:${fingerprint.slice(0, 24)}`,
          family,
          style,
          source: "system",
          categories: categoriesFor(`${family} ${style}`),
          fingerprint,
          license: {
            spdx: "SYSTEM",
            copyright: opened.copyright || "Installed system font",
            licenseFile: null,
            provenance: "Installed on this Windows computer",
          },
        };
        sources.push({
          entry,
          load: () => readFileSync(filePath),
        });
      } catch {
        // Unsupported or damaged installed fonts are omitted from the catalog.
      }
    }
  }
  return sources;
}
