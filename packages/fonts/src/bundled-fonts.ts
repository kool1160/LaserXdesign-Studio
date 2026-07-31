import notoSans from "@fontsource-variable/noto-sans/files/noto-sans-latin-wght-normal.woff2";
import notoSerif from "@fontsource-variable/noto-serif/files/noto-serif-latin-wght-normal.woff2";
import robotoSlab from "@fontsource-variable/roboto-slab/files/roboto-slab-latin-wght-normal.woff2";
import pacifico from "@fontsource/pacifico/files/pacifico-latin-400-normal.woff2";
import rye from "@fontsource/rye/files/rye-latin-400-normal.woff2";
import sairaStencil from "@fontsource/saira-stencil-one/files/saira-stencil-one-latin-400-normal.woff2";
import {
  createFontSource,
  type FontCategory,
  type FontSource,
} from "./index.js";

interface BundledDefinition {
  id: string;
  family: string;
  style: string;
  categories: FontCategory[];
  packageName: string;
  copyright: string;
  spdx?: "OFL-1.1" | "Apache-2.0";
  licenseFile?: string;
  bytes: Uint8Array;
}

function binaryAsset(value: unknown): Uint8Array {
  return value as Uint8Array;
}

const definitions: readonly BundledDefinition[] = [
  {
    id: "bundled:noto-sans",
    family: "Noto Sans",
    style: "Regular",
    categories: ["industrial", "display"],
    packageName: "@fontsource-variable/noto-sans@5.3.0",
    copyright:
      "Copyright 2022 The Noto Project Authors (https://github.com/notofonts/latin-greek-cyrillic) NotoSans-Italic[wdth,wght].ttf: Copyright 2022 The Noto Project Authors (https://github.com/notofonts/latin-greek-cyrillic)",
    bytes: binaryAsset(notoSans),
  },
  {
    id: "bundled:noto-serif",
    family: "Noto Serif",
    style: "Regular",
    categories: ["serif", "display"],
    packageName: "@fontsource-variable/noto-serif@5.3.0",
    copyright:
      "Copyright 2022 The Noto Project Authors (https://github.com/notofonts/latin-greek-cyrillic) NotoSerif-Italic[wdth,wght].ttf: Copyright 2022 The Noto Project Authors (https://github.com/notofonts/latin-greek-cyrillic)",
    bytes: binaryAsset(notoSerif),
  },
  {
    id: "bundled:roboto-slab",
    family: "Roboto Slab",
    style: "Regular",
    categories: ["slab", "industrial"],
    packageName: "@fontsource-variable/roboto-slab@5.3.0",
    copyright:
      "Copyright 2018 The Roboto Slab Project Authors (https://github.com/googlefonts/robotoslab)",
    spdx: "Apache-2.0",
    licenseFile: "packages/fonts/licenses/Apache-2.0.txt",
    bytes: binaryAsset(robotoSlab),
  },
  {
    id: "bundled:pacifico",
    family: "Pacifico",
    style: "Regular",
    categories: ["script", "display"],
    packageName: "@fontsource/pacifico@5.3.0",
    copyright:
      "Copyright 2018 The Pacifico Project Authors (https://github.com/googlefonts/Pacifico)",
    bytes: binaryAsset(pacifico),
  },
  {
    id: "bundled:rye",
    family: "Rye",
    style: "Regular",
    categories: ["western", "display"],
    packageName: "@fontsource/rye@5.3.0",
    copyright:
      "Copyright (c) 2012, Sorkin Type Co (eben@eyebytes.com) with Reserved Font Name 'Rye'",
    bytes: binaryAsset(rye),
  },
  {
    id: "bundled:saira-stencil-one",
    family: "Saira Stencil One",
    style: "Regular",
    categories: ["stencil", "industrial"],
    packageName: "@fontsource/saira-stencil-one@5.3.0",
    copyright:
      "Copyright 2019 The Saira Stencil Project Authors (https://github.com/Omnibus-Type/Saira)",
    bytes: binaryAsset(sairaStencil),
  },
];

export function bundledFontSources(): FontSource[] {
  return definitions.map((definition) =>
    createFontSource(
      {
        id: definition.id,
        family: definition.family,
        style: definition.style,
        source: "bundled",
        categories: [...definition.categories],
        license: {
          spdx: definition.spdx ?? "OFL-1.1",
          copyright: definition.copyright,
          licenseFile:
            definition.licenseFile ??
            "packages/fonts/licenses/OFL-1.1.txt",
          provenance: definition.packageName,
        },
      },
      definition.bytes,
    ),
  );
}
