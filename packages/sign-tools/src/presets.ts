import type { SignTemplateKind, SignTemplateShape } from "@laserx/domain";

export interface SignAssetProvenance {
  id: string;
  kind: "algorithmic-geometry" | "bundled-font";
  source: string;
  license: "LaserX-original" | "OFL-1.1" | "Apache-2.0";
  licenseFile: string | null;
}

export interface SignStylePreset {
  id: string;
  name: string;
  templateKinds: SignTemplateKind[];
  shape: SignTemplateShape;
  fontId: string;
  defaultArc: boolean;
  provenanceIds: string[];
}

export const SIGN_ASSET_PROVENANCE: readonly SignAssetProvenance[] = [
  {
    id: "laserx:algorithmic-sign-primitives-v1",
    kind: "algorithmic-geometry",
    source: "LaserX deterministic primitive generators",
    license: "LaserX-original",
    licenseFile: null,
  },
  {
    id: "bundled:saira-stencil-one",
    kind: "bundled-font",
    source: "Fontsource / Saira Stencil One",
    license: "OFL-1.1",
    licenseFile: "packages/fonts/licenses/OFL-1.1.txt",
  },
  {
    id: "bundled:roboto-slab",
    kind: "bundled-font",
    source: "Fontsource / Roboto Slab",
    license: "Apache-2.0",
    licenseFile: "packages/fonts/licenses/Apache-2.0.txt",
  },
  {
    id: "bundled:rye",
    kind: "bundled-font",
    source: "Fontsource / Rye",
    license: "OFL-1.1",
    licenseFile: "packages/fonts/licenses/OFL-1.1.txt",
  },
] as const;

export const SIGN_STYLE_PRESETS: readonly SignStylePreset[] = [
  {
    id: "industrial-stencil",
    name: "Industrial Stencil",
    templateKinds: ["monogram", "address", "family-name", "badge"],
    shape: "rounded-rectangle",
    fontId: "bundled:saira-stencil-one",
    defaultArc: false,
    provenanceIds: [
      "laserx:algorithmic-sign-primitives-v1",
      "bundled:saira-stencil-one",
    ],
  },
  {
    id: "classic-slab",
    name: "Classic Slab",
    templateKinds: ["address", "family-name", "badge"],
    shape: "oval",
    fontId: "bundled:roboto-slab",
    defaultArc: false,
    provenanceIds: [
      "laserx:algorithmic-sign-primitives-v1",
      "bundled:roboto-slab",
    ],
  },
  {
    id: "western-badge",
    name: "Western Badge",
    templateKinds: ["monogram", "family-name", "badge"],
    shape: "badge",
    fontId: "bundled:rye",
    defaultArc: true,
    provenanceIds: [
      "laserx:algorithmic-sign-primitives-v1",
      "bundled:rye",
    ],
  },
] as const;

export function signStylePreset(id: string): SignStylePreset {
  const preset = SIGN_STYLE_PRESETS.find((candidate) => candidate.id === id);
  if (preset === undefined) {
    throw new RangeError(`Sign style preset ${id} is unavailable.`);
  }
  return {
    ...preset,
    templateKinds: [...preset.templateKinds],
    provenanceIds: [...preset.provenanceIds],
  };
}
