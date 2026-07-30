import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { LaserxDocument, PointMm } from "@laserx/domain";
import {
  panViewport,
  screenToDomain,
  type ScreenPointCssPx,
  type ViewportSizeCssPx,
  type ViewportTransform,
} from "@laserx/geometry";

import {
  createViewportScene,
  fitDocumentToView,
  formatCoordinate,
  resetDocumentView,
  zoomAtViewportCenter,
  zoomFromWheel,
  type ObjectPrimitive,
} from "../lib/viewport-adapter.js";

const RULER_SIZE_CSS_PX = 24;

interface ViewportProps {
  document: LaserxDocument;
}

function renderObject(object: ObjectPrimitive) {
  switch (object.type) {
    case "line":
      return (
        <line
          key={object.id}
          data-object-id={object.id}
          x1={object.start.xCssPx}
          y1={object.start.yCssPx}
          x2={object.end.xCssPx}
          y2={object.end.yCssPx}
        />
      );
    case "rectangle":
      return (
        <rect
          key={object.id}
          data-object-id={object.id}
          x={object.xCssPx}
          y={object.yCssPx}
          width={object.widthCssPx}
          height={object.heightCssPx}
        />
      );
    case "ellipse":
      return (
        <ellipse
          key={object.id}
          data-object-id={object.id}
          cx={object.center.xCssPx}
          cy={object.center.yCssPx}
          rx={object.radiusXCssPx}
          ry={object.radiusYCssPx}
        />
      );
    case "path": {
      const points = object.points
        .map(
          (point) =>
            `${String(point.xCssPx)},${String(point.yCssPx)}`,
        )
        .join(" ");
      return object.closed ? (
        <polygon key={object.id} data-object-id={object.id} points={points} />
      ) : (
        <polyline key={object.id} data-object-id={object.id} points={points} />
      );
    }
  }
}

export function Viewport({ document }: ViewportProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const dragPointRef = useRef<ScreenPointCssPx | null>(null);
  const [size, setSize] = useState<ViewportSizeCssPx>({
    widthCssPx: 1,
    heightCssPx: 1,
    devicePixelRatio: window.devicePixelRatio,
  });
  const [viewport, setViewport] = useState<ViewportTransform>({
    originScreenXCssPx: 0,
    originScreenYCssPx: 0,
    zoomCssPxPerMm: 1,
  });
  const [cursor, setCursor] = useState<PointMm | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) {
      return;
    }
    const updateSize = () => {
      const bounds = host.getBoundingClientRect();
      setSize({
        widthCssPx: Math.max(1, bounds.width),
        heightCssPx: Math.max(1, bounds.height),
        devicePixelRatio: window.devicePixelRatio,
      });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (size.widthCssPx > 1 && size.heightCssPx > 1) {
      setViewport(fitDocumentToView(document, size));
    }
  }, [
    document.id,
    document.dimensions.widthMm,
    document.dimensions.heightMm,
    document.objects.length,
    size.heightCssPx,
    size.widthCssPx,
  ]);

  const scene = useMemo(
    () => createViewportScene(document, viewport, size),
    [document, size, viewport],
  );

  const pointFromEvent = useCallback(
    (clientX: number, clientY: number): ScreenPointCssPx => {
      const bounds = hostRef.current?.getBoundingClientRect();
      return {
        xCssPx: clientX - (bounds?.left ?? 0),
        yCssPx: clientY - (bounds?.top ?? 0),
      };
    },
    [],
  );

  const zoomAtCenter = useCallback(
    (factor: number) => {
      setViewport((current) =>
        zoomAtViewportCenter(current, size, factor),
      );
    },
    [size],
  );

  return (
    <section className="viewport-panel" aria-label="2D workspace">
      <div className="viewport-toolbar" aria-label="Viewport commands">
        <button
          type="button"
          data-testid="zoom-out"
          onClick={() => zoomAtCenter(0.8)}
        >
          −
        </button>
        <span data-testid="zoom-readout">
          {Math.round(viewport.zoomCssPxPerMm * 100)}%
        </span>
        <button
          type="button"
          data-testid="zoom-in"
          onClick={() => zoomAtCenter(1.25)}
        >
          +
        </button>
        <button
          type="button"
          data-testid="fit-view"
          onClick={() => setViewport(fitDocumentToView(document, size))}
        >
          Fit
        </button>
        <button
          type="button"
          data-testid="reset-view"
          onClick={() => setViewport(resetDocumentView(document, size))}
        >
          Reset
        </button>
      </div>

      <div
        ref={hostRef}
        className={`viewport-host${dragging ? " dragging" : ""}`}
        data-testid="viewport"
        onPointerDown={(event) => {
          const point = pointFromEvent(event.clientX, event.clientY);
          dragPointRef.current = point;
          setDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const point = pointFromEvent(event.clientX, event.clientY);
          setCursor(screenToDomain(point, viewport));
          const previous = dragPointRef.current;
          if (previous !== null) {
            setViewport((current) =>
              panViewport(current, {
                xCssPx: point.xCssPx - previous.xCssPx,
                yCssPx: point.yCssPx - previous.yCssPx,
              }),
            );
            dragPointRef.current = point;
          }
        }}
        onPointerUp={(event) => {
          dragPointRef.current = null;
          setDragging(false);
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          dragPointRef.current = null;
          setDragging(false);
        }}
        onPointerLeave={() => {
          if (dragPointRef.current === null) {
            setCursor(null);
          }
        }}
        onWheel={(event) => {
          event.preventDefault();
          const pointer = pointFromEvent(event.clientX, event.clientY);
          setViewport((current) =>
            zoomFromWheel(current, pointer, event.deltaY),
          );
        }}
      >
        <svg
          className="viewport-svg"
          width={size.widthCssPx}
          height={size.heightCssPx}
          viewBox={`0 0 ${String(size.widthCssPx)} ${String(size.heightCssPx)}`}
          role="img"
          aria-label="Cartesian sign workspace"
        >
          <g className="grid-lines" data-testid="viewport-grid">
            {scene.gridLines.map((line) =>
              line.axis === "x" ? (
                <line
                  key={`x-${String(line.valueMm)}`}
                  x1={line.screenPositionCssPx}
                  y1={0}
                  x2={line.screenPositionCssPx}
                  y2={size.heightCssPx}
                />
              ) : (
                <line
                  key={`y-${String(line.valueMm)}`}
                  x1={0}
                  y1={line.screenPositionCssPx}
                  x2={size.widthCssPx}
                  y2={line.screenPositionCssPx}
                />
              ),
            )}
          </g>
          <rect
            className="stock-region"
            data-testid="stock-region"
            x={scene.stock.xCssPx}
            y={scene.stock.yCssPx}
            width={scene.stock.widthCssPx}
            height={scene.stock.heightCssPx}
          />
          <g className="placeholder-objects">
            {scene.objects.map(renderObject)}
          </g>
          {document.settings.viewport.rulersVisible && (
            <g className="rulers" data-testid="viewport-rulers">
              <rect
                className="ruler-background"
                x={0}
                y={0}
                width={size.widthCssPx}
                height={RULER_SIZE_CSS_PX}
              />
              <rect
                className="ruler-background"
                x={0}
                y={0}
                width={RULER_SIZE_CSS_PX}
                height={size.heightCssPx}
              />
              {scene.horizontalTicks.map((tick) => (
                <g key={`rx-${String(tick.valueMm)}`}>
                  <line
                    x1={tick.screenPositionCssPx}
                    y1={tick.major ? 10 : 17}
                    x2={tick.screenPositionCssPx}
                    y2={RULER_SIZE_CSS_PX}
                  />
                  {tick.major && (
                    <text x={tick.screenPositionCssPx + 3} y={9}>
                      {tick.label}
                    </text>
                  )}
                </g>
              ))}
              {scene.verticalTicks.map((tick) => (
                <g key={`ry-${String(tick.valueMm)}`}>
                  <line
                    x1={tick.major ? 10 : 17}
                    y1={tick.screenPositionCssPx}
                    x2={RULER_SIZE_CSS_PX}
                    y2={tick.screenPositionCssPx}
                  />
                  {tick.major && (
                    <text
                      x={3}
                      y={tick.screenPositionCssPx - 3}
                      transform={`rotate(-90 3 ${String(tick.screenPositionCssPx - 3)})`}
                    >
                      {tick.label}
                    </text>
                  )}
                </g>
              ))}
              <rect
                className="ruler-corner"
                x={0}
                y={0}
                width={RULER_SIZE_CSS_PX}
                height={RULER_SIZE_CSS_PX}
              />
            </g>
          )}
        </svg>

        <div className="coordinate-readout" data-testid="cursor-coordinate">
          {cursor === null
            ? `X —  Y — ${document.settings.displayUnit === "inches" ? "in" : "mm"}`
            : formatCoordinate(cursor, document.settings.displayUnit)}
        </div>
        <div className="dpi-readout" data-testid="dpi-readout">
          DPR {size.devicePixelRatio.toFixed(2)}
        </div>
      </div>
    </section>
  );
}
