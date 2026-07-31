import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { createFontSource, FontEngine } from "../src/index.js";

const bytes = readFileSync(
  new URL(
    "../node_modules/@fontsource-variable/noto-sans/files/noto-sans-latin-wght-normal.woff2",
    import.meta.url,
  ),
);
const source = createFontSource(
  {
    id: "test:noto-sans",
    family: "Noto Sans",
    style: "Regular",
    source: "bundled",
    categories: ["industrial"],
    license: {
      spdx: "OFL-1.1",
      copyright: "Copyright 2022 The Noto Project Authors",
      licenseFile: "licenses/OFL-1.1.txt",
      provenance: "@fontsource-variable/noto-sans@5.3.0",
    },
  },
  bytes,
);

function request(arc: { radiusMm: number; startAngleDeg: number; clockwise: boolean } | null) {
  return {
    fontId: source.entry.id,
    content: "B Laser",
    sizeMm: 24,
    trackingMm: 0.4,
    wordSpacingMm: 1,
    lineSpacing: 1.2,
    alignment: "left" as const,
    arc,
  };
}

describe("FontEngine", () => {
  it("materializes deterministic contours with matching bounds", () => {
    const engine = new FontEngine([source]);
    const first = engine.layout(request(null));
    const second = engine.layout(request(null));
    expect(second).toEqual(first);
    expect(first.contours.length).toBeGreaterThan(7);
    expect(new Set(first.contours.map((contour) => contour.compoundIndex)).size).toBeGreaterThan(1);
    const points = first.contours.flatMap((contour) => contour.points);
    expect(first.bounds).toEqual({
      minXmm: Math.min(...points.map((point) => point.xMm)),
      minYmm: Math.min(...points.map((point) => point.yMm)),
      maxXmm: Math.max(...points.map((point) => point.xMm)),
      maxYmm: Math.max(...points.map((point) => point.yMm)),
    });
  });

  it("keeps enclosed letter contours and supports editable arc layout", () => {
    const engine = new FontEngine([source]);
    const straight = engine.layout(request(null));
    const arced = engine.layout(
      request({ radiusMm: 80, startAngleDeg: -45, clockwise: false }),
    );
    expect(straight.contours.filter((contour) => contour.closed).length).toBeGreaterThanOrEqual(3);
    expect(
      straight.contours.filter((contour) => contour.compoundIndex === 0),
    ).toHaveLength(3);
    expect(arced.contours).not.toEqual(straight.contours);
    expect(arced.font.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns catalog metadata without exposing a path or byte loader", () => {
    const [entry] = new FontEngine([source]).catalog();
    expect(entry).toMatchObject({
      id: "test:noto-sans",
      source: "bundled",
      license: { spdx: "OFL-1.1" },
    });
    expect(entry).not.toHaveProperty("path");
    expect(entry).not.toHaveProperty("load");
  });

  it("reports unsupported Unicode code points", () => {
    const engine = new FontEngine([source]);
    const layout = engine.layout({
      ...request(null),
      content: "LaserX \u{10FFFF}",
    });
    expect(layout.missingCodePoints).toContain(0x10ffff);
  });
});
