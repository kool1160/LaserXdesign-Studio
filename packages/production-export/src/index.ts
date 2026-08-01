import { createHash } from "node:crypto";

import {
  PROJECT_SCHEMA_VERSION,
  copyDocument,
  getObjectBounds,
  type BoundsMm,
  type DocumentObject,
  type LaserxDocument,
  type LaserxProject,
  type ManufacturingLayerMetadata,
  type PointMm,
} from "@laserx/domain";
import { exportDxf } from "@laserx/io-dxf";
import { exportSvg } from "@laserx/io-svg";

export const PRODUCTION_PACKAGE_SCHEMA_VERSION = 1 as const;
export type ProductionArtifactFormat = "svg" | "dxf";

export interface ProductionPackageRequest {
  layerIds?: readonly string[];
  formats?: readonly ProductionArtifactFormat[];
}

export interface ProductionManifestFile {
  name: string;
  format: ProductionArtifactFormat;
  byteLength: number;
  sha256: string;
}

export interface ProductionRegistrationHole {
  xMm: number;
  yMm: number;
  diameterMm: number;
}

export interface ProductionManifestLayer {
  id: string;
  name: string;
  role: ManufacturingLayerMetadata["role"];
  material: ManufacturingLayerMetadata["material"];
  thicknessMm: number;
  process: ManufacturingLayerMetadata["process"];
  notes: string;
  registrationGroup: string | null;
  objectCount: number;
  boundsMm: BoundsMm | null;
  registrationHoles: ProductionRegistrationHole[];
  files: ProductionManifestFile[];
  warnings: string[];
}

export interface ProductionPackageManifest {
  schemaVersion: typeof PRODUCTION_PACKAGE_SCHEMA_VERSION;
  sourceProjectVersion: typeof PROJECT_SCHEMA_VERSION;
  sourceProjectId: string;
  sourceDocumentId: string;
  sourceUpdatedAt: string;
  packageName: string;
  units: "millimeters";
  originMm: { xMm: 0; yMm: 0 };
  stockMm: { widthMm: number; heightMm: number };
  layers: ProductionManifestLayer[];
  warnings: string[];
}

export interface ProductionPackageFile {
  name: string;
  content: string;
  format: ProductionArtifactFormat | "manifest";
  layerId: string | null;
}

export interface ProductionAssemblyLayer {
  layerId: string;
  name: string;
  role: Exclude<ManufacturingLayerMetadata["role"], "non-cut-preview">;
  offsetMm: { xMm: number; yMm: number };
  boundsMm: BoundsMm | null;
}

export interface ProductionPackage {
  name: string;
  files: ProductionPackageFile[];
  manifest: ProductionPackageManifest;
  manifestJson: string;
  assemblyPreview: ProductionAssemblyLayer[];
}

export interface ProductionAssemblyPreview {
  packageName: string;
  layers: ProductionAssemblyLayer[];
}

function safeFilePart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .toLocaleLowerCase()
    .slice(0, 80) || "layer";
}

function filteredLayerDocument(
  document: LaserxDocument,
  layerId: string,
): LaserxDocument {
  const layer = document.layers.find((candidate) => candidate.id === layerId);
  if (layer === undefined) {
    throw new RangeError("The requested production layer does not exist.");
  }
  const filtered = copyDocument(document);
  filtered.layers = [{ ...layer, visible: true }];
  filtered.activeLayerId = layer.id;
  filtered.objects = filtered.objects.filter(
    (object) => object.layerId === layer.id,
  );
  return filtered;
}

function digest(content: string): Pick<ProductionManifestFile, "byteLength" | "sha256"> {
  return {
    byteLength: Buffer.byteLength(content, "utf8"),
    sha256: createHash("sha256").update(content, "utf8").digest("hex"),
  };
}

function registrationHoles(
  document: LaserxDocument,
  layerId: string,
): ProductionRegistrationHole[] {
  return document.objects
    .filter(
      (object): object is Extract<DocumentObject, { type: "ellipse" }> =>
        object.layerId === layerId && object.type === "ellipse",
    )
    .map((object) => {
      const bounds = getObjectBounds(object);
      return {
        xMm: (bounds.minXmm + bounds.maxXmm) / 2,
        yMm: (bounds.minYmm + bounds.maxYmm) / 2,
        diameterMm: Math.min(
          bounds.maxXmm - bounds.minXmm,
          bounds.maxYmm - bounds.minYmm,
        ),
      };
    })
    .sort((left, right) =>
      left.xMm - right.xMm ||
      left.yMm - right.yMm ||
      left.diameterMm - right.diameterMm,
    );
}

function registrationKey(hole: ProductionRegistrationHole): string {
  return [hole.xMm, hole.yMm, hole.diameterMm]
    .map((value) => value.toFixed(6))
    .join(":");
}

function alignmentWarnings(layers: readonly ProductionManifestLayer[]): string[] {
  const warnings: string[] = [];
  const groups = new Map<string, ProductionManifestLayer[]>();
  for (const layer of layers) {
    if (layer.registrationGroup === null) continue;
    const group = groups.get(layer.registrationGroup) ?? [];
    group.push(layer);
    groups.set(layer.registrationGroup, group);
  }
  for (const [groupName, groupLayers] of groups) {
    if (groupLayers.length < 2) continue;
    const reference = (groupLayers[0]?.registrationHoles ?? [])
      .map(registrationKey)
      .join("|");
    for (const layer of groupLayers.slice(1)) {
      const candidate = layer.registrationHoles.map(registrationKey).join("|");
      if (candidate !== reference) {
        warnings.push(
          `Registration group ${groupName} is not numerically aligned on layer ${layer.name}.`,
        );
      }
    }
  }
  return warnings;
}

function layerBounds(
  document: LaserxDocument,
  layerId: string,
): BoundsMm | null {
  const objects = document.objects.filter((object) => object.layerId === layerId);
  if (objects.length === 0) return null;
  return objects.map((object) => getObjectBounds(object)).reduce((current, next) => ({
    minXmm: Math.min(current.minXmm, next.minXmm),
    minYmm: Math.min(current.minYmm, next.minYmm),
    maxXmm: Math.max(current.maxXmm, next.maxXmm),
    maxYmm: Math.max(current.maxYmm, next.maxYmm),
  }));
}

export function buildProductionAssemblyPreview(
  project: LaserxProject,
): ProductionAssemblyPreview | null {
  const layers = project.document.layers.filter(
    (layer) =>
      layer.manufacturing !== undefined &&
      layer.manufacturing.role !== "non-cut-preview",
  );
  if (layers.length === 0) return null;
  return {
    packageName: `${safeFilePart(project.project.name)}-production`,
    layers: layers.map((layer, index) => ({
      layerId: layer.id,
      name: layer.name,
      role: layer.manufacturing?.role as Exclude<ManufacturingLayerMetadata["role"], "non-cut-preview">,
      offsetMm: { xMm: index * 12, yMm: index * -12 },
      boundsMm: layerBounds(project.document, layer.id),
    })),
  };
}

export function buildProductionPackage(
  project: LaserxProject,
  request: ProductionPackageRequest = {},
): ProductionPackage {
  const requestedIds = request.layerIds === undefined
    ? null
    : new Set(request.layerIds);
  if (requestedIds !== null && requestedIds.size !== request.layerIds?.length) {
    throw new RangeError("Production layer selections must be unique.");
  }
  const formats = request.formats === undefined
    ? (["svg", "dxf"] as const)
    : [...new Set(request.formats)];
  if (formats.length === 0) {
    throw new RangeError("Select at least one production export format.");
  }
  const taggedLayers = project.document.layers.filter(
    (layer) => layer.manufacturing !== undefined,
  );
  if (
    requestedIds !== null &&
    [...requestedIds].some(
      (id) => !taggedLayers.some((layer) => layer.id === id),
    )
  ) {
    throw new RangeError("Only explicitly declared manufacturing layers can be exported.");
  }
  const layers = taggedLayers.filter(
    (layer) =>
      layer.manufacturing?.role !== "non-cut-preview" &&
      (requestedIds === null || requestedIds.has(layer.id)),
  );
  if (layers.length === 0) {
    throw new RangeError("Declare and select at least one physical manufacturing layer.");
  }

  const packageName = `${safeFilePart(project.project.name)}-production`;
  const files: ProductionPackageFile[] = [];
  const manifestLayers: ProductionManifestLayer[] = [];
  for (const [index, layer] of layers.entries()) {
    const metadata = layer.manufacturing as ManufacturingLayerMetadata;
    const document = filteredLayerDocument(project.document, layer.id);
    const prefix = `${String(index + 1).padStart(2, "0")}-${safeFilePart(metadata.role)}-${safeFilePart(layer.name)}`;
    const manifestFiles: ProductionManifestFile[] = [];
    const warnings = new Set<string>();
    let exportedBounds: BoundsMm | null | undefined;
    for (const format of formats) {
      const artifact = format === "svg" ? exportSvg(document) : exportDxf(document);
      const name = `${prefix}.${format}`;
      files.push({ name, content: artifact.content, format, layerId: layer.id });
      manifestFiles.push({ name, format, ...digest(artifact.content) });
      exportedBounds ??= artifact.summary.bounds;
      artifact.summary.warnings.forEach((warning) => warnings.add(warning.message));
    }
    manifestLayers.push({
      id: layer.id,
      name: layer.name,
      role: metadata.role,
      material: metadata.material,
      thicknessMm: metadata.thicknessMm,
      process: metadata.process,
      notes: metadata.notes,
      registrationGroup: metadata.registrationGroup,
      objectCount: document.objects.length,
      boundsMm: exportedBounds ?? null,
      registrationHoles: registrationHoles(project.document, layer.id),
      files: manifestFiles,
      warnings: [...warnings],
    });
  }

  const warnings = alignmentWarnings(manifestLayers);
  const excludedPreviewCount = taggedLayers.filter(
    (layer) =>
      layer.manufacturing?.role === "non-cut-preview" &&
      (requestedIds === null || requestedIds.has(layer.id)),
  ).length;
  if (excludedPreviewCount > 0) {
    warnings.push(
      `${String(excludedPreviewCount)} non-cut preview layer(s) were intentionally excluded from manufacturing files.`,
    );
  }
  const manifest: ProductionPackageManifest = {
    schemaVersion: PRODUCTION_PACKAGE_SCHEMA_VERSION,
    sourceProjectVersion: PROJECT_SCHEMA_VERSION,
    sourceProjectId: project.project.id,
    sourceDocumentId: project.document.id,
    sourceUpdatedAt: project.project.updatedAt,
    packageName,
    units: "millimeters",
    originMm: { xMm: 0, yMm: 0 },
    stockMm: { ...project.document.dimensions },
    layers: manifestLayers,
    warnings,
  };
  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  files.push({
    name: "manifest.json",
    content: manifestJson,
    format: "manifest",
    layerId: null,
  });
  return {
    name: packageName,
    files,
    manifest,
    manifestJson,
    assemblyPreview: manifestLayers.map((layer, index) => ({
      layerId: layer.id,
      name: layer.name,
      role: layer.role as Exclude<ManufacturingLayerMetadata["role"], "non-cut-preview">,
      offsetMm: { xMm: index * 12, yMm: index * -12 },
      boundsMm: layer.boundsMm,
    })),
  };
}

export function manufacturingLayerObjectIds(
  document: LaserxDocument,
  layerId: string,
): string[] {
  const layer = document.layers.find((candidate) => candidate.id === layerId);
  if (
    layer?.manufacturing === undefined ||
    layer.manufacturing.role === "non-cut-preview"
  ) {
    throw new RangeError("Scoped analysis requires a physical manufacturing layer.");
  }
  return document.objects
    .filter((object) => object.layerId === layerId)
    .map((object) => object.id);
}

export function sharedRegistrationPoints(
  project: LaserxProject,
  registrationGroup: string,
): ReadonlyMap<string, readonly PointMm[]> {
  const result = new Map<string, readonly PointMm[]>();
  for (const layer of project.document.layers) {
    if (layer.manufacturing?.registrationGroup !== registrationGroup) continue;
    result.set(
      layer.id,
      registrationHoles(project.document, layer.id).map(({ xMm, yMm }) => ({
        xMm,
        yMm,
      })),
    );
  }
  return result;
}
