export const LIGHTBURN_LIBRARY_EXTENSION = ".clb" as const;

export type LightBurnMaterialFamily = "wood" | "acrylic";
export type LightBurnOperationTitle = "Engrave" | "Score";

export interface LightBurnCommonThickness {
  readonly id: string;
  readonly label: string;
  readonly thicknessMm: number;
}

export interface LightBurnStarterMaterial {
  readonly id: string;
  /** Familiar top-level Material Name shown in a LightBurn-style library. */
  readonly materialName: string;
  readonly family: LightBurnMaterialFamily;
  /** Existing physical-catalog entry when one already exists. Null means planned. */
  readonly physicalCatalogId: string | null;
  readonly aliases: readonly string[];
  readonly commonThicknesses: readonly LightBurnCommonThickness[];
  readonly surfaceOperationTitles: readonly LightBurnOperationTitle[];
  readonly descriptionExamples: readonly string[];
}

export type LightBurnLibraryKey =
  | {
      readonly materialName: string;
      readonly thicknessMm: number;
      readonly thicknessLabel: string;
      readonly title: null;
      readonly description: string;
    }
  | {
      readonly materialName: string;
      readonly thicknessMm: null;
      readonly thicknessLabel: null;
      readonly title: LightBurnOperationTitle;
      readonly description: string;
    };

const MM_PER_INCH = 25.4;

function metric(code: string, millimeters: number): LightBurnCommonThickness {
  return Object.freeze({
    id: code,
    label: `${String(millimeters)} mm`,
    thicknessMm: millimeters,
  });
}

function fractional(
  code: string,
  label: string,
  numerator: number,
  denominator: number,
): LightBurnCommonThickness {
  return Object.freeze({
    id: code,
    label,
    thicknessMm: (numerator / denominator) * MM_PER_INCH,
  });
}

function freezeStarterMaterial(
  material: LightBurnStarterMaterial,
): LightBurnStarterMaterial {
  return Object.freeze({
    ...material,
    aliases: Object.freeze([...material.aliases]),
    commonThicknesses: Object.freeze([...material.commonThicknesses]),
    surfaceOperationTitles: Object.freeze([...material.surfaceOperationTitles]),
    descriptionExamples: Object.freeze([...material.descriptionExamples]),
  });
}

const THIN_WOOD = Object.freeze([
  metric("1-5mm", 1.5),
  metric("3mm", 3),
  metric("4mm", 4),
  metric("5mm", 5),
  metric("6mm", 6),
  fractional("1-16in", "1/16 in", 1, 16),
  fractional("1-8in", "1/8 in", 1, 8),
  fractional("1-4in", "1/4 in", 1, 4),
]);

const PLYWOOD = Object.freeze([
  metric("1-5mm", 1.5),
  metric("3mm", 3),
  metric("4mm", 4),
  metric("5mm", 5),
  metric("6mm", 6),
  metric("9mm", 9),
  metric("12mm", 12),
  fractional("1-16in", "1/16 in", 1, 16),
  fractional("1-8in", "1/8 in", 1, 8),
  fractional("1-4in", "1/4 in", 1, 4),
  fractional("1-2in", "1/2 in", 1, 2),
]);

const MDF = Object.freeze([
  metric("1-5mm", 1.5),
  metric("3mm", 3),
  metric("6mm", 6),
  metric("9mm", 9),
  metric("12mm", 12),
  fractional("1-8in", "1/8 in", 1, 8),
  fractional("1-4in", "1/4 in", 1, 4),
  fractional("1-2in", "1/2 in", 1, 2),
]);

const VENEER = Object.freeze([
  metric("0-6mm", 0.6),
  metric("1mm", 1),
  metric("1-5mm", 1.5),
  fractional("1-32in", "1/32 in", 1, 32),
  fractional("1-16in", "1/16 in", 1, 16),
]);

const ACRYLIC = Object.freeze([
  metric("1-5mm", 1.5),
  metric("2mm", 2),
  metric("3mm", 3),
  metric("4mm", 4),
  metric("5mm", 5),
  metric("6mm", 6),
  metric("8mm", 8),
  metric("10mm", 10),
  fractional("1-16in", "1/16 in", 1, 16),
  fractional("1-8in", "1/8 in", 1, 8),
  fractional("3-16in", "3/16 in", 3, 16),
  fractional("1-4in", "1/4 in", 1, 4),
  fractional("3-8in", "3/8 in", 3, 8),
  fractional("1-2in", "1/2 in", 1, 2),
]);

const SURFACE_OPERATIONS = Object.freeze([
  "Engrave",
  "Score",
] satisfies readonly LightBurnOperationTitle[]);

/**
 * Starter taxonomy using names a LightBurn user is likely to recognize.
 *
 * LightBurn does not publish a universal machine-independent material library.
 * Its libraries are user-generated and commonly device-specific, so this list
 * deliberately contains no speed, power, pass, air-assist, or focus values.
 */
export const LIGHTBURN_STARTER_MATERIALS: readonly LightBurnStarterMaterial[] =
  Object.freeze([
    freezeStarterMaterial({
      id: "wood-mdf",
      materialName: "MDF",
      family: "wood",
      physicalCatalogId: "wood-mdf",
      aliases: ["Medium-density fiberboard", "Draftboard"],
      commonThicknesses: MDF,
      surfaceOperationTitles: SURFACE_OPERATIONS,
      descriptionExamples: ["Cut — clean", "Cut — fast", "Engrave — fill"],
    }),
    freezeStarterMaterial({
      id: "wood-basswood-plywood",
      materialName: "Basswood Plywood",
      family: "wood",
      physicalCatalogId: null,
      aliases: ["Laser plywood", "Basswood ply"],
      commonThicknesses: THIN_WOOD,
      surfaceOperationTitles: SURFACE_OPERATIONS,
      descriptionExamples: ["Cut — clean", "Cut — single pass", "Engrave — fill"],
    }),
    freezeStarterMaterial({
      id: "wood-birch-plywood",
      materialName: "Birch Plywood",
      family: "wood",
      physicalCatalogId: null,
      aliases: ["Birch ply", "Laser-safe birch plywood"],
      commonThicknesses: PLYWOOD,
      surfaceOperationTitles: SURFACE_OPERATIONS,
      descriptionExamples: ["Cut — clean", "Cut — fast", "Engrave — fill"],
    }),
    freezeStarterMaterial({
      id: "wood-baltic-birch-plywood",
      materialName: "Baltic Birch Plywood",
      family: "wood",
      physicalCatalogId: "wood-baltic-birch-plywood",
      aliases: ["Baltic birch", "Multi-ply birch"],
      commonThicknesses: PLYWOOD,
      surfaceOperationTitles: SURFACE_OPERATIONS,
      descriptionExamples: ["Cut — clean", "Cut — multiple pass", "Engrave — fill"],
    }),
    freezeStarterMaterial({
      id: "wood-hardwood-plywood",
      materialName: "Hardwood Plywood",
      family: "wood",
      physicalCatalogId: "wood-hardwood-plywood",
      aliases: ["Walnut plywood", "Cherry plywood", "Maple plywood"],
      commonThicknesses: PLYWOOD,
      surfaceOperationTitles: SURFACE_OPERATIONS,
      descriptionExamples: ["Cut — test glue first", "Engrave — fill", "Score — outline"],
    }),
    freezeStarterMaterial({
      id: "wood-solid-hardwood",
      materialName: "Solid Hardwood",
      family: "wood",
      physicalCatalogId: null,
      aliases: ["Walnut", "Cherry", "Maple", "Oak"],
      commonThicknesses: PLYWOOD,
      surfaceOperationTitles: SURFACE_OPERATIONS,
      descriptionExamples: ["Cut — species test", "Engrave — fill", "Score — outline"],
    }),
    freezeStarterMaterial({
      id: "wood-veneer",
      materialName: "Wood Veneer",
      family: "wood",
      physicalCatalogId: null,
      aliases: ["Walnut veneer", "Cherry veneer", "Maple veneer"],
      commonThicknesses: VENEER,
      surfaceOperationTitles: SURFACE_OPERATIONS,
      descriptionExamples: ["Cut — delicate", "Engrave — light", "Score — outline"],
    }),
    freezeStarterMaterial({
      id: "wood-hardboard",
      materialName: "Hardboard / Masonite",
      family: "wood",
      physicalCatalogId: "wood-hardboard",
      aliases: ["Masonite", "Hardboard"],
      commonThicknesses: THIN_WOOD,
      surfaceOperationTitles: SURFACE_OPERATIONS,
      descriptionExamples: ["Cut — clean", "Engrave — fill", "Score — outline"],
    }),
    freezeStarterMaterial({
      id: "acrylic-cast-clear",
      materialName: "Cast Acrylic — Clear",
      family: "acrylic",
      physicalCatalogId: "acrylic-cast-clear",
      aliases: ["Clear cast acrylic", "Clear PMMA"],
      commonThicknesses: ACRYLIC,
      surfaceOperationTitles: SURFACE_OPERATIONS,
      descriptionExamples: ["Cut — polished edge", "Engrave — frosted", "Score — outline"],
    }),
    freezeStarterMaterial({
      id: "acrylic-cast-opaque",
      materialName: "Cast Acrylic — Opaque Color",
      family: "acrylic",
      physicalCatalogId: "acrylic-cast-opaque",
      aliases: ["Colored cast acrylic", "Opaque PMMA"],
      commonThicknesses: ACRYLIC,
      surfaceOperationTitles: SURFACE_OPERATIONS,
      descriptionExamples: ["Cut — clean", "Engrave — fill", "Score — outline"],
    }),
    freezeStarterMaterial({
      id: "acrylic-cast-translucent",
      materialName: "Cast Acrylic — Transparent / Translucent Color",
      family: "acrylic",
      physicalCatalogId: "acrylic-cast-translucent",
      aliases: ["Transparent colored acrylic", "Translucent cast acrylic"],
      commonThicknesses: ACRYLIC,
      surfaceOperationTitles: SURFACE_OPERATIONS,
      descriptionExamples: ["Cut — polished edge", "Engrave — frosted", "Score — outline"],
    }),
    freezeStarterMaterial({
      id: "acrylic-extruded-clear",
      materialName: "Extruded Acrylic — Clear",
      family: "acrylic",
      physicalCatalogId: "acrylic-extruded-clear",
      aliases: ["Clear extruded acrylic", "Extruded PMMA"],
      commonThicknesses: ACRYLIC,
      surfaceOperationTitles: SURFACE_OPERATIONS,
      descriptionExamples: ["Cut — clean", "Engrave — light", "Score — outline"],
    }),
    freezeStarterMaterial({
      id: "acrylic-extruded-color",
      materialName: "Extruded Acrylic — Color",
      family: "acrylic",
      physicalCatalogId: null,
      aliases: ["Colored extruded acrylic", "Opaque extruded acrylic"],
      commonThicknesses: ACRYLIC,
      surfaceOperationTitles: SURFACE_OPERATIONS,
      descriptionExamples: ["Cut — test color", "Engrave — light", "Score — outline"],
    }),
    freezeStarterMaterial({
      id: "acrylic-frosted",
      materialName: "Acrylic — Frosted",
      family: "acrylic",
      physicalCatalogId: "acrylic-frosted",
      aliases: ["Frosted acrylic", "Matte acrylic"],
      commonThicknesses: ACRYLIC,
      surfaceOperationTitles: SURFACE_OPERATIONS,
      descriptionExamples: ["Cut — clean", "Engrave — contrast test", "Score — outline"],
    }),
    freezeStarterMaterial({
      id: "acrylic-mirrored",
      materialName: "Acrylic — Mirrored",
      family: "acrylic",
      physicalCatalogId: "acrylic-mirrored",
      aliases: ["Mirror acrylic", "Acrylic mirror"],
      commonThicknesses: ACRYLIC,
      surfaceOperationTitles: SURFACE_OPERATIONS,
      descriptionExamples: ["Cut — backing side test", "Engrave — reverse", "Score — outline"],
    }),
  ]);

export function lightBurnStarterMaterialById(
  id: string,
): LightBurnStarterMaterial | undefined {
  return LIGHTBURN_STARTER_MATERIALS.find((material) => material.id === id);
}

export function lightBurnStarterMaterialsForFamily(
  family: LightBurnMaterialFamily,
): readonly LightBurnStarterMaterial[] {
  return LIGHTBURN_STARTER_MATERIALS.filter(
    (material) => material.family === family,
  );
}

export function lightBurnCutLibraryKeys(
  materialId: string,
  description = "Cut — test on this machine",
): readonly LightBurnLibraryKey[] {
  const material = lightBurnStarterMaterialById(materialId);
  if (material === undefined) return [];
  return material.commonThicknesses.map((thickness) =>
    Object.freeze({
      materialName: material.materialName,
      thicknessMm: thickness.thicknessMm,
      thicknessLabel: thickness.label,
      title: null,
      description,
    }),
  );
}

export function lightBurnSurfaceLibraryKeys(
  materialId: string,
  descriptionForTitle: (
    title: LightBurnOperationTitle,
  ) => string = (title) => `${title} — test on this machine`,
): readonly LightBurnLibraryKey[] {
  const material = lightBurnStarterMaterialById(materialId);
  if (material === undefined) return [];
  return material.surfaceOperationTitles.map((title) =>
    Object.freeze({
      materialName: material.materialName,
      thicknessMm: null,
      thicknessLabel: null,
      title,
      description: descriptionForTitle(title),
    }),
  );
}

export function lightBurnStarterIntegrityIssues(
  catalog: readonly LightBurnStarterMaterial[] = LIGHTBURN_STARTER_MATERIALS,
): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  const names = new Set<string>();

  for (const material of catalog) {
    if (ids.has(material.id)) issues.push(`Duplicate material ID: ${material.id}`);
    ids.add(material.id);

    const normalizedName = material.materialName.trim().toLocaleLowerCase();
    if (names.has(normalizedName)) {
      issues.push(`Duplicate LightBurn material name: ${material.materialName}`);
    }
    names.add(normalizedName);

    const thicknessIds = new Set<string>();
    for (const thickness of material.commonThicknesses) {
      if (thicknessIds.has(thickness.id)) {
        issues.push(`Duplicate thickness ID: ${material.id}:${thickness.id}`);
      }
      thicknessIds.add(thickness.id);
      if (!Number.isFinite(thickness.thicknessMm) || thickness.thicknessMm <= 0) {
        issues.push(`Invalid thickness: ${material.id}:${thickness.id}`);
      }
    }
  }

  return issues;
}
