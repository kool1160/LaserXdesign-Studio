import { createHash } from "node:crypto";

import { create, type Font, type PathCommand } from "fontkit";

export type FontCategory =
  | "stencil"
  | "script"
  | "serif"
  | "slab"
  | "western"
  | "industrial"
  | "display";

export interface FontLicenseRecord {
  spdx: "OFL-1.1" | "Apache-2.0" | "MIT" | "SYSTEM";
  copyright: string;
  licenseFile: string | null;
  provenance: string;
}

export interface FontCatalogEntry {
  id: string;
  family: string;
  style: string;
  source: "bundled" | "system";
  categories: FontCategory[];
  fingerprint: string;
  license: FontLicenseRecord;
}

export interface FontSource {
  entry: FontCatalogEntry;
  load(): Buffer;
}

export function createFontSource(
  entry: Omit<FontCatalogEntry, "fingerprint">,
  bytes: Uint8Array,
): FontSource {
  const buffer = Buffer.from(bytes);
  return {
    entry: {
      ...entry,
      categories: [...entry.categories],
      license: { ...entry.license },
      fingerprint: createHash("sha256").update(buffer).digest("hex"),
    },
    load: () => Buffer.from(buffer),
  };
}

export interface TextArcLayout {
  radiusMm: number;
  startAngleDeg: number;
  clockwise: boolean;
}

export interface TextLayoutRequest {
  fontId: string;
  content: string;
  sizeMm: number;
  trackingMm: number;
  wordSpacingMm: number;
  lineSpacing: number;
  alignment: "left" | "center" | "right";
  arc: TextArcLayout | null;
}

export interface OutlineContour {
  closed: boolean;
  points: Array<{ xMm: number; yMm: number }>;
}

export interface MaterializedTextLayout {
  font: FontCatalogEntry;
  contours: OutlineContour[];
  bounds: {
    minXmm: number;
    minYmm: number;
    maxXmm: number;
    maxYmm: number;
  };
  missingCodePoints: number[];
}

const CURVE_STEPS = 10;

function pointOnQuadratic(
  start: readonly [number, number],
  control: readonly [number, number],
  end: readonly [number, number],
  t: number,
): [number, number] {
  const inverse = 1 - t;
  return [
    inverse * inverse * start[0] +
      2 * inverse * t * control[0] +
      t * t * end[0],
    inverse * inverse * start[1] +
      2 * inverse * t * control[1] +
      t * t * end[1],
  ];
}

function pointOnCubic(
  start: readonly [number, number],
  first: readonly [number, number],
  second: readonly [number, number],
  end: readonly [number, number],
  t: number,
): [number, number] {
  const inverse = 1 - t;
  return [
    inverse ** 3 * start[0] +
      3 * inverse * inverse * t * first[0] +
      3 * inverse * t * t * second[0] +
      t ** 3 * end[0],
    inverse ** 3 * start[1] +
      3 * inverse * inverse * t * first[1] +
      3 * inverse * t * t * second[1] +
      t ** 3 * end[1],
  ];
}

function flattenCommands(
  commands: readonly PathCommand[],
  scale: number,
  offsetX: number,
  offsetY: number,
): OutlineContour[] {
  const contours: OutlineContour[] = [];
  let points: Array<[number, number]> = [];
  let current: [number, number] = [0, 0];
  const emit = (closed: boolean) => {
    if (points.length >= 2) {
      contours.push({
        closed,
        points: points.map(([x, y]) => ({
          xMm: offsetX + x * scale,
          yMm: offsetY + y * scale,
        })),
      });
    }
    points = [];
  };
  for (const command of commands) {
    const args = command.args;
    switch (command.command) {
      case "moveTo":
        emit(false);
        current = [args[0] ?? 0, args[1] ?? 0];
        points.push(current);
        break;
      case "lineTo":
        current = [args[0] ?? 0, args[1] ?? 0];
        points.push(current);
        break;
      case "quadraticCurveTo": {
        const control: [number, number] = [args[0] ?? 0, args[1] ?? 0];
        const end: [number, number] = [args[2] ?? 0, args[3] ?? 0];
        const start = current;
        for (let step = 1; step <= CURVE_STEPS; step += 1) {
          points.push(
            pointOnQuadratic(start, control, end, step / CURVE_STEPS),
          );
        }
        current = end;
        break;
      }
      case "bezierCurveTo": {
        const first: [number, number] = [args[0] ?? 0, args[1] ?? 0];
        const second: [number, number] = [args[2] ?? 0, args[3] ?? 0];
        const end: [number, number] = [args[4] ?? 0, args[5] ?? 0];
        const start = current;
        for (let step = 1; step <= CURVE_STEPS; step += 1) {
          points.push(
            pointOnCubic(start, first, second, end, step / CURVE_STEPS),
          );
        }
        current = end;
        break;
      }
      case "closePath":
        emit(true);
        break;
    }
  }
  emit(false);
  return contours;
}

function warpArc(
  contour: OutlineContour,
  arc: TextArcLayout,
): OutlineContour {
  const direction = arc.clockwise ? -1 : 1;
  const start = (arc.startAngleDeg * Math.PI) / 180;
  return {
    closed: contour.closed,
    points: contour.points.map((point) => {
      const angle = start + direction * (point.xMm / arc.radiusMm);
      const radial = arc.radiusMm + point.yMm;
      return {
        xMm: Math.sin(angle) * radial,
        yMm: Math.cos(angle) * radial - arc.radiusMm,
      };
    }),
  };
}

function boundsOf(contours: readonly OutlineContour[]) {
  const points = contours.flatMap((contour) => contour.points);
  if (points.length === 0) {
    return { minXmm: 0, minYmm: 0, maxXmm: 0, maxYmm: 0 };
  }
  return {
    minXmm: Math.min(...points.map((point) => point.xMm)),
    minYmm: Math.min(...points.map((point) => point.yMm)),
    maxXmm: Math.max(...points.map((point) => point.xMm)),
    maxYmm: Math.max(...points.map((point) => point.yMm)),
  };
}

export class FontEngine {
  readonly #sources: Map<string, FontSource>;
  readonly #fonts = new Map<string, Font>();

  public constructor(sources: readonly FontSource[]) {
    this.#sources = new Map(sources.map((source) => [source.entry.id, source]));
  }

  public catalog(): FontCatalogEntry[] {
    return [...this.#sources.values()]
      .map((source) => ({
        ...source.entry,
        categories: [...source.entry.categories],
        license: { ...source.entry.license },
      }))
      .sort((left, right) =>
        `${left.family} ${left.style}`.localeCompare(
          `${right.family} ${right.style}`,
        ),
      );
  }

  public layout(request: TextLayoutRequest): MaterializedTextLayout {
    if (
      request.content.length === 0 ||
      !Number.isFinite(request.sizeMm) ||
      request.sizeMm <= 0 ||
      !Number.isFinite(request.trackingMm) ||
      !Number.isFinite(request.wordSpacingMm) ||
      !Number.isFinite(request.lineSpacing) ||
      request.lineSpacing <= 0 ||
      (request.arc !== null &&
        (!Number.isFinite(request.arc.radiusMm) ||
          request.arc.radiusMm <= 0 ||
          !Number.isFinite(request.arc.startAngleDeg)))
    ) {
      throw new RangeError("Text layout settings are invalid.");
    }
    const source = this.#sources.get(request.fontId);
    if (source === undefined) {
      throw new RangeError(`Font ${request.fontId} is unavailable.`);
    }
    let font = this.#fonts.get(request.fontId);
    if (font === undefined) {
      const opened = create(source.load());
      if (!("layout" in opened)) {
        throw new RangeError("Font collections are not supported.");
      }
      font = opened;
      this.#fonts.set(request.fontId, font);
    }
    const scale = request.sizeMm / font.unitsPerEm;
    const contours: OutlineContour[] = [];
    const missing = new Set<number>();
    const lines = request.content.split("\n");
    lines.forEach((line, lineIndex) => {
      for (const character of line) {
        const codePoint = character.codePointAt(0);
        if (
          codePoint !== undefined &&
          !font.hasGlyphForCodePoint(codePoint)
        ) {
          missing.add(codePoint);
        }
      }
      const run = font.layout(line);
      const extraAdvance =
        Math.max(0, run.glyphs.length - 1) * request.trackingMm +
        (line.match(/ /gu)?.length ?? 0) *
          request.wordSpacingMm;
      const widthMm = run.advanceWidth * scale + extraAdvance;
      let penX =
        request.alignment === "center"
          ? -widthMm / 2
          : request.alignment === "right"
            ? -widthMm
            : 0;
      const baselineY = -lineIndex * request.sizeMm * request.lineSpacing;
      run.glyphs.forEach((glyph, glyphIndex) => {
        const position = run.positions[glyphIndex];
        contours.push(
          ...flattenCommands(
            glyph.path.commands,
            scale,
            penX + (position?.xOffset ?? 0) * scale,
            baselineY + (position?.yOffset ?? 0) * scale,
          ),
        );
        const isSpace = glyph.codePoints.includes(32);
        penX +=
          (position?.xAdvance ?? glyph.advanceWidth) * scale +
          (glyphIndex < run.glyphs.length - 1 ? request.trackingMm : 0) +
          (isSpace ? request.wordSpacingMm : 0);
      });
    });
    const arc = request.arc;
    const materialized =
      arc === null
        ? contours
        : contours.map((contour) => warpArc(contour, arc));
    return {
      font: {
        ...source.entry,
        categories: [...source.entry.categories],
        license: { ...source.entry.license },
      },
      contours: materialized,
      bounds: boundsOf(materialized),
      missingCodePoints: [...missing].sort((left, right) => left - right),
    };
  }
}

export { discoverWindowsFontSources } from "./system-fonts.js";
export { bundledFontSources } from "./bundled-fonts.js";
