import { deflateSync } from "node:zlib";

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

/** A minimal 1×1 PNG, used for structure-only byte-level fixtures. */
const ONE_BY_ONE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function canvas(dataUrl: string, width = 1280, height = 694): CapturableCanvas {
  return { width, height, toDataURL: () => dataUrl };
}

/**
 * Encodes real, decodable RGBA pixels into a real PNG.
 *
 * Content-evidence tests need a PNG whose encoded dimensions genuinely match
 * multi-pixel content evidence, which the fixed 1×1 fixture cannot provide.
 * Uses only `node:zlib`, uncompressed deflate stored blocks and filter byte 0
 * (no per-scanline filtering) — a minimal but fully spec-valid encoder.
 */
function encodePng(rgba: Uint8Array, width: number, height: number): string {
  const crcTable = Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    return value >>> 0;
  });
  const crc32 = (bytes: Uint8Array): number => {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc = (crcTable[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Uint8Array): Buffer => {
    const typeBytes = Buffer.from(type, "ascii");
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
    return Buffer.concat([length, typeBytes, Buffer.from(data), crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  // bytes 10-12 (compression, filter, interlace) default to 0.

  const rgbaBuffer = Buffer.from(rgba);
  const scanlines = Buffer.alloc((1 + width * 4) * height);
  for (let row = 0; row < height; row += 1) {
    const rowStart = row * (1 + width * 4);
    scanlines[rowStart] = 0; // filter type "none"
    rgbaBuffer.copy(scanlines, rowStart + 1, row * width * 4, (row + 1) * width * 4);
  }

  const idat = deflateSync(scanlines);

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const png = Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", new Uint8Array(0)),
  ]);
  return png.toString("base64");
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
      canvas(`data:image/png;base64,${ONE_BY_ONE_PNG_BASE64}`, 1, 1),
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
    const rgba = blankPixels(8, 8);
    const dataUrl = `data:image/png;base64,${encodePng(rgba, 8, 8)}`;
    const result = validatePngCapture(canvas(dataUrl, 8, 8), "out.png", {
      rgba,
      widthPx: 8,
      heightPx: 8,
      background: BACKGROUND,
    });
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
    const dataUrl = `data:image/png;base64,${encodePng(rgba, 8, 8)}`;

    const result = validatePngCapture(canvas(dataUrl, 8, 8), "out.png", {
      rgba,
      widthPx: 8,
      heightPx: 8,
      background: BACKGROUND,
    });
    if (!result.ok) throw new Error(`expected success, got ${result.errorMessage}`);
    expect(result.status).toBe("verified");
    expect(result.content.nonBackgroundPixels).toBe(1);
    expect(result.content.sampledPixels).toBe(64);
    expect(result.widthPx).toBe(8);
    expect(result.heightPx).toBe(8);
  });

  it("rejects content evidence whose dimensions do not match the encoded PNG", () => {
    // The committed defect this repairs, exactly as the review demonstrated it:
    // real 1x1 PNG bytes blessed by unrelated 8x8 non-background evidence.
    const rgba = blankPixels(8, 8);
    rgba[0] = 255;
    const result = validatePngCapture(
      canvas(`data:image/png;base64,${ONE_BY_ONE_PNG_BASE64}`, 1, 1),
      "out.png",
      { rgba, widthPx: 8, heightPx: 8, background: BACKGROUND },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.errorMessage).toContain("does not match");
  });

  it("rejects content evidence when the canvas itself disagrees on size", () => {
    // Encoded PNG and evidence agree (8x8), but the canvas the caller read from
    // claims a different size — still not a trustworthy single transaction.
    const rgba = blankPixels(8, 8);
    rgba[0] = 255;
    const dataUrl = `data:image/png;base64,${encodePng(rgba, 8, 8)}`;
    const result = validatePngCapture(canvas(dataUrl, 16, 16), "out.png", {
      rgba,
      widthPx: 8,
      heightPx: 8,
      background: BACKGROUND,
    });
    expect(result.ok).toBe(false);
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
    const dataUrl = `data:image/png;base64,${encodePng(rgba, 10, 10)}`;
    const result = validatePngCapture(canvas(dataUrl, 10, 10), "out.png", {
      rgba,
      widthPx: 10,
      heightPx: 10,
      background: BACKGROUND,
      minimumNonBackgroundRatio: 0.05,
    });
    // 1/100 is below the 5% the caller demanded.
    expect(result.ok).toBe(false);
  });

  it("meets a caller-supplied minimum coverage ratio when content is high enough", () => {
    const rgba = blankPixels(10, 10);
    for (let index = 0; index < 40; index += 1) rgba[index] = 255; // 10/100 pixels
    const dataUrl = `data:image/png;base64,${encodePng(rgba, 10, 10)}`;
    const result = validatePngCapture(canvas(dataUrl, 10, 10), "out.png", {
      rgba,
      widthPx: 10,
      heightPx: 10,
      background: BACKGROUND,
      minimumNonBackgroundRatio: 0.05,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects mismatched pixel buffer byte length rather than guessing", () => {
    // Isolates analyzePixelContent's own length check: dimension binding in
    // validatePngCapture would otherwise catch the width/height mismatch first
    // and report the wrong reason.
    expect(() => analyzePixelContent(new Uint8Array(16), 100, 100, BACKGROUND)).toThrow(
      /RGBA bytes/u,
    );
  });

  it("rejects non-finite or out-of-range content parameters", () => {
    const rgba = blankPixels(2, 2);
    expect(() =>
      analyzePixelContent(rgba, 2, 2, { r: Number.NaN, g: 0, b: 0 }),
    ).toThrow(/finite/u);
    expect(() => analyzePixelContent(rgba, 2, 2, { r: 300, g: 0, b: 0 })).toThrow(/finite/u);
    expect(() => analyzePixelContent(rgba, 2, 2, BACKGROUND, -1)).toThrow(/tolerance/u);

    const dataUrl = `data:image/png;base64,${encodePng(rgba, 2, 2)}`;
    const badRatio = validatePngCapture(canvas(dataUrl, 2, 2), "out.png", {
      rgba,
      widthPx: 2,
      heightPx: 2,
      background: BACKGROUND,
      minimumNonBackgroundRatio: 1.5,
    });
    expect(badRatio.ok).toBe(false);
    if (badRatio.ok) throw new Error("unreachable");
    expect(badRatio.errorMessage).toContain("ratio");
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
  const pixels = (seed: number): Uint8Array =>
    Uint8Array.from({ length: 64 }, (_value, index) => (index * 31 + seed) % 251);
  const base = {
    projectName: "Riverside Welding",
    view: "front",
    mode: "assembled",
    widthPx: 800,
    heightPx: 600,
    pngBytes: pixels(1),
  } as const;

  it("is identical for identical bytes at identical dimensions", () => {
    expect(buildCaptureFilename(base)).toBe(buildCaptureFilename(base));
    // A separate array with the same contents must still hash the same: the
    // token binds to the bytes, not to object identity.
    expect(buildCaptureFilename({ ...base, pngBytes: pixels(1) })).toBe(
      buildCaptureFilename(base),
    );
    expect(buildCaptureFilename(base)).toMatch(
      /^laserx-preview-riverside-welding-front-assembled-800x600-[0-9a-f]{8}.png$/u,
    );
  });

  it("changes when the captured bytes change, even at the same view, mode, and size", () => {
    // This is the case a project/view/mode-only name could not distinguish:
    // manual orbit, pan, zoom, or a layer-visibility change alters the pixels
    // while every textual input stays identical.
    expect(buildCaptureFilename({ ...base, pngBytes: pixels(2) })).not.toBe(
      buildCaptureFilename(base),
    );
  });

  it("changes when the pixel dimensions change", () => {
    expect(buildCaptureFilename({ ...base, widthPx: 801 })).not.toBe(
      buildCaptureFilename(base),
    );
    expect(buildCaptureFilename({ ...base, heightPx: 601 })).not.toBe(
      buildCaptureFilename(base),
    );
  });

  it("varies with view and mode", () => {
    expect(buildCaptureFilename({ ...base, view: "edge" })).not.toBe(
      buildCaptureFilename(base),
    );
    expect(buildCaptureFilename({ ...base, mode: "exploded" })).not.toBe(
      buildCaptureFilename(base),
    );
  });

  it("produces a safe name for hostile project names", () => {
    expect(
      buildCaptureFilename({ ...base, projectName: "../../etc/passwd" }),
    ).toMatch(/^laserx-preview-etc-passwd-front-assembled-800x600-[0-9a-f]{8}.png$/u);
    expect(buildCaptureFilename({ ...base, projectName: "   " })).toMatch(
      /^laserx-preview-project-front-assembled-800x600-[0-9a-f]{8}.png$/u,
    );
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
