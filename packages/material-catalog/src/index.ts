export const MILLIMETERS_PER_INCH = 25.4;

export type MaterialFamily = "wood" | "acrylic";

export type WoodMaterialSubtype =
  | "mdf"
  | "baltic-birch-plywood"
  | "hardwood-plywood"
  | "hardboard";

export type AcrylicMaterialSubtype =
  | "cast-clear"
  | "cast-opaque"
  | "cast-translucent"
  | "extruded-clear"
  | "mirrored"
  | "frosted";

export type MaterialSubtype = WoodMaterialSubtype | AcrylicMaterialSubtype;

export type CatalogProcess =
  | "co2-laser"
  | "diode-laser"
  | "fiber-laser"
  | "plasma"
  | "waterjet"
  | "router";

export type ProcessSupport = "supported" | "conditional" | "unsupported";

export type MeasurementPolicy =
  | "nominal-is-exact"
  | "measure-recommended"
  | "measure-required";

export type StockNotation = "fractional-inch" | "millimeter";

export type AppearanceKind =
  | "wood"
  | "opaque"
  | "transparent"
  | "translucent"
  | "mirrored"
  | "frosted";

export interface CatalogStockPreset {
  readonly id: string;
  readonly label: string;
  /** Canonical nominal thickness. A measured override, when supplied, wins. */
  readonly nominalThicknessMm: number;
  readonly notation: StockNotation;
  readonly measurementPolicy: MeasurementPolicy;
}

export interface ProcessCompatibility {
  readonly process: CatalogProcess;
  readonly support: ProcessSupport;
  readonly note: string;
}

export interface MaterialAppearance {
  readonly kind: AppearanceKind;
  readonly baseColorHex: `#${string}`;
  readonly opacity: number;
  readonly roughness: number;
  readonly metalness: number;
  readonly transmission: number;
}

export interface MaterialCatalogEntry {
  readonly id: string;
  readonly label: string;
  readonly family: MaterialFamily;
  readonly subtype: MaterialSubtype;
  readonly stockPresets: readonly CatalogStockPreset[];
  readonly processCompatibility: readonly ProcessCompatibility[];
  readonly appearance: MaterialAppearance;
  readonly notes: readonly string[];
}

export interface ResolvedCatalogThickness {
  readonly thicknessMm: number;
  readonly source: "nominal" | "measured";
  readonly measurementPolicy: MeasurementPolicy;
  readonly needsMeasurement: boolean;
}

export const CATALOG_PROCESSES: readonly CatalogProcess[] = Object.freeze([
  "co2-laser",
  "diode-laser",
  "fiber-laser",
  "plasma",
  "waterjet",
  "router",
]);

function freezeMaterial(entry: MaterialCatalogEntry): MaterialCatalogEntry {
  return Object.freeze({
    ...entry,
    stockPresets: Object.freeze([...entry.stockPresets]),
    processCompatibility: Object.freeze([...entry.processCompatibility]),
    appearance: Object.freeze({ ...entry.appearance }),
    notes: Object.freeze([...entry.notes]),
  });
}

function stock(
  materialId: string,
  code: string,
  label: string,
  nominalThicknessMm: number,
  notation: StockNotation,
  measurementPolicy: MeasurementPolicy,
): CatalogStockPreset {
  return Object.freeze({
    id: `${materialId}:${code}`,
    label,
    nominalThicknessMm,
    notation,
    measurementPolicy,
  });
}

function compatibility(
  process: CatalogProcess,
  support: ProcessSupport,
  note: string,
): ProcessCompatibility {
  return Object.freeze({ process, support, note });
}

function acrylicStocks(
  materialId: string,
  measurementPolicy: MeasurementPolicy = "measure-recommended",
): readonly CatalogStockPreset[] {
  return Object.freeze([
    stock(materialId, "1-16in", "1/16 in", 1.5875, "fractional-inch", measurementPolicy),
    stock(materialId, "1-8in", "1/8 in", 3.175, "fractional-inch", measurementPolicy),
    stock(materialId, "3-16in", "3/16 in", 4.7625, "fractional-inch", measurementPolicy),
    stock(materialId, "1-4in", "1/4 in", 6.35, "fractional-inch", measurementPolicy),
    stock(materialId, "3-8in", "3/8 in", 9.525, "fractional-inch", measurementPolicy),
    stock(materialId, "1-2in", "1/2 in", 12.7, "fractional-inch", measurementPolicy),
    stock(materialId, "1-5mm", "1.5 mm", 1.5, "millimeter", measurementPolicy),
    stock(materialId, "2mm", "2 mm", 2, "millimeter", measurementPolicy),
    stock(materialId, "3mm", "3 mm", 3, "millimeter", measurementPolicy),
    stock(materialId, "4mm", "4 mm", 4, "millimeter", measurementPolicy),
    stock(materialId, "5mm", "5 mm", 5, "millimeter", measurementPolicy),
    stock(materialId, "6mm", "6 mm", 6, "millimeter", measurementPolicy),
    stock(materialId, "8mm", "8 mm", 8, "millimeter", measurementPolicy),
    stock(materialId, "10mm", "10 mm", 10, "millimeter", measurementPolicy),
    stock(materialId, "12mm", "12 mm", 12, "millimeter", measurementPolicy),
  ]);
}

function plywoodStocks(materialId: string): readonly CatalogStockPreset[] {
  const policy: MeasurementPolicy = "measure-required";
  return Object.freeze([
    stock(materialId, "1-8in", "1/8 in nominal", 3.175, "fractional-inch", policy),
    stock(materialId, "1-4in", "1/4 in nominal", 6.35, "fractional-inch", policy),
    stock(materialId, "3-8in", "3/8 in nominal", 9.525, "fractional-inch", policy),
    stock(materialId, "1-2in", "1/2 in nominal", 12.7, "fractional-inch", policy),
    stock(materialId, "3-4in", "3/4 in nominal", 19.05, "fractional-inch", policy),
    stock(materialId, "3mm", "3 mm nominal", 3, "millimeter", policy),
    stock(materialId, "6mm", "6 mm nominal", 6, "millimeter", policy),
    stock(materialId, "9mm", "9 mm nominal", 9, "millimeter", policy),
    stock(materialId, "12mm", "12 mm nominal", 12, "millimeter", policy),
    stock(materialId, "18mm", "18 mm nominal", 18, "millimeter", policy),
  ]);
}

function mdfStocks(materialId: string): readonly CatalogStockPreset[] {
  const policy: MeasurementPolicy = "measure-required";
  return Object.freeze([
    stock(materialId, "1-8in", "1/8 in nominal", 3.175, "fractional-inch", policy),
    stock(materialId, "1-4in", "1/4 in nominal", 6.35, "fractional-inch", policy),
    stock(materialId, "3-8in", "3/8 in nominal", 9.525, "fractional-inch", policy),
    stock(materialId, "1-2in", "1/2 in nominal", 12.7, "fractional-inch", policy),
    stock(materialId, "3-4in", "3/4 in nominal", 19.05, "fractional-inch", policy),
    stock(materialId, "3mm", "3 mm nominal", 3, "millimeter", policy),
    stock(materialId, "6mm", "6 mm nominal", 6, "millimeter", policy),
    stock(materialId, "9mm", "9 mm nominal", 9, "millimeter", policy),
    stock(materialId, "12mm", "12 mm nominal", 12, "millimeter", policy),
    stock(materialId, "18mm", "18 mm nominal", 18, "millimeter", policy),
    stock(materialId, "25mm", "25 mm nominal", 25, "millimeter", policy),
  ]);
}

function hardboardStocks(materialId: string): readonly CatalogStockPreset[] {
  const policy: MeasurementPolicy = "measure-required";
  return Object.freeze([
    stock(materialId, "1-8in", "1/8 in nominal", 3.175, "fractional-inch", policy),
    stock(materialId, "3-16in", "3/16 in nominal", 4.7625, "fractional-inch", policy),
    stock(materialId, "1-4in", "1/4 in nominal", 6.35, "fractional-inch", policy),
    stock(materialId, "3mm", "3 mm nominal", 3, "millimeter", policy),
    stock(materialId, "4mm", "4 mm nominal", 4, "millimeter", policy),
    stock(materialId, "6mm", "6 mm nominal", 6, "millimeter", policy),
  ]);
}

const WOOD_STANDARD_COMPATIBILITY: readonly ProcessCompatibility[] = Object.freeze([
  compatibility("co2-laser", "supported", "Commonly cut with extraction; verify glue and coating suitability."),
  compatibility("diode-laser", "conditional", "Practical thickness and speed depend heavily on diode power and material glue."),
  compatibility("fiber-laser", "unsupported", "Standard fiber systems are not intended for cutting wood sheet."),
  compatibility("plasma", "unsupported", "Combustible sheet must not be plasma cut."),
  compatibility("waterjet", "conditional", "Possible, but water exposure can swell, stain, or delaminate the sheet."),
  compatibility("router", "supported", "Use suitable tooling, dust extraction, and workholding."),
]);

const MDF_COMPATIBILITY: readonly ProcessCompatibility[] = Object.freeze([
  compatibility("co2-laser", "supported", "Cuts consistently but creates heavy smoke; use strong extraction and verify binder safety."),
  compatibility("diode-laser", "conditional", "Thin MDF may cut on capable systems; verify power, smoke control, and binder composition."),
  compatibility("fiber-laser", "unsupported", "Standard fiber systems are not intended for MDF."),
  compatibility("plasma", "unsupported", "Combustible sheet must not be plasma cut."),
  compatibility("waterjet", "unsupported", "Water rapidly damages MDF and destroys dimensional stability."),
  compatibility("router", "supported", "Use carbide tooling and effective fine-dust extraction."),
]);

const ACRYLIC_STANDARD_COMPATIBILITY: readonly ProcessCompatibility[] = Object.freeze([
  compatibility("co2-laser", "supported", "Preferred laser process for clean acrylic cutting; use proper extraction."),
  compatibility("diode-laser", "conditional", "Opaque dark acrylic may work; clear or light acrylic usually will not absorb diode wavelengths."),
  compatibility("fiber-laser", "unsupported", "Standard fiber systems generally do not cut ordinary acrylic reliably."),
  compatibility("plasma", "unsupported", "Acrylic must not be plasma cut."),
  compatibility("waterjet", "conditional", "Possible with suitable support and piercing strategy; edge finish differs from laser cutting."),
  compatibility("router", "supported", "Use plastic-cutting tooling, chip evacuation, and heat control."),
]);

const CLEAR_ACRYLIC_COMPATIBILITY: readonly ProcessCompatibility[] = Object.freeze([
  compatibility("co2-laser", "supported", "Preferred process for clear acrylic cutting; cast and extruded edges behave differently."),
  compatibility("diode-laser", "unsupported", "Clear acrylic usually transmits visible diode wavelengths instead of absorbing them."),
  compatibility("fiber-laser", "unsupported", "Standard fiber systems generally do not cut ordinary clear acrylic."),
  compatibility("plasma", "unsupported", "Acrylic must not be plasma cut."),
  compatibility("waterjet", "conditional", "Possible with suitable support and piercing strategy; avoid cracking and edge chipping."),
  compatibility("router", "supported", "Use plastic-cutting tooling, chip evacuation, and heat control."),
]);

const MIRRORED_ACRYLIC_COMPATIBILITY: readonly ProcessCompatibility[] = Object.freeze([
  compatibility("co2-laser", "conditional", "Cut from the recommended side for the product and verify the mirror backing chemistry."),
  compatibility("diode-laser", "conditional", "Results depend on face color and mirror backing; test a sample before production."),
  compatibility("fiber-laser", "unsupported", "Standard fiber systems are not a general mirrored-acrylic cutting process."),
  compatibility("plasma", "unsupported", "Acrylic must not be plasma cut."),
  compatibility("waterjet", "conditional", "Possible, but protect the mirrored backing and verify edge quality."),
  compatibility("router", "supported", "Protect the face and backing from scratches and use plastic-cutting tooling."),
]);

export const MATERIAL_CATALOG: readonly MaterialCatalogEntry[] = Object.freeze([
  freezeMaterial({
    id: "wood-mdf",
    label: "MDF",
    family: "wood",
    subtype: "mdf",
    stockPresets: mdfStocks("wood-mdf"),
    processCompatibility: MDF_COMPATIBILITY,
    appearance: {
      kind: "wood",
      baseColorHex: "#a77b50",
      opacity: 1,
      roughness: 0.88,
      metalness: 0,
      transmission: 0,
    },
    notes: [
      "Nominal MDF thickness commonly differs from measured thickness.",
      "Measure the actual sheet before fit, slot, spacer, or physical-stack calculations.",
    ],
  }),
  freezeMaterial({
    id: "wood-baltic-birch-plywood",
    label: "Baltic birch plywood",
    family: "wood",
    subtype: "baltic-birch-plywood",
    stockPresets: plywoodStocks("wood-baltic-birch-plywood"),
    processCompatibility: WOOD_STANDARD_COMPATIBILITY,
    appearance: {
      kind: "wood",
      baseColorHex: "#d6b889",
      opacity: 1,
      roughness: 0.72,
      metalness: 0,
      transmission: 0,
    },
    notes: [
      "Core construction and actual thickness vary by supplier and grade.",
      "Measure the sheet before press-fit, tab-and-slot, or layered-stack work.",
    ],
  }),
  freezeMaterial({
    id: "wood-hardwood-plywood",
    label: "Hardwood plywood",
    family: "wood",
    subtype: "hardwood-plywood",
    stockPresets: plywoodStocks("wood-hardwood-plywood"),
    processCompatibility: WOOD_STANDARD_COMPATIBILITY,
    appearance: {
      kind: "wood",
      baseColorHex: "#bd8d5d",
      opacity: 1,
      roughness: 0.74,
      metalness: 0,
      transmission: 0,
    },
    notes: [
      "Veneer species, core material, glue, and actual thickness vary widely.",
      "Confirm laser-safe construction and measure the sheet before fit calculations.",
    ],
  }),
  freezeMaterial({
    id: "wood-hardboard",
    label: "Hardboard / Masonite",
    family: "wood",
    subtype: "hardboard",
    stockPresets: hardboardStocks("wood-hardboard"),
    processCompatibility: WOOD_STANDARD_COMPATIBILITY,
    appearance: {
      kind: "wood",
      baseColorHex: "#7d5033",
      opacity: 1,
      roughness: 0.82,
      metalness: 0,
      transmission: 0,
    },
    notes: [
      "Tempered coatings and binders vary; verify process suitability before cutting.",
      "Use a measured thickness for stacked assemblies and fitted parts.",
    ],
  }),
  freezeMaterial({
    id: "acrylic-cast-clear",
    label: "Cast clear acrylic",
    family: "acrylic",
    subtype: "cast-clear",
    stockPresets: acrylicStocks("acrylic-cast-clear"),
    processCompatibility: CLEAR_ACRYLIC_COMPATIBILITY,
    appearance: {
      kind: "transparent",
      baseColorHex: "#dff7ff",
      opacity: 0.22,
      roughness: 0.08,
      metalness: 0,
      transmission: 0.92,
    },
    notes: [
      "Cast acrylic commonly engraves with a frosted appearance and cuts with a polished edge.",
      "Measure actual stock for standoffs, slots, press fits, and layered spacing.",
    ],
  }),
  freezeMaterial({
    id: "acrylic-cast-opaque",
    label: "Cast opaque acrylic",
    family: "acrylic",
    subtype: "cast-opaque",
    stockPresets: acrylicStocks("acrylic-cast-opaque"),
    processCompatibility: ACRYLIC_STANDARD_COMPATIBILITY,
    appearance: {
      kind: "opaque",
      baseColorHex: "#f2f2f2",
      opacity: 1,
      roughness: 0.22,
      metalness: 0,
      transmission: 0,
    },
    notes: [
      "Actual color is a stock attribute and should override this neutral preview default.",
      "Measure actual stock for fitted and stacked assemblies.",
    ],
  }),
  freezeMaterial({
    id: "acrylic-cast-translucent",
    label: "Cast translucent acrylic",
    family: "acrylic",
    subtype: "cast-translucent",
    stockPresets: acrylicStocks("acrylic-cast-translucent"),
    processCompatibility: ACRYLIC_STANDARD_COMPATIBILITY,
    appearance: {
      kind: "translucent",
      baseColorHex: "#75b9e8",
      opacity: 0.68,
      roughness: 0.2,
      metalness: 0,
      transmission: 0.48,
    },
    notes: [
      "Light transmission varies by color, manufacturer, and thickness.",
      "Use product-specific transmission data for illuminated-sign decisions.",
    ],
  }),
  freezeMaterial({
    id: "acrylic-extruded-clear",
    label: "Extruded clear acrylic",
    family: "acrylic",
    subtype: "extruded-clear",
    stockPresets: acrylicStocks("acrylic-extruded-clear"),
    processCompatibility: CLEAR_ACRYLIC_COMPATIBILITY,
    appearance: {
      kind: "transparent",
      baseColorHex: "#e7fbff",
      opacity: 0.2,
      roughness: 0.07,
      metalness: 0,
      transmission: 0.94,
    },
    notes: [
      "Extruded acrylic often cuts cleanly but engraves differently from cast acrylic.",
      "Heat response and thickness tolerance vary; measure fitted parts before production.",
    ],
  }),
  freezeMaterial({
    id: "acrylic-mirrored",
    label: "Mirrored acrylic",
    family: "acrylic",
    subtype: "mirrored",
    stockPresets: acrylicStocks("acrylic-mirrored"),
    processCompatibility: MIRRORED_ACRYLIC_COMPATIBILITY,
    appearance: {
      kind: "mirrored",
      baseColorHex: "#d7dde6",
      opacity: 1,
      roughness: 0.04,
      metalness: 0.9,
      transmission: 0,
    },
    notes: [
      "Mirror coating orientation matters; preserve front-versus-rear surface metadata during future integration.",
      "Protect both the face and mirror backing during cutting and assembly.",
    ],
  }),
  freezeMaterial({
    id: "acrylic-frosted",
    label: "Frosted acrylic",
    family: "acrylic",
    subtype: "frosted",
    stockPresets: acrylicStocks("acrylic-frosted"),
    processCompatibility: ACRYLIC_STANDARD_COMPATIBILITY,
    appearance: {
      kind: "frosted",
      baseColorHex: "#e8f4f5",
      opacity: 0.72,
      roughness: 0.64,
      metalness: 0,
      transmission: 0.36,
    },
    notes: [
      "Frosting may be one-sided or two-sided; surface orientation belongs in future stock metadata.",
      "Light diffusion varies by product and thickness.",
    ],
  }),
]);

export function materialById(id: string): MaterialCatalogEntry | undefined {
  return MATERIAL_CATALOG.find((entry) => entry.id === id);
}

export function materialsForFamily(
  family: MaterialFamily,
): readonly MaterialCatalogEntry[] {
  return MATERIAL_CATALOG.filter((entry) => entry.family === family);
}

export function stockPresetsForMaterial(
  materialId: string,
): readonly CatalogStockPreset[] {
  return materialById(materialId)?.stockPresets ?? [];
}

export function compatibilityForProcess(
  materialId: string,
  process: CatalogProcess,
): ProcessCompatibility | undefined {
  return materialById(materialId)?.processCompatibility.find(
    (entry) => entry.process === process,
  );
}

export function resolveCatalogThickness(
  preset: CatalogStockPreset,
  measuredThicknessMm?: number | null,
): ResolvedCatalogThickness {
  if (measuredThicknessMm !== undefined && measuredThicknessMm !== null) {
    if (!Number.isFinite(measuredThicknessMm) || measuredThicknessMm <= 0) {
      throw new RangeError("Measured thickness must be a positive finite number.");
    }
    return Object.freeze({
      thicknessMm: measuredThicknessMm,
      source: "measured",
      measurementPolicy: preset.measurementPolicy,
      needsMeasurement: false,
    });
  }

  return Object.freeze({
    thicknessMm: preset.nominalThicknessMm,
    source: "nominal",
    measurementPolicy: preset.measurementPolicy,
    needsMeasurement: preset.measurementPolicy !== "nominal-is-exact",
  });
}

export function catalogIntegrityIssues(
  catalog: readonly MaterialCatalogEntry[] = MATERIAL_CATALOG,
): string[] {
  const issues: string[] = [];
  const materialIds = new Set<string>();
  const stockIds = new Set<string>();

  for (const material of catalog) {
    if (materialIds.has(material.id)) {
      issues.push(`Duplicate material ID: ${material.id}`);
    }
    materialIds.add(material.id);

    const seenProcesses = new Set<CatalogProcess>();
    for (const process of material.processCompatibility) {
      if (seenProcesses.has(process.process)) {
        issues.push(`Duplicate process ${process.process} for ${material.id}`);
      }
      seenProcesses.add(process.process);
      if (process.note.trim().length === 0) {
        issues.push(`Empty process note for ${material.id}:${process.process}`);
      }
    }
    for (const process of CATALOG_PROCESSES) {
      if (!seenProcesses.has(process)) {
        issues.push(`Missing process ${process} for ${material.id}`);
      }
    }

    for (const preset of material.stockPresets) {
      if (stockIds.has(preset.id)) {
        issues.push(`Duplicate stock ID: ${preset.id}`);
      }
      stockIds.add(preset.id);
      if (!preset.id.startsWith(`${material.id}:`)) {
        issues.push(`Stock ID is not material-scoped: ${preset.id}`);
      }
      if (
        !Number.isFinite(preset.nominalThicknessMm) ||
        preset.nominalThicknessMm <= 0
      ) {
        issues.push(`Invalid nominal thickness: ${preset.id}`);
      }
    }

    const appearanceValues = [
      material.appearance.opacity,
      material.appearance.roughness,
      material.appearance.metalness,
      material.appearance.transmission,
    ];
    if (appearanceValues.some((value) => value < 0 || value > 1)) {
      issues.push(`Appearance value outside 0..1: ${material.id}`);
    }
    if (!/^#[0-9a-f]{6}$/iu.test(material.appearance.baseColorHex)) {
      issues.push(`Invalid appearance color: ${material.id}`);
    }
  }

  return issues;
}
