import {
  copyManufacturingSettings,
  type ManufacturingSettings,
} from "@laserx/domain";

export interface ManufacturingPreset {
  id: string;
  name: string;
  description: string;
  settings: ManufacturingSettings;
}

export const MANUFACTURING_PRESETS: readonly ManufacturingPreset[] = [
  {
    id: "laser-mild-steel-3mm",
    name: "Laser · mild steel · 3 mm",
    description: "Conservative editable starting values for a typical laser-cut steel sign.",
    settings: {
      presetId: "laser-mild-steel-3mm",
      process: "laser",
      material: "mild-steel",
      thicknessMm: 3,
      kerfWidthMm: 0.2,
      minimumFeatureWidthMm: 1,
      minimumBridgeWidthMm: 2,
      minimumGapMm: 0.8,
      contourSpacingMm: 1,
      heatDistortionSpacingMm: null,
      tolerancePreset: "balanced",
      customizedFields: [],
    },
  },
  {
    id: "plasma-mild-steel-6mm",
    name: "Plasma · mild steel · 6 mm",
    description: "Editable starting values with wider kerf and spacing for plasma cutting.",
    settings: {
      presetId: "plasma-mild-steel-6mm",
      process: "plasma",
      material: "mild-steel",
      thicknessMm: 6,
      kerfWidthMm: 1.4,
      minimumFeatureWidthMm: 3,
      minimumBridgeWidthMm: 5,
      minimumGapMm: 2.5,
      contourSpacingMm: 3,
      heatDistortionSpacingMm: 4,
      tolerancePreset: "robust",
      customizedFields: [],
    },
  },
  {
    id: "waterjet-aluminum-6mm",
    name: "Waterjet · aluminum · 6 mm",
    description: "Editable starting values for waterjet-cut aluminum signage.",
    settings: {
      presetId: "waterjet-aluminum-6mm",
      process: "waterjet",
      material: "aluminum",
      thicknessMm: 6,
      kerfWidthMm: 0.9,
      minimumFeatureWidthMm: 1.8,
      minimumBridgeWidthMm: 3,
      minimumGapMm: 1.5,
      contourSpacingMm: 1.8,
      heatDistortionSpacingMm: null,
      tolerancePreset: "balanced",
      customizedFields: [],
    },
  },
  {
    id: "router-acrylic-6mm",
    name: "Router · acrylic · 6 mm",
    description: "Editable starting values for a small-router acrylic workflow.",
    settings: {
      presetId: "router-acrylic-6mm",
      process: "router",
      material: "acrylic",
      thicknessMm: 6,
      kerfWidthMm: 3.175,
      minimumFeatureWidthMm: 4,
      minimumBridgeWidthMm: 5,
      minimumGapMm: 3.5,
      contourSpacingMm: 4,
      heatDistortionSpacingMm: null,
      tolerancePreset: "robust",
      customizedFields: [],
    },
  },
] as const;

export function settingsForManufacturingPreset(
  presetId: string,
): ManufacturingSettings {
  const preset = MANUFACTURING_PRESETS.find((candidate) => candidate.id === presetId);
  if (preset === undefined) {
    throw new RangeError("Choose a supported manufacturing preset.");
  }
  return copyManufacturingSettings(preset.settings);
}
