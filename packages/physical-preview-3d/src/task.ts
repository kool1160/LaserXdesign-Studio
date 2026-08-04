import type { LaserxProject } from "@laserx/domain";

import {
  buildPhysicalPreviewAssembly,
  isPhysicalManufacturingLayer,
  type BuildPhysicalPreviewAssemblyOptions,
  type PhysicalPreviewAssembly,
} from "./index.js";

export type PhysicalPreviewTaskStage = "preparing" | "building" | "complete";

export interface PhysicalPreviewTaskProgress {
  operationId: string;
  inputFingerprint: string;
  stage: PhysicalPreviewTaskStage;
  percent: number;
  message: string;
}

export interface PhysicalPreviewTaskRequest {
  operationId: string;
  inputFingerprint: string;
  project: LaserxProject;
  options?: BuildPhysicalPreviewAssemblyOptions;
}

export interface PhysicalPreviewTaskResult {
  operationId: string;
  inputFingerprint: string;
  assembly: PhysicalPreviewAssembly;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

function hashChunk(value: string, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }
  return hash;
}

function hashCanonical(value: unknown): string {
  const canonical = JSON.stringify(canonicalize(value));
  return [
    hashChunk(canonical, 2_166_136_261),
    hashChunk(canonical, 2_166_136_261 ^ 0x9e3779b9),
    hashChunk(canonical, 2_166_136_261 ^ 0x85ebca6b),
    hashChunk(canonical, 2_166_136_261 ^ 0xc2b2ae35),
  ]
    .map((chunk) => chunk.toString(16).padStart(8, "0"))
    .join("");
}

function cloneOptions(
  options: BuildPhysicalPreviewAssemblyOptions | undefined,
): BuildPhysicalPreviewAssemblyOptions | undefined {
  return options?.spacing === undefined
    ? undefined
    : { spacing: { ...options.spacing } };
}

/**
 * Fingerprints only the immutable project snapshot and assembly options that can
 * change physical topology, thickness, material identity, order, or Z spacing.
 * Camera, view preset, assembled/exploded display mode, orbit state, and
 * presentation-only visibility are deliberately absent and therefore cannot
 * invalidate this expensive scene-analysis cache.
 */
export function fingerprintPhysicalPreviewInput(
  project: LaserxProject,
  options?: BuildPhysicalPreviewAssemblyOptions,
): string {
  const physicalLayers = project.document.layers.filter(isPhysicalManufacturingLayer);
  const physicalLayerIds = new Set(physicalLayers.map((layer) => layer.id));
  const physicalObjects = project.document.objects.filter((object) =>
    physicalLayerIds.has(object.layerId),
  );

  return hashCanonical({
    projectId: project.project.id,
    projectUpdatedAt: project.project.updatedAt,
    documentId: project.document.id,
    dimensions: project.document.dimensions,
    layers: physicalLayers,
    objects: physicalObjects,
    spacing: options?.spacing ?? null,
  });
}

export function createPhysicalPreviewTaskRequest(
  operationId: string,
  project: LaserxProject,
  options?: BuildPhysicalPreviewAssemblyOptions,
): PhysicalPreviewTaskRequest {
  const clonedOptions = cloneOptions(options);
  return {
    operationId,
    inputFingerprint: fingerprintPhysicalPreviewInput(project, clonedOptions),
    project: structuredClone(project),
    ...(clonedOptions === undefined ? {} : { options: clonedOptions }),
  };
}

/**
 * Runs the pure physical-scene build inside the caller's execution context.
 * Production calls this from the dedicated worker. Progress is intentionally
 * coarse and honest: the underlying synchronous topology analysis has no
 * interrupt checkpoints, so cancellation is performed by terminating the
 * worker rather than pretending the pure function can stop mid-call.
 */
export function runPhysicalPreviewTask(
  request: PhysicalPreviewTaskRequest,
  onProgress?: (progress: PhysicalPreviewTaskProgress) => void,
): PhysicalPreviewTaskResult {
  const actualFingerprint = fingerprintPhysicalPreviewInput(request.project, request.options);
  if (actualFingerprint !== request.inputFingerprint) {
    throw new Error(
      "Physical preview request fingerprint does not match its immutable project snapshot.",
    );
  }

  const progress = (
    stage: PhysicalPreviewTaskStage,
    percent: number,
    message: string,
  ): void => {
    onProgress?.({
      operationId: request.operationId,
      inputFingerprint: request.inputFingerprint,
      stage,
      percent,
      message,
    });
  };

  progress("preparing", 5, "Preparing the physical project snapshot.");
  progress("building", 10, "Analyzing physical layers and building the preview scene.");
  const assembly = buildPhysicalPreviewAssembly(request.project, request.options);
  progress("complete", 100, "Physical preview scene is ready.");

  return {
    operationId: request.operationId,
    inputFingerprint: request.inputFingerprint,
    assembly,
  };
}
