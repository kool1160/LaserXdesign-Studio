import {
  flattenDocumentForInterchange,
  type InterchangePath,
  type InterchangeWarning,
  type LaserxDocument,
  type VectorExportArtifact,
  type VectorImportCandidate,
  type VectorSourceUnit,
} from "@laserx/domain";
import {
  IDENTITY_AFFINE_TRANSFORM,
  applyAffineTransform,
  composeAffineTransforms,
  type AffineTransformMm,
  type PathControlHandles,
  type PointMm,
} from "@laserx/geometry";
import { SaxesParser } from "saxes";

const MAX_SVG_BYTES = 5_000_000;
const MAX_SVG_ELEMENTS = 50_000;
const MAX_SVG_POINTS = 200_000;
const SVG_PX_PER_INCH = 96;
const MM_PER_INCH = 25.4;
const SUPPORTED_ELEMENTS = new Set([
  "svg",
  "g",
  "line",
  "rect",
  "polyline",
  "polygon",
  "circle",
  "ellipse",
  "path",
]);
const QUIETLY_SKIPPED_ELEMENTS = new Set([
  "title",
  "desc",
  "metadata",
  "defs",
  "style",
  "lineargradient",
  "radialgradient",
  "stop",
  "clippath",
  "mask",
]);

interface SvgFrame {
  transform: AffineTransformMm;
  layerName: string | null;
  skipped: boolean;
}

interface RootGeometry {
  transform: AffineTransformMm;
  widthMm: number;
  heightMm: number;
  sourceUnit: VectorSourceUnit;
  assumptions: string[];
}

interface ParsedLength {
  px: number;
  mm: number;
  sourceUnit: VectorSourceUnit;
}

function warning(code: string, message: string, source: string | null): InterchangeWarning {
  return { code, message, source };
}

function parsePositiveLength(raw: string, name: string): ParsedLength {
  const match = /^\s*([+]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*(mm|cm|in|px)?\s*$/iu.exec(raw);
  if (match === null) {
    throw new RangeError(`${name} must be an absolute mm, cm, in, px, or unitless length.`);
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be positive and finite.`);
  }
  const unit = match[2]?.toLowerCase();
  switch (unit) {
    case "mm":
      return { px: (value * SVG_PX_PER_INCH) / MM_PER_INCH, mm: value, sourceUnit: "millimeters" };
    case "cm":
      return { px: (value * 10 * SVG_PX_PER_INCH) / MM_PER_INCH, mm: value * 10, sourceUnit: "centimeters" };
    case "in":
      return { px: value * SVG_PX_PER_INCH, mm: value * MM_PER_INCH, sourceUnit: "inches" };
    case "px":
    case undefined:
      return { px: value, mm: (value * MM_PER_INCH) / SVG_PX_PER_INCH, sourceUnit: "pixels" };
    default:
      throw new RangeError(`${name} uses an unsupported unit.`);
  }
}

function numbers(raw: string, name: string): number[] {
  const pieces = raw.trim().split(/[\s,]+/u).filter(Boolean);
  const values = pieces.map(Number);
  if (values.some((value) => !Number.isFinite(value))) {
    throw new RangeError(`${name} contains a non-finite number.`);
  }
  return values;
}

function parseViewBox(raw: string): [number, number, number, number] {
  const values = numbers(raw, "SVG viewBox");
  if (values.length !== 4) {
    throw new RangeError("SVG viewBox must contain exactly four numbers.");
  }
  const [minX, minY, width, height] = values as [number, number, number, number];
  if (width <= 0 || height <= 0) {
    throw new RangeError("SVG viewBox width and height must be positive.");
  }
  return [minX, minY, width, height];
}

function alignOffset(align: string, remaining: number, axis: "x" | "y"): number {
  const marker = axis === "x" ? align.slice(0, 4) : align.slice(4);
  if (marker.endsWith("Mid")) {
    return remaining / 2;
  }
  if (marker.endsWith("Max")) {
    return remaining;
  }
  return 0;
}

function rootGeometry(attributes: Record<string, string>): RootGeometry {
  const viewBox = attributes.viewbox === undefined ? null : parseViewBox(attributes.viewbox);
  let width = attributes.width === undefined ? null : parsePositiveLength(attributes.width, "SVG width");
  let height = attributes.height === undefined ? null : parsePositiveLength(attributes.height, "SVG height");
  const assumptions: string[] = [];
  if (width === null && height === null && viewBox !== null) {
    width = parsePositiveLength(`${String(viewBox[2])}px`, "SVG inferred width");
    height = parsePositiveLength(`${String(viewBox[3])}px`, "SVG inferred height");
    assumptions.push("viewBox-only SVG interpreted at the CSS reference ratio of 96 px per inch.");
  } else if (viewBox !== null && width !== null && height === null) {
    height = parsePositiveLength(`${String((width.px * viewBox[3]) / viewBox[2])}px`, "SVG inferred height");
    assumptions.push("Missing SVG height inferred from the viewBox aspect ratio.");
  } else if (viewBox !== null && width === null && height !== null) {
    width = parsePositiveLength(`${String((height.px * viewBox[2]) / viewBox[3])}px`, "SVG inferred width");
    assumptions.push("Missing SVG width inferred from the viewBox aspect ratio.");
  }
  if (width === null || height === null) {
    throw new RangeError("SVG requires width and height or a valid viewBox from which they can be inferred.");
  }
  const sourceUnit = width.sourceUnit === height.sourceUnit ? width.sourceUnit : "pixels";
  const effectiveViewBox = viewBox ?? [0, 0, width.px, height.px] as [number, number, number, number];
  const [minX, minY, viewWidth, viewHeight] = effectiveViewBox;
  const preserve = (attributes.preserveaspectratio ?? "xMidYMid meet").trim().split(/\s+/u);
  const align = preserve[0] ?? "xMidYMid";
  const meetOrSlice = preserve[1] ?? "meet";
  let scaleX = width.mm / viewWidth;
  let scaleY = height.mm / viewHeight;
  let offsetX = 0;
  let offsetY = 0;
  if (align !== "none") {
    const uniform = meetOrSlice === "slice"
      ? Math.max(scaleX, scaleY)
      : Math.min(scaleX, scaleY);
    scaleX = uniform;
    scaleY = uniform;
    offsetX = alignOffset(align, width.mm - viewWidth * uniform, "x");
    offsetY = alignOffset(align, height.mm - viewHeight * uniform, "y");
  }
  return {
    widthMm: width.mm,
    heightMm: height.mm,
    sourceUnit,
    assumptions,
    transform: {
      a: scaleX,
      b: 0,
      c: 0,
      d: -scaleY,
      eMm: offsetX - minX * scaleX,
      fMm: height.mm - offsetY + minY * scaleY,
    },
  };
}

function parseCoordinate(raw: string | undefined, fallback = 0): number {
  if (raw === undefined) {
    return fallback;
  }
  const match = /^\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*(px)?\s*$/iu.exec(raw);
  const value = Number(match?.[1]);
  if (match === null || !Number.isFinite(value)) {
    throw new RangeError(`Unsupported SVG coordinate '${raw}'. Shape coordinates must be unitless or px.`);
  }
  return value;
}

function parseTransform(raw: string | undefined): AffineTransformMm {
  if (raw === undefined || raw.trim() === "") {
    return { ...IDENTITY_AFFINE_TRANSFORM };
  }
  const pattern = /([a-z]+)\s*\(([^)]*)\)/giu;
  let result: AffineTransformMm = { ...IDENTITY_AFFINE_TRANSFORM };
  let consumed = "";
  for (const match of raw.matchAll(pattern)) {
    consumed += match[0];
    const name = (match[1] ?? "").toLowerCase();
    const values = numbers(match[2] ?? "", `SVG ${name} transform`);
    let next: AffineTransformMm;
    switch (name) {
      case "matrix":
        if (values.length !== 6) throw new RangeError("SVG matrix() requires six numbers.");
        next = { a: values[0] as number, b: values[1] as number, c: values[2] as number, d: values[3] as number, eMm: values[4] as number, fMm: values[5] as number };
        break;
      case "translate":
        if (values.length < 1 || values.length > 2) throw new RangeError("SVG translate() requires one or two numbers.");
        next = { ...IDENTITY_AFFINE_TRANSFORM, eMm: values[0] as number, fMm: values[1] ?? 0 };
        break;
      case "scale":
        if (values.length < 1 || values.length > 2) throw new RangeError("SVG scale() requires one or two numbers.");
        next = { a: values[0] as number, b: 0, c: 0, d: values[1] ?? (values[0] as number), eMm: 0, fMm: 0 };
        break;
      case "rotate": {
        if (values.length !== 1 && values.length !== 3) throw new RangeError("SVG rotate() requires one number or an angle and center.");
        const radians = ((values[0] as number) * Math.PI) / 180;
        const cosine = Math.cos(radians);
        const sine = Math.sin(radians);
        const cx = values[1] ?? 0;
        const cy = values[2] ?? 0;
        next = { a: cosine, b: sine, c: -sine, d: cosine, eMm: cx - cosine * cx + sine * cy, fMm: cy - sine * cx - cosine * cy };
        break;
      }
      case "skewx":
      case "skewy": {
        if (values.length !== 1) throw new RangeError(`SVG ${name}() requires one number.`);
        const tangent = Math.tan(((values[0] as number) * Math.PI) / 180);
        next = name === "skewx"
          ? { ...IDENTITY_AFFINE_TRANSFORM, c: tangent }
          : { ...IDENTITY_AFFINE_TRANSFORM, b: tangent };
        break;
      }
      default:
        throw new RangeError(`Unsupported SVG transform '${name}'.`);
    }
    result = composeAffineTransforms(result, next);
  }
  if (consumed.replaceAll(/\s|,/gu, "") !== raw.replaceAll(/\s|,/gu, "")) {
    throw new RangeError(`Malformed SVG transform '${raw}'.`);
  }
  return result;
}

function transformedPath(path: InterchangePath, transform: AffineTransformMm): InterchangePath {
  return {
    ...path,
    points: path.points.map((point) => applyAffineTransform(point, transform)),
    ...(path.handles === undefined
      ? {}
      : {
          handles: path.handles.map((handle) => ({
            incoming: handle.incoming === null ? null : applyAffineTransform(handle.incoming, transform),
            outgoing: handle.outgoing === null ? null : applyAffineTransform(handle.outgoing, transform),
          })),
        }),
  };
}

function basicPath(points: PointMm[], closed: boolean, layerName: string | null): InterchangePath {
  if (points.length < (closed ? 3 : 2)) {
    throw new RangeError(`SVG ${closed ? "closed" : "open"} shape does not contain enough points.`);
  }
  return { layerName, closed, points };
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number, layerName: string | null): InterchangePath {
  if (rx <= 0 || ry <= 0) {
    throw new RangeError("SVG ellipse radii must be positive.");
  }
  const kappa = 0.5522847498307936;
  const points = [
    { xMm: cx + rx, yMm: cy },
    { xMm: cx, yMm: cy + ry },
    { xMm: cx - rx, yMm: cy },
    { xMm: cx, yMm: cy - ry },
  ];
  const handles: PathControlHandles[] = [
    { incoming: { xMm: cx + rx, yMm: cy - kappa * ry }, outgoing: { xMm: cx + rx, yMm: cy + kappa * ry } },
    { incoming: { xMm: cx + kappa * rx, yMm: cy + ry }, outgoing: { xMm: cx - kappa * rx, yMm: cy + ry } },
    { incoming: { xMm: cx - rx, yMm: cy + kappa * ry }, outgoing: { xMm: cx - rx, yMm: cy - kappa * ry } },
    { incoming: { xMm: cx - kappa * rx, yMm: cy - ry }, outgoing: { xMm: cx + kappa * rx, yMm: cy - ry } },
  ];
  return { layerName, closed: true, points, handles };
}

interface PathToken {
  kind: "command" | "number";
  value: string;
}

function tokenizePath(raw: string): PathToken[] {
  const tokenPattern = /([a-zA-Z])|([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/gu;
  const tokens: PathToken[] = [];
  let lastIndex = 0;
  for (const match of raw.matchAll(tokenPattern)) {
    const index = match.index;
    if (raw.slice(lastIndex, index).replaceAll(/[\s,]/gu, "") !== "") {
      throw new RangeError("SVG path data contains an invalid token.");
    }
    tokens.push(match[1] === undefined ? { kind: "number", value: match[2] as string } : { kind: "command", value: match[1] });
    lastIndex = index + match[0].length;
  }
  if (raw.slice(lastIndex).replaceAll(/[\s,]/gu, "") !== "") {
    throw new RangeError("SVG path data contains an invalid trailing token.");
  }
  return tokens;
}

function parsePathData(raw: string, layerName: string | null): InterchangePath[] {
  const tokens = tokenizePath(raw);
  const paths: InterchangePath[] = [];
  let index = 0;
  let command = "";
  let current = { xMm: 0, yMm: 0 };
  let subpath: PointMm[] = [];
  let handles: PathControlHandles[] = [];
  let closed = false;
  let previousCommand = "";
  let previousQuadratic: PointMm | null = null;

  const finish = (): void => {
    if (subpath.length >= (closed ? 3 : 2)) {
      const compact = handles.some((handle) => handle.incoming !== null || handle.outgoing !== null);
      paths.push({ layerName, closed, points: subpath, ...(compact ? { handles } : {}) });
    }
    subpath = [];
    handles = [];
    closed = false;
    previousQuadratic = null;
  };
  const read = (): number => {
    const token = tokens[index];
    if (token?.kind !== "number") {
      throw new RangeError(`SVG path command ${command} is missing a coordinate.`);
    }
    index += 1;
    return Number(token.value);
  };
  const point = (relative: boolean): PointMm => {
    const x = read();
    const y = read();
    return relative ? { xMm: current.xMm + x, yMm: current.yMm + y } : { xMm: x, yMm: y };
  };
  const addLine = (next: PointMm): void => {
    subpath.push(next);
    handles.push({ incoming: null, outgoing: null });
    current = next;
    previousQuadratic = null;
  };
  const addCubic = (control1: PointMm, control2: PointMm, end: PointMm): void => {
    const currentHandles = handles[handles.length - 1];
    if (currentHandles === undefined) throw new RangeError("SVG path curve has no current node.");
    currentHandles.outgoing = control1;
    subpath.push(end);
    handles.push({ incoming: control2, outgoing: null });
    current = end;
  };
  while (index < tokens.length) {
    const token = tokens[index];
    if (token?.kind === "command") {
      command = token.value;
      index += 1;
    } else if (command === "") {
      throw new RangeError("SVG path data must begin with a command.");
    }
    const upper = command.toUpperCase();
    const relative = command !== upper;
    if (upper === "A") {
      throw new RangeError("SVG elliptical arc path commands are not supported; use circle/ellipse elements or convert arcs to cubic curves.");
    }
    switch (upper) {
      case "M": {
        const next = point(relative);
        if (subpath.length > 0) finish();
        current = next;
        subpath = [next];
        handles = [{ incoming: null, outgoing: null }];
        command = relative ? "l" : "L";
        break;
      }
      case "L":
        addLine(point(relative));
        break;
      case "H": {
        const value = read();
        addLine({ xMm: relative ? current.xMm + value : value, yMm: current.yMm });
        break;
      }
      case "V": {
        const value = read();
        addLine({ xMm: current.xMm, yMm: relative ? current.yMm + value : value });
        break;
      }
      case "C": {
        const control1 = point(relative);
        const control2 = point(relative);
        const end = point(relative);
        addCubic(control1, control2, end);
        previousQuadratic = null;
        break;
      }
      case "S": {
        const incoming = handles[handles.length - 1]?.incoming;
        const control1 = previousCommand.toUpperCase() === "C" || previousCommand.toUpperCase() === "S"
          ? { xMm: current.xMm * 2 - (incoming?.xMm ?? current.xMm), yMm: current.yMm * 2 - (incoming?.yMm ?? current.yMm) }
          : { ...current };
        const control2 = point(relative);
        const end = point(relative);
        addCubic(control1, control2, end);
        previousQuadratic = null;
        break;
      }
      case "Q": {
        const control = point(relative);
        const end = point(relative);
        addCubic(
          { xMm: current.xMm + (2 / 3) * (control.xMm - current.xMm), yMm: current.yMm + (2 / 3) * (control.yMm - current.yMm) },
          { xMm: end.xMm + (2 / 3) * (control.xMm - end.xMm), yMm: end.yMm + (2 / 3) * (control.yMm - end.yMm) },
          end,
        );
        previousQuadratic = control;
        break;
      }
      case "T": {
        const control: PointMm = previousCommand.toUpperCase() === "Q" || previousCommand.toUpperCase() === "T"
          ? { xMm: current.xMm * 2 - (previousQuadratic?.xMm ?? current.xMm), yMm: current.yMm * 2 - (previousQuadratic?.yMm ?? current.yMm) }
          : { ...current };
        const end = point(relative);
        addCubic(
          { xMm: current.xMm + (2 / 3) * (control.xMm - current.xMm), yMm: current.yMm + (2 / 3) * (control.yMm - current.yMm) },
          { xMm: end.xMm + (2 / 3) * (control.xMm - end.xMm), yMm: end.yMm + (2 / 3) * (control.yMm - end.yMm) },
          end,
        );
        previousQuadratic = control;
        break;
      }
      case "Z":
        closed = true;
        current = subpath[0] ?? current;
        finish();
        command = "";
        break;
      default:
        throw new RangeError(`Unsupported SVG path command '${command}'.`);
    }
    previousCommand = upper;
  }
  if (subpath.length > 0) finish();
  return paths;
}

function lowerAttributes(attributes: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(attributes).map(([name, value]) => [name.toLowerCase(), value]));
}

function layerFromAttributes(attributes: Record<string, string>, inherited: string | null): string | null {
  return attributes["inkscape:label"] ?? attributes["data-layer"] ?? attributes.id ?? inherited;
}

function elementPaths(
  name: string,
  attributes: Record<string, string>,
  layerName: string | null,
): InterchangePath[] {
  switch (name) {
    case "line":
      return [basicPath([
        { xMm: parseCoordinate(attributes.x1), yMm: parseCoordinate(attributes.y1) },
        { xMm: parseCoordinate(attributes.x2), yMm: parseCoordinate(attributes.y2) },
      ], false, layerName)];
    case "rect": {
      if (parseCoordinate(attributes.rx) !== 0 || parseCoordinate(attributes.ry) !== 0) {
        throw new RangeError("Rounded SVG rectangles must be converted to paths before import.");
      }
      const x = parseCoordinate(attributes.x);
      const y = parseCoordinate(attributes.y);
      const width = parseCoordinate(attributes.width);
      const height = parseCoordinate(attributes.height);
      if (width <= 0 || height <= 0) throw new RangeError("SVG rectangle dimensions must be positive.");
      return [basicPath([{ xMm: x, yMm: y }, { xMm: x + width, yMm: y }, { xMm: x + width, yMm: y + height }, { xMm: x, yMm: y + height }], true, layerName)];
    }
    case "polyline":
    case "polygon": {
      const values = numbers(attributes.points ?? "", "SVG points");
      if (values.length % 2 !== 0) throw new RangeError("SVG points must contain coordinate pairs.");
      const points = Array.from({ length: values.length / 2 }, (_unused, index) => ({ xMm: values[index * 2] as number, yMm: values[index * 2 + 1] as number }));
      return [basicPath(points, name === "polygon", layerName)];
    }
    case "circle": {
      const radius = parseCoordinate(attributes.r);
      return [ellipsePath(parseCoordinate(attributes.cx), parseCoordinate(attributes.cy), radius, radius, layerName)];
    }
    case "ellipse":
      return [ellipsePath(parseCoordinate(attributes.cx), parseCoordinate(attributes.cy), parseCoordinate(attributes.rx), parseCoordinate(attributes.ry), layerName)];
    case "path":
      return parsePathData(attributes.d ?? "", layerName);
    default:
      return [];
  }
}

export function importSvg(source: string): VectorImportCandidate {
  if (source.length > MAX_SVG_BYTES) {
    throw new RangeError("SVG input exceeds the 5 MB safety limit.");
  }
  if (/<!DOCTYPE|<!ENTITY/iu.test(source)) {
    throw new RangeError("SVG document type and entity declarations are not allowed.");
  }
  const paths: InterchangePath[] = [];
  const warnings: InterchangeWarning[] = [];
  const frames: SvgFrame[] = [];
  const rootState: { value: RootGeometry | null } = { value: null };
  let elementCount = 0;
  let pointCount = 0;
  const parser = new SaxesParser({ xmlns: false });
  parser.on("doctype", () => {
    throw new RangeError("SVG document type declarations are not allowed.");
  });
  parser.on("opentag", (tag) => {
    elementCount += 1;
    if (elementCount > MAX_SVG_ELEMENTS) {
      throw new RangeError("SVG input contains too many elements.");
    }
    const rawName = tag.name.toLowerCase();
    const name = rawName.includes(":") ? rawName.slice(rawName.lastIndexOf(":") + 1) : rawName;
    const attributes = lowerAttributes(tag.attributes);
    if (Object.keys(attributes).some((attribute) => attribute.startsWith("on"))) {
      throw new RangeError(`SVG event-handler attributes are not allowed on <${name}>.`);
    }
    if (attributes.href !== undefined || attributes["xlink:href"] !== undefined) {
      throw new RangeError(`SVG external/reference content is not allowed on <${name}>.`);
    }
    if (name === "script" || name === "foreignobject" || name === "image") {
      throw new RangeError(`Unsafe SVG <${name}> content is not allowed.`);
    }
    const parent = frames.at(-1);
    if (rootState.value === null) {
      if (name !== "svg") {
        throw new RangeError("SVG root element must be <svg>.");
      }
      rootState.value = rootGeometry(attributes);
    }
    const supported = SUPPORTED_ELEMENTS.has(name);
    const quietlySkipped = QUIETLY_SKIPPED_ELEMENTS.has(name);
    const skipped = parent?.skipped === true || !supported;
    if (!supported && !quietlySkipped && parent?.skipped !== true) {
      warnings.push(warning("unsupported-svg-element", `SVG <${name}> is not supported and was skipped.`, `<${name}>`));
    }
    const parentTransform = parent?.transform ?? rootState.value.transform;
    const transform = composeAffineTransforms(parentTransform, parseTransform(attributes.transform));
    const layerName = name === "g"
      ? layerFromAttributes(attributes, parent?.layerName ?? null)
      : parent?.layerName ?? null;
    frames.push({ transform, layerName, skipped });
    if (skipped || name === "svg" || name === "g") {
      return;
    }
    try {
      const parsed = elementPaths(name, attributes, layerName).map((path) => transformedPath(path, transform));
      pointCount += parsed.reduce((total, path) => total + path.points.length, 0);
      if (pointCount > MAX_SVG_POINTS) {
        throw new RangeError("SVG input contains too many geometry points.");
      }
      paths.push(...parsed);
    } catch (error) {
      if (error instanceof RangeError && error.message.includes("too many geometry")) {
        throw error;
      }
      warnings.push(warning(
        "unsupported-svg-geometry",
        `SVG <${name}> was skipped: ${error instanceof Error ? error.message : String(error)}`,
        `<${name}>`,
      ));
    }
  });
  parser.on("closetag", () => {
    frames.pop();
  });
  parser.write(source).close();
  if (rootState.value === null) {
    throw new RangeError("SVG input is empty.");
  }
  const parsedRoot = rootState.value;
  return {
    format: "svg",
    sourceUnit: parsedRoot.sourceUnit,
    dimensionsMm: { widthMm: parsedRoot.widthMm, heightMm: parsedRoot.heightMm },
    paths,
    warnings,
    assumptions: parsedRoot.assumptions,
  };
}

function formatNumber(value: number): string {
  const normalized = Math.abs(value) < 5e-10 ? 0 : value;
  return normalized.toFixed(6).replace(/\.0+$|(?<=\.[0-9]*?)0+$/u, "");
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function exportSvg(document: LaserxDocument, toleranceMm = 0.01): VectorExportArtifact {
  const flattened = flattenDocumentForInterchange(document, toleranceMm);
  const width = formatNumber(document.dimensions.widthMm);
  const height = formatNumber(document.dimensions.heightMm);
  const grouped = new Map<string, typeof flattened.paths>();
  for (const path of flattened.paths) {
    const existing = grouped.get(path.layerName);
    if (existing === undefined) grouped.set(path.layerName, [path]);
    else existing.push(path);
  }
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">`,
  ];
  for (const [layerName, paths] of grouped) {
    lines.push(`  <g data-layer="${escapeXml(layerName)}">`);
    for (const path of paths) {
      const first = path.points[0] as PointMm;
      const commands = [`M ${formatNumber(first.xMm)} ${formatNumber(document.dimensions.heightMm - first.yMm)}`];
      for (const point of path.points.slice(1)) {
        commands.push(`L ${formatNumber(point.xMm)} ${formatNumber(document.dimensions.heightMm - point.yMm)}`);
      }
      if (path.closed) commands.push("Z");
      lines.push(`    <path d="${commands.join(" ")}" fill="none" stroke="#000000"/>`);
    }
    lines.push("  </g>");
  }
  lines.push("</svg>", "");
  return {
    content: lines.join("\n"),
    summary: {
      format: "svg",
      objectCount: flattened.paths.length,
      warningCount: flattened.warnings.length,
      warnings: flattened.warnings,
      units: "millimeters",
      bounds: flattened.bounds,
    },
  };
}
