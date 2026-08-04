import {
  createBlankProject,
  identityTransform,
  type LaserxProject,
  type Layer,
} from "@laserx/domain";
import { describe, expect, it } from "vitest";

import { PhysicalPreviewAssemblyCache } from "../src/cache.js";
import {
  createPhysicalPreviewTaskRequest,
  fingerprintPhysicalPreviewInput,
  runPhysicalPreviewTask,
} from "../src/task.js";

const FACE_LAYER_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const BACKING_LAYER_ID = "aaaaaaaa-0000-4000-8000-000000000002";
const PREVIEW_LAYER_ID = "aaaaaaaa-0000-4000-8000-000000000003";

function physicalLayer(
  id: string,
  name: string,
  role: "face" | "backing",
  thicknessMm: number,
): Layer {
  return {
    id,
    name,
    visible: true,
    locked: false,
    manufacturing: {
      role,
      material: role === "backing" ? "acrylic" : "mild-steel",
      thicknessMm,
      stockThicknessDesignation: null,
      process: "laser",
      notes: "",
      registrationGroup: null,
      registrationHoleIds: [],
    },
  };
}

function previewLayer(): Layer {
  return {
    id: PREVIEW_LAYER_ID,
    name: "Customer notes",
    visible: true,
    locked: false,
    manufacturing: {
      role: "non-cut-preview",
      material: "other",
      thicknessMm: 1,
      stockThicknessDesignation: null,
      process: "non-cut",
      notes: "",
      registrationGroup: null,
      registrationHoleIds: [],
    },
  };
}

function rectangle(id: string, layerId: string, xMm: number, widthMm: number) {
  return {
    id,
    type: "rectangle" as const,
    layerId,
    transform: identityTransform(),
    origin: { xMm, yMm: 10 },
    widthMm,
    heightMm: 40,
  };
}

function projectFixture(): LaserxProject {
  return createBlankProject({
    id: "cccccccc-0000-4000-8000-000000000001",
    documentId: "cccccccc-0000-4000-8000-000000000002",
    name: "Preview Worker Fixture",
    now: "2026-08-04T12:00:00.000Z",
    width: 200,
    height: 100,
    inputUnit: "millimeters",
    layers: [
      physicalLayer(FACE_LAYER_ID, "Face", "face", 3),
      previewLayer(),
      physicalLayer(BACKING_LAYER_ID, "Backing", "backing", 6),
    ],
    activeLayerId: FACE_LAYER_ID,
    objects: [
      rectangle("dddddddd-0000-4000-8000-000000000001", FACE_LAYER_ID, 10, 80),
      rectangle("dddddddd-0000-4000-8000-000000000002", PREVIEW_LAYER_ID, 20, 30),
      rectangle("dddddddd-0000-4000-8000-000000000003", BACKING_LAYER_ID, 5, 120),
    ],
  });
}

describe("physical preview task fingerprint", () => {
  it("is deterministic and excludes editor-only active-layer state", () => {
    const project = projectFixture();
    const changedSelection = structuredClone(project);
    changedSelection.document.activeLayerId = BACKING_LAYER_ID;

    expect(fingerprintPhysicalPreviewInput(project)).toBe(
      fingerprintPhysicalPreviewInput(project),
    );
    expect(fingerprintPhysicalPreviewInput(changedSelection)).toBe(
      fingerprintPhysicalPreviewInput(project),
    );
  });

  it("changes for physical geometry, thickness, and assembly spacing", () => {
    const project = projectFixture();
    const geometryChanged = structuredClone(project);
    const rectangleObject = geometryChanged.document.objects.find(
      (object) => object.id === "dddddddd-0000-4000-8000-000000000001",
    );
    if (rectangleObject?.type !== "rectangle") throw new Error("Expected rectangle.");
    rectangleObject.widthMm += 1;

    const thicknessChanged = structuredClone(project);
    const face = thicknessChanged.document.layers.find((layer) => layer.id === FACE_LAYER_ID);
    if (face?.manufacturing === undefined) throw new Error("Expected physical layer.");
    face.manufacturing.thicknessMm = 4;

    const baseline = fingerprintPhysicalPreviewInput(project);
    expect(fingerprintPhysicalPreviewInput(geometryChanged)).not.toBe(baseline);
    expect(fingerprintPhysicalPreviewInput(thicknessChanged)).not.toBe(baseline);
    expect(
      fingerprintPhysicalPreviewInput(project, { spacing: { explodedGapMm: 40 } }),
    ).not.toBe(baseline);
  });
});

describe("physical preview task", () => {
  it("emits honest ordered progress, builds the assembly, and leaves input unchanged", () => {
    const project = projectFixture();
    const before = JSON.stringify(project);
    const request = createPhysicalPreviewTaskRequest("preview-1", project);
    const progress: Array<{ stage: string; percent: number }> = [];

    const result = runPhysicalPreviewTask(request, (event) => {
      progress.push({ stage: event.stage, percent: event.percent });
    });

    expect(progress).toEqual([
      { stage: "preparing", percent: 5 },
      { stage: "building", percent: 10 },
      { stage: "complete", percent: 100 },
    ]);
    expect(result.operationId).toBe("preview-1");
    expect(result.inputFingerprint).toBe(request.inputFingerprint);
    expect(result.assembly.layers.map((layer) => layer.layerId)).toEqual([
      FACE_LAYER_ID,
      BACKING_LAYER_ID,
    ]);
    expect(result.assembly.assembledDepthMm).toBe(9);
    expect(JSON.stringify(project)).toBe(before);
  });

  it("rejects a request whose fingerprint is not bound to its snapshot", () => {
    const request = createPhysicalPreviewTaskRequest("preview-2", projectFixture());
    expect(() =>
      runPhysicalPreviewTask({ ...request, inputFingerprint: "stale-fingerprint" }),
    ).toThrow(/fingerprint does not match/u);
  });
});

describe("physical preview assembly cache", () => {
  it("returns clones and cannot be mutated through a consumer result", () => {
    const result = runPhysicalPreviewTask(
      createPhysicalPreviewTaskRequest("preview-3", projectFixture()),
    );
    const cache = new PhysicalPreviewAssemblyCache();
    cache.set(result);

    const first = cache.get(result.inputFingerprint);
    if (first === null) throw new Error("Expected cached assembly.");
    const firstLayer = first.layers[0];
    if (firstLayer === undefined) throw new Error("Expected cached layer.");
    firstLayer.name = "Mutated consumer value";

    const second = cache.get(result.inputFingerprint);
    expect(second?.layers[0]?.name).toBe("Face");
    expect(cache.size).toBe(1);
  });

  it("evicts the least recently used entry at its configured bound", () => {
    const cache = new PhysicalPreviewAssemblyCache(2);
    const baseProject = projectFixture();
    const secondProject = structuredClone(baseProject);
    secondProject.project.updatedAt = "2026-08-04T12:01:00.000Z";
    const thirdProject = structuredClone(baseProject);
    thirdProject.project.updatedAt = "2026-08-04T12:02:00.000Z";

    const first = runPhysicalPreviewTask(createPhysicalPreviewTaskRequest("a", baseProject));
    const second = runPhysicalPreviewTask(createPhysicalPreviewTaskRequest("b", secondProject));
    const third = runPhysicalPreviewTask(createPhysicalPreviewTaskRequest("c", thirdProject));

    cache.set(first);
    cache.set(second);
    expect(cache.get(first.inputFingerprint)).not.toBeNull();
    cache.set(third);

    expect(cache.get(first.inputFingerprint)).not.toBeNull();
    expect(cache.get(second.inputFingerprint)).toBeNull();
    expect(cache.get(third.inputFingerprint)).not.toBeNull();
  });
});
