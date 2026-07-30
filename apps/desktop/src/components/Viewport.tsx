import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { EditorActionRequest } from "@laserx/application";
import type {
  BoundsMm,
  LaserxDocument,
  PointMm,
} from "@laserx/domain";
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
  marqueeCommand,
  pointerMoveCommand,
  resetDocumentView,
  rotateCommandFromPointer,
  scaleCommandForHandle,
  zoomAtViewportCenter,
  zoomFromWheel,
  type TransformHandleKind,
} from "../lib/viewport-adapter.js";

const RULER_SIZE_CSS_PX = 24;
const DRAG_THRESHOLD_CSS_PX = 3;

interface ViewportProps {
  document: LaserxDocument;
  selectionIds: readonly string[];
  selectionBounds: BoundsMm | null;
  onEditorAction: (request: EditorActionRequest) => void;
}

type Gesture =
  | {
      kind: "pan";
      previous: ScreenPointCssPx;
    }
  | {
      kind: "marquee";
      start: ScreenPointCssPx;
      mode: "replace" | "add" | "toggle";
    }
  | {
      kind: "move";
      start: ScreenPointCssPx;
      objectIds: string[];
    }
  | {
      kind: "handle";
      handle: TransformHandleKind;
      startDomain: PointMm;
      bounds: BoundsMm;
      objectIds: string[];
      lockAspectRatio: boolean;
    };

function pointsAttribute(points: readonly ScreenPointCssPx[]): string {
  return points
    .map((point) => `${String(point.xCssPx)},${String(point.yCssPx)}`)
    .join(" ");
}

function selectionMode(
  event: Pick<React.PointerEvent, "ctrlKey" | "metaKey" | "shiftKey">,
): "replace" | "add" | "toggle" {
  if (event.ctrlKey || event.metaKey) {
    return "toggle";
  }
  return event.shiftKey ? "add" : "replace";
}

function screenDistance(
  first: ScreenPointCssPx,
  second: ScreenPointCssPx,
): number {
  return Math.hypot(
    second.xCssPx - first.xCssPx,
    second.yCssPx - first.yCssPx,
  );
}

export function Viewport({
  document,
  selectionIds,
  selectionBounds,
  onEditorAction,
}: ViewportProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
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
  const [gestureKind, setGestureKind] = useState<Gesture["kind"] | null>(
    null,
  );
  const [marquee, setMarquee] = useState<{
    start: ScreenPointCssPx;
    end: ScreenPointCssPx;
  } | null>(null);

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
    () => createViewportScene(document, viewport, size, selectionIds),
    [document, selectionIds, size, viewport],
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

  const finishGesture = useCallback(
    (point: ScreenPointCssPx) => {
      const gesture = gestureRef.current;
      gestureRef.current = null;
      setGestureKind(null);
      setMarquee(null);
      if (gesture === null || gesture.kind === "pan") {
        return;
      }
      if (gesture.kind === "move") {
        if (
          screenDistance(gesture.start, point) >= DRAG_THRESHOLD_CSS_PX
        ) {
          onEditorAction(
            pointerMoveCommand(
              gesture.objectIds,
              gesture.start,
              point,
              viewport,
            ),
          );
        }
        return;
      }
      if (gesture.kind === "marquee") {
        if (
          screenDistance(gesture.start, point) >= DRAG_THRESHOLD_CSS_PX
        ) {
          onEditorAction(
            marqueeCommand(gesture.start, point, viewport, gesture.mode),
          );
        } else if (gesture.mode === "replace") {
          onEditorAction({ type: "selection.clear" });
        }
        return;
      }
      const pointerDomain = screenToDomain(point, viewport);
      const command =
        gesture.handle === "rotate"
          ? rotateCommandFromPointer(
              gesture.objectIds,
              gesture.bounds,
              gesture.startDomain,
              pointerDomain,
            )
          : scaleCommandForHandle(
              gesture.objectIds,
              gesture.bounds,
              gesture.handle,
              pointerDomain,
              gesture.lockAspectRatio,
            );
      if (command !== null) {
        onEditorAction(command);
      }
    },
    [onEditorAction, viewport],
  );

  const marqueeRect =
    marquee === null
      ? null
      : {
          x: Math.min(marquee.start.xCssPx, marquee.end.xCssPx),
          y: Math.min(marquee.start.yCssPx, marquee.end.yCssPx),
          width: Math.abs(marquee.end.xCssPx - marquee.start.xCssPx),
          height: Math.abs(marquee.end.yCssPx - marquee.start.yCssPx),
        };

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
        <span className="viewport-hint">Drag select · Alt-drag pan</span>
      </div>

      <div
        ref={hostRef}
        className={`viewport-host${gestureKind === "pan" ? " dragging" : ""}`}
        data-testid="viewport"
        onPointerDown={(event) => {
          const point = pointFromEvent(event.clientX, event.clientY);
          const target = event.target as SVGElement;
          const handle = target.dataset.handle as
            | TransformHandleKind
            | undefined;
          const objectId = target.dataset.objectId;
          if (
            handle !== undefined &&
            selectionBounds !== null &&
            selectionIds.length > 0
          ) {
            gestureRef.current = {
              kind: "handle",
              handle,
              startDomain: screenToDomain(point, viewport),
              bounds: { ...selectionBounds },
              objectIds: [...selectionIds],
              lockAspectRatio: event.shiftKey,
            };
          } else if (objectId !== undefined) {
            const mode = selectionMode(event);
            const nextSelectionIds =
              mode === "replace"
                ? [objectId]
                : mode === "add"
                  ? [...new Set([...selectionIds, objectId])]
                  : selectionIds.includes(objectId)
                    ? selectionIds.filter((id) => id !== objectId)
                    : [...selectionIds, objectId];
            onEditorAction({
              type: "selection.point",
              point: screenToDomain(point, viewport),
              toleranceMm: 8 / viewport.zoomCssPxPerMm,
              mode,
            });
            gestureRef.current = {
              kind: "move",
              start: point,
              objectIds: nextSelectionIds.includes(objectId)
                ? nextSelectionIds
                : [],
            };
          } else if (event.button === 1 || event.altKey) {
            gestureRef.current = { kind: "pan", previous: point };
          } else {
            gestureRef.current = {
              kind: "marquee",
              start: point,
              mode: selectionMode(event),
            };
            setMarquee({ start: point, end: point });
          }
          setGestureKind(gestureRef.current.kind);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const point = pointFromEvent(event.clientX, event.clientY);
          setCursor(screenToDomain(point, viewport));
          const gesture = gestureRef.current;
          if (gesture?.kind === "pan") {
            setViewport((current) =>
              panViewport(current, {
                xCssPx: point.xCssPx - gesture.previous.xCssPx,
                yCssPx: point.yCssPx - gesture.previous.yCssPx,
              }),
            );
            gesture.previous = point;
          } else if (gesture?.kind === "marquee") {
            setMarquee({ start: gesture.start, end: point });
          }
        }}
        onPointerUp={(event) => {
          finishGesture(pointFromEvent(event.clientX, event.clientY));
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          gestureRef.current = null;
          setGestureKind(null);
          setMarquee(null);
        }}
        onPointerLeave={() => {
          if (gestureRef.current === null) {
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
          <g className="guides" data-testid="viewport-guides">
            {scene.guides.map((guide) =>
              guide.axis === "x" ? (
                <line
                  key={guide.id}
                  x1={guide.screenPositionCssPx}
                  y1={0}
                  x2={guide.screenPositionCssPx}
                  y2={size.heightCssPx}
                />
              ) : (
                <line
                  key={guide.id}
                  x1={0}
                  y1={guide.screenPositionCssPx}
                  x2={size.widthCssPx}
                  y2={guide.screenPositionCssPx}
                />
              ),
            )}
          </g>
          <g className="placeholder-objects">
            {scene.objects.map((object) =>
              object.closed ? (
                <polygon
                  key={object.key}
                  className={
                    selectionIds.includes(object.objectId)
                      ? "selected-object"
                      : ""
                  }
                  data-object-id={object.objectId}
                  data-source-id={object.sourceId}
                  points={pointsAttribute(object.points)}
                />
              ) : (
                <polyline
                  key={object.key}
                  className={
                    selectionIds.includes(object.objectId)
                      ? "selected-object"
                      : ""
                  }
                  data-object-id={object.objectId}
                  data-source-id={object.sourceId}
                  points={pointsAttribute(object.points)}
                />
              ),
            )}
          </g>
          {scene.selection !== null && (
            <g className="selection-overlay" data-testid="selection-overlay">
              <rect
                className="selection-box"
                x={scene.selection.bounds.xCssPx}
                y={scene.selection.bounds.yCssPx}
                width={scene.selection.bounds.widthCssPx}
                height={scene.selection.bounds.heightCssPx}
              />
              {scene.selection.handles.map((handle) => (
                <circle
                  key={handle.kind}
                  className={`transform-handle ${handle.kind}`}
                  data-handle={handle.kind}
                  data-kind={handle.kind}
                  data-testid={`handle-${handle.kind}`}
                  cx={handle.point.xCssPx}
                  cy={handle.point.yCssPx}
                  r={handle.kind === "rotate" ? 5 : 4}
                />
              ))}
            </g>
          )}
          {marqueeRect !== null && (
            <rect
              className="marquee-rect"
              data-testid="marquee-selection"
              x={marqueeRect.x}
              y={marqueeRect.y}
              width={marqueeRect.width}
              height={marqueeRect.height}
            />
          )}
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
