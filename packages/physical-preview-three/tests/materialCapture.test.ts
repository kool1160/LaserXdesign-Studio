import type { PhysicalPreviewAssembly } from "@laserx/physical-preview-3d";
import { describe, expect, it } from "vitest";

import {
  analyzePixelContent,
  buildCaptureFilename,
  readPngHeader,
  validatePngCapture,
  type CapturableCanvas,
} from "../src/capture.js";
import {
  createLayerMaterial,
  disposeMaterials,
  materialAppearance,
  NEUTRAL_FALLBACK_APPEARANCE,
} from "../src/material.js";
import { buildPreviewResources } from "../src/resources.js";

describe("material appearance", () => {
  it("gives every current schema material a distinct appearance", () => {
    const materials = [
      "mild-steel",
      "stainless-steel",
      "aluminum",
      "wood",
      "acrylic",
      "other",
    ];
    const colors = new Set(materials.map((material) => materialAppearance(material).color));
    // All six are visually distinguishable from each other.
    expect(colors.size).toBe(6);
    // `other` is the one that deliberately equals the neutral fallback: it is
    // the schema's own "unspecified" value, so it should look unspecified.
    expect(materialAppearance("other")).toEqual(NEUTRAL_FALLBACK_APPEARANCE);
    expect(materialAppearance("acrylic").transparent).toBe(true);
    expect(materialAppearance("mild-steel").transparent).toBe(false);
  });

  it("falls back neutrally for an unknown material instead of throwing", () => {
    // A future catalog material must degrade visibly, not crash the preview.
    expect(materialAppearance("basalt-composite")).toEqual(NEUTRAL_FALLBACK_APPEARANCE);
  });

  it("returns copies so the shared table cannot be mutated", () => {
    const first = materialAppearance("wood");
    first.color = "#000000";
    expect(materialAppearance("wood").color).not.toBe("#000000");
  });

  it("creates and disposes Three materials", () => {
    const material = createLayerMaterial(materialAppearance("acrylic"));
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBeCloseTo(0.55, 9);
    disposeMaterials([material]);
  });
});

/** A minimal 1×1 PNG, used as a real byte-level fixture. */
const ONE_BY_ONE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function canvas(dataUrl: string, width = 1280, height = 694): CapturableCanvas {
  return { width, height, toDataURL: () => dataUrl };
}

describe("PNG capture validation", () => {
  const BACKGROUND = { r: 0x2b, g: 0x2b, b: 0x2b };

  /** RGBA buffer filled with the background colour — a blank frame. */
  const blankPixels = (width: number, height: number): Uint8Array => {
    const rgba = new Uint8Array(width * height * 4);
    for (let index = 0; index < rgba.length; index += 4) {
      rgba[index] = BACKGROUND.r;
      rgba[index + 1] = BACKGROUND.g;
      rgba[index + 2] = BACKGROUND.b;
      rgba[index + 3] = 255;
    }
    return rgba;
  };

  it("reports structure-only, not success, when no content evidence is supplied", () => {
    const result = validatePngCapture(
      canvas(`data:image/png;base64,${ONE_BY_ONE_PNG_BASE64}`),
      "out.png",
    );
    // A cleared drawing buffer encodes to a perfectly valid PNG, so header
    // validation alone must never be reported as a verified capture.
    expect(result.ok).toBe(false);
    expect(result.status).toBe("structure-only");
    if (result.status !== "structure-only") throw new Error("unreachable");
    // Dimensions come from the IHDR header, not from the canvas element, so a
    // canvas that lies about its size cannot fake them.
    expect(result.widthPx).toBe(1);
    expect(result.heightPx).toBe(1);
    expect(result.byteLength).toBeGreaterThan(64);
  });

  it("rejects a structurally valid PNG whose pixels are all background", () => {
    const result = validatePngCapture(
      canvas(`data:image/png;base64,${ONE_BY_ONE_PNG_BASE64}`),
      "out.png",
      { rgba: blankPixels(8, 8), widthPx: 8, heightPx: 8, background: BACKGROUND },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.errorMessage).toContain("only background pixels");
  });

  it("accepts a capture with real non-background content", () => {
    const rgba = blankPixels(8, 8);
    // One clearly non-background pixel is the weakest honest claim.
    rgba[0] = 255;
    rgba[1] = 255;
    rgba[2] = 255;

    const result = validatePngCapture(
      canvas(`data:image/png;base64,${ONE_BY_ONE_PNG_BASE64}`),
      "out.png",
      { rgba, widthPx: 8, heightPx: 8, background: BACKGROUND },
    );
    if (!result.ok) throw new Error(`expected success, got ${result.errorMessage}`);
    expect(result.status).toBe("verified");
    expect(result.content.nonBackgroundPixels).toBe(1);
    expect(result.content.sampledPixels).toBe(64);
    expect(result.widthPx).toBe(1);
  });

  it("treats a fully transparent buffer as blank", () => {
    const rgba = new Uint8Array(8 * 8 * 4); // alpha 0 everywhere
    const evidence = analyzePixelContent(rgba, 8, 8, BACKGROUND);
    expect(evidence.nonBackgroundPixels).toBe(0);
  });

  it("does not count antialiasing noise as content", () => {
    const rgba = blankPixels(4, 4);
    rgba[0] = BACKGROUND.r + 4; // within the default tolerance
    expect(analyzePixelContent(rgba, 4, 4, BACKGROUND).nonBackgroundPixels).toBe(0);
    rgba[0] = BACKGROUND.r + 40; // clearly beyond it
    expect(analyzePixelContent(rgba, 4, 4, BACKGROUND).nonBackgroundPixels).toBe(1);
  });

  it("enforces a caller-supplied minimum coverage ratio", () => {
    const rgba = blankPixels(10, 10);
    rgba[0] = 255;
    const result = validatePngCapture(
      canvas(`data:image/png;base64,${ONE_BY_ONE_PNG_BASE64}`),
      "out.png",
      {
        rgba,
        widthPx: 10,
        heightPx: 10,
        background: BACKGROUND,
        minimumNonBackgroundRatio: 0.05,
      },
    );
    // 1/100 is below the 5% the caller demanded.
    expect(result.ok).toBe(false);
  });

  it("rejects mismatched pixel buffer dimensions rather than guessing", () => {
    const result = validatePngCapture(
      canvas(`data:image/png;base64,${ONE_BY_ONE_PNG_BASE64}`),
      "out.png",
      { rgba: new Uint8Array(16), widthPx: 100, heightPx: 100, background: BACKGROUND },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.errorMessage).toContain("RGBA bytes");
  });

  it("rejects a zero-sized canvas", () => {
    const result = validatePngCapture(canvas("data:,", 0, 0), "out.png");
    expect(result.ok).toBe(false);
  });

  it("rejects an empty data URL", () => {
    expect(validatePngCapture(canvas("data:,"), "out.png").ok).toBe(false);
  });

  it("rejects bytes that are not a PNG", () => {
    // Correct length, wrong signature — the byte-length check alone would pass.
    const notPng = Buffer.alloc(256, 7).toString("base64");
    const result = validatePngCapture(canvas(`data:image/png;base64,${notPng}`), "out.png");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.errorMessage).toContain("valid PNG");
  });

  it("rejects a truncated PNG", () => {
    const truncated = Buffer.from(ONE_BY_ONE_PNG_BASE64, "base64")
      .subarray(0, 20)
      .toString("base64");
    expect(validatePngCapture(canvas(`data:image/png;base64,${truncated}`), "out.png").ok).toBe(
      false,
    );
  });

  it("rejects a PNG declaring zero dimensions", () => {
    const bytes = Buffer.from(ONE_BY_ONE_PNG_BASE64, "base64");
    bytes.writeUInt32BE(0, 16);
    expect(readPngHeader(new Uint8Array(bytes))).toBeNull();
  });

  it("surfaces a canvas readback failure as an error rather than throwing", () => {
    const result = validatePngCapture(
      {
        width: 10,
        height: 10,
        toDataURL: () => {
          throw new Error("tainted canvas");
        },
      },
      "out.png",
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.errorMessage).toBe("tainted canvas");
  });
});

describe("capture filenames", () => {
  it("is deterministic for the same project, view, and mode", () => {
    const input = { projectName: "Riverside Welding", view: "front", mode: "assembled" } as const;
    expect(buildCaptureFilename(input)).toBe(buildCaptureFilename(input));
    expect(buildCaptureFilename(input)).toBe("laserx-preview-riverside-welding-front-assembled.png");
  });

  it("varies with view and mode", () => {
    const base = { projectName: "Sign", view: "front", mode: "assembled" } as const;
    expect(buildCaptureFilename({ ...base, view: "edge" })).not.toBe(buildCaptureFilename(base));
    expect(buildCaptureFilename({ ...base, mode: "exploded" })).not.toBe(
      buildCaptureFilename(base),
    );
  });

  it("produces a safe name for hostile project names", () => {
    expect(
      buildCaptureFilename({ projectName: "../../etc/passwd", view: "front", mode: "assembled" }),
    ).toBe("laserx-preview-etc-passwd-front-assembled.png");
    expect(
      buildCaptureFilename({ projectName: "   ", view: "front", mode: "assembled" }),
    ).toBe("laserx-preview-project-front-assembled.png");
  });
});

describe("resource lifecycle", () => {
  const assembly = (): PhysicalPreviewAssembly =>
    ({
      identity: { projectId: "p", documentId: "d", projectUpdatedAt: "t" },
      stockMm: { widthMm: 100, heightMm: 50 },
      status: "partial",
      spacing: { assembledGapMm: 0, explodedGapMm: 20 },
      layers: [
        {
          layerId: "solid",
          name: "Face",
          role: "face",
          thicknessMm: 3,
          material: { material: "wood", stockThicknessDesignation: null, displayLabel: "" },
          shapes: [
            {
              id: "s1",
              outerContour: {
                points: [
                  { xMm: 0, yMm: 0 },
                  { xMm: 10, yMm: 0 },
                  { xMm: 10, yMm: 10 },
                  { xMm: 0, yMm: 10 },
                ],
              },
              holeContours: [],
              sourceObjectIds: ["o1"],
            },
          ],
          boundsMm: { minXmm: 0, minYmm: 0, maxXmm: 10, maxYmm: 10 },
          order: 0,
          assembledZRangeMm: { minZmm: 0, maxZmm: 3 },
          explodedZRangeMm: { minZmm: 0, maxZmm: 3 },
        },
        {
          layerId: "failed",
          name: "Backing",
          role: "backing",
          thicknessMm: 6,
          material: { material: "acrylic", stockThicknessDesignation: null, displayLabel: "" },
          shapes: [],
          boundsMm: null,
          order: 1,
          assembledZRangeMm: { minZmm: 3, maxZmm: 9 },
          explodedZRangeMm: { minZmm: 23, maxZmm: 29 },
        },
      ],
      assembledDepthMm: 9,
      depthStatus: "declared-incomplete",
      findings: [],
      fingerprint: "fp",
    }) as unknown as PhysicalPreviewAssembly;

  it("allocates a material only for layers that render something", () => {
    const resources = buildPreviewResources(assembly(), "assembled");
    expect([...resources.materialsByLayerId.keys()]).toEqual(["solid"]);
    expect(resources.layers).toHaveLength(2);
    expect(resources.layers[1]?.geometries).toEqual([]);
    resources.dispose();
  });

  it("disposes every geometry and material, and is idempotent", () => {
    const resources = buildPreviewResources(assembly(), "assembled");
    const geometry = resources.layers[0]?.geometries[0]?.geometry;
    const material = resources.materialsByLayerId.get("solid");
    if (geometry === undefined || material === undefined) throw new Error("expected resources");

    let geometryDisposals = 0;
    let materialDisposals = 0;
    geometry.addEventListener("dispose", () => {
      geometryDisposals += 1;
    });
    material.addEventListener("dispose", () => {
      materialDisposals += 1;
    });

    resources.dispose();
    resources.dispose();

    // Exactly once each, even though dispose() was called twice — double
    // disposal is how renderer resource bookkeeping goes wrong quietly.
    expect(geometryDisposals).toBe(1);
    expect(materialDisposals).toBe(1);
    expect(resources.materialsByLayerId.size).toBe(0);
  });

  it("stays bounded across repeated build/dispose cycles", () => {
    let liveGeometries = 0;
    let liveMaterials = 0;

    for (let cycle = 0; cycle < 12; cycle += 1) {
      const resources = buildPreviewResources(assembly(), cycle % 2 === 0 ? "assembled" : "exploded");
      for (const layer of resources.layers) {
        for (const entry of layer.geometries) {
          liveGeometries += 1;
          entry.geometry.addEventListener("dispose", () => {
            liveGeometries -= 1;
          });
        }
      }
      for (const material of resources.materialsByLayerId.values()) {
        liveMaterials += 1;
        material.addEventListener("dispose", () => {
          liveMaterials -= 1;
        });
      }
      resources.dispose();
    }

    expect(liveGeometries).toBe(0);
    expect(liveMaterials).toBe(0);
  });

  it("does not mutate the supplied assembly", () => {
    const supplied = assembly();
    const before = JSON.stringify(supplied);
    const resources = buildPreviewResources(supplied, "exploded");
    resources.dispose();
    expect(JSON.stringify(supplied)).toBe(before);
  });
});
