import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  EditorActionRequest,
  PathSelectionProjection,
} from "@laserx/application";
import type {
  BoundsMm,
  DocumentObject,
  LaserxDocument,
  Layer,
  PointMm,
} from "@laserx/domain";
import {
  COORDINATE_TOLERANCE_MM,
  applyAffineTransform,
  domainToScreen,
  evaluatePathSegment,
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
  pathSelection: PathSelectionProjection | null;
  importPreview: {
    layers: Layer[];
    objects: DocumentObject[];
    proposedDocumentDimensionsMm?: { widthMm: number; heightMm: number } | undefined;
    focusedObjectId?: string | null | undefined;
  } | null;
  importPreviewFitKey: string | null;
  previewGeometryVisible: boolean;
  rasterBackground: {
    dataUrl: string;
    widthMm: number;
    heightMm: number;
    opacity: number;
  } | null;
  manufacturingPreview: {
    regions: Array<{
      id: string;
      disposition: "retained" | "removed" | "ambiguous";
      points: PointMm[];
    }>;
    focusedIssueLocation: PointMm | null;
    bridgePolygon: PointMm[] | null;
  } | null;
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
    }
  | {
      kind: "path-node";
      startDomain: PointMm;
      objectId: string;
      nodeIndices: number[];
    }
  | {
      kind: "path-handle";
      startDomain: PointMm;
      objectId: string;
      nodeIndex: number;
      handle: "incoming" | "outgoing";
    };

function pointsAttribute(points: readonly ScreenPointCssPx[]): string {
  return points
    .map((point) => `${String(point.xCssPx)},${String(point.yCssPx)}`)
    .join(" ");
}

function compoundPathData(
  contours: readonly {
    closed: boolean;
    points: readonly ScreenPointCssPx[];
  }[],
): string {
  return contours
    .map((contour) => {
      const first = contour.points[0];
      if (first === undefined) {
        return "";
      }
      const segments = contour.points
        .slice(1)
        .map(
          (point) =>
            `L ${String(point.xCssPx)} ${String(point.yCssPx)}`,
        )
        .join(" ");
      return `M ${String(first.xCssPx)} ${String(first.yCssPx)} ${segments}${contour.closed ? " Z" : ""}`;
    })
    .filter((path) => path.length > 0)
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
  pathSelection,
  importPreview,
  importPreviewFitKey,
  previewGeometryVisible,
  rasterBackground,
  manufacturingPreview,
  onEditorAction,
}: ViewportProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const fittedImportPreviewKeyRef = useRef<string | null>(null);
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
    if (
      importPreview === null &&
      size.widthCssPx > 1 &&
      size.heightCssPx > 1
    ) {
      setViewport(fitDocumentToView(document, size));
    }
  }, [
    document.id,
    document.dimensions.widthMm,
    document.dimensions.heightMm,
    document.objects.length,
    importPreview,
    size.heightCssPx,
    size.widthCssPx,
  ]);

  useEffect(() => {
    const location = manufacturingPreview?.focusedIssueLocation;
    if (
      location === null ||
      location === undefined ||
      size.widthCssPx <= 1 ||
      size.heightCssPx <= 1
    ) return;
    setViewport((current) => ({
      ...current,
      originScreenXCssPx:
        size.widthCssPx / 2 - location.xMm * current.zoomCssPxPerMm,
      originScreenYCssPx:
        size.heightCssPx / 2 + location.yMm * current.zoomCssPxPerMm,
    }));
  }, [
    manufacturingPreview?.focusedIssueLocation?.xMm,
    manufacturingPreview?.focusedIssueLocation?.yMm,
    size.heightCssPx,
    size.widthCssPx,
  ]);

  const previewDocument = useMemo(
    () =>
      importPreview === null
        ? null
        : {
            ...document,
            dimensions:
              importPreview.proposedDocumentDimensionsMm ?? document.dimensions,
            layers: [
              ...document.layers,
              ...importPreview.layers.filter(
                (layer) =>
                  !document.layers.some(
                    (documentLayer) => documentLayer.id === layer.id,
                  ),
              ),
            ],
            objects: [...document.objects, ...importPreview.objects],
          },
    [document, importPreview],
  );
  const derivedImportPreviewFitKey = useMemo(
    () =>
      importPreview === null
        ? null
        : importPreviewFitKey ??
          [
            importPreview.proposedDocumentDimensionsMm?.widthMm,
            importPreview.proposedDocumentDimensionsMm?.heightMm,
            ...importPreview.objects.flatMap((object) => [
              object.id,
              object.transform.a,
              object.transform.b,
              object.transform.c,
              object.transform.d,
              object.transform.eMm,
              object.transform.fMm,
            ]),
          ].join(":"),
    [importPreview, importPreviewFitKey],
  );

  useEffect(() => {
    if (previewDocument === null || derivedImportPreviewFitKey === null) {
      fittedImportPreviewKeyRef.current = null;
      return;
    }
    if (
      size.widthCssPx <= 1 ||
      size.heightCssPx <= 1 ||
      fittedImportPreviewKeyRef.current === derivedImportPreviewFitKey
    ) {
      return;
    }
    setViewport(fitDocumentToView(previewDocument, size));
    fittedImportPreviewKeyRef.current = derivedImportPreviewFitKey;
  }, [derivedImportPreviewFitKey, previewDocument, size]);

  const scene = useMemo(
    () => createViewportScene(document, viewport, size, selectionIds),
    [document, selectionIds, size, viewport],
  );
  const previewSelectionIds = useMemo(
    () =>
      importPreview?.focusedObjectId === null ||
      importPreview?.focusedObjectId === undefined
        ? []
        : [importPreview.focusedObjectId],
    [importPreview?.focusedObjectId],
  );
  const previewScene = useMemo(
    () =>
      previewDocument === null
        ? null
        : createViewportScene(
            previewDocument,
            viewport,
            size,
            previewSelectionIds,
          ),
    [previewDocument, previewSelectionIds, size, viewport],
  );
  const previewIsVisible = previewScene !== null && previewGeometryVisible;
  const displayedScene = previewIsVisible ? previewScene : scene;
  const displayedSelectionIds = previewIsVisible
    ? previewSelectionIds
    : selectionIds;
  const incomingObjectIds = useMemo(
    () => new Set(importPreview?.objects.map((object) => object.id) ?? []),
    [importPreview?.objects],
  );
  const rasterProjection = useMemo(() => {
    if (rasterBackground === null) return null;
    const topLeft = domainToScreen(
      { xMm: 0, yMm: rasterBackground.heightMm },
      viewport,
    );
    return {
      ...rasterBackground,
      xCssPx: topLeft.xCssPx,
      yCssPx: topLeft.yCssPx,
      widthCssPx: rasterBackground.widthMm * viewport.zoomCssPxPerMm,
      heightCssPx: rasterBackground.heightMm * viewport.zoomCssPxPerMm,
    };
  }, [rasterBackground, viewport]);
  const manufacturingProjection = useMemo(() => {
    if (manufacturingPreview === null) return null;
    return {
      regions: manufacturingPreview.regions.map((region) => ({
        ...region,
        points: region.points.map((point) => domainToScreen(point, viewport)),
      })),
      focusedIssueLocation:
        manufacturingPreview.focusedIssueLocation === null
          ? null
          : domainToScreen(manufacturingPreview.focusedIssueLocation, viewport),
      bridgePolygon:
        manufacturingPreview.bridgePolygon === null
          ? null
          : manufacturingPreview.bridgePolygon.map((point) =>
              domainToScreen(point, viewport),
            ),
    };
  }, [manufacturingPreview, viewport]);
  const pathOverlay = useMemo(() => {
    if (pathSelection === null) {
      return null;
    }
    const object = document.objects.find(
      (candidate) =>
        candidate.id === pathSelection.objectId && candidate.type === "path",
    );
    if (object?.type !== "path") {
      return null;
    }
    const screenPoint = (point: PointMm): ScreenPointCssPx =>
      domainToScreen(applyAffineTransform(point, object.transform), viewport);
    const segmentCount = object.closed
      ? object.points.length
      : object.points.length - 1;
    return {
      object,
      nodes: object.points.map((point, index) => {
        const handles = object.handles?.[index];
        return {
          index,
          point: screenPoint(point),
          selected: pathSelection.nodeIndices.includes(index),
          incoming:
            handles?.incoming === null || handles?.incoming === undefined
              ? null
              : screenPoint(handles.incoming),
          outgoing:
            handles?.outgoing === null || handles?.outgoing === undefined
              ? null
              : screenPoint(handles.outgoing),
        };
      }),
      segments: Array.from({ length: segmentCount }, (_unused, index) => ({
        index,
        point: screenPoint(evaluatePathSegment(object, index, 0.5)),
        selected: pathSelection.segmentIndices.includes(index),
      })),
    };
  }, [document.objects, pathSelection, viewport]);

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
      if (gesture.kind === "path-node") {
        const target = screenToDomain(point, viewport);
        const deltaXmm = target.xMm - gesture.startDomain.xMm;
        const deltaYmm = target.yMm - gesture.startDomain.yMm;
        if (Math.hypot(deltaXmm, deltaYmm) > COORDINATE_TOLERANCE_MM) {
          onEditorAction({
            type: "path.move-nodes",
            objectId: gesture.objectId,
            nodeIndices: gesture.nodeIndices,
            deltaXmm,
            deltaYmm,
          });
        }
        return;
      }
      if (gesture.kind === "path-handle") {
        const target = screenToDomain(point, viewport);
        if (
          Math.hypot(
            target.xMm - gesture.startDomain.xMm,
            target.yMm - gesture.startDomain.yMm,
          ) > COORDINATE_TOLERANCE_MM
        ) {
          onEditorAction({
            type: "path.set-handle",
            objectId: gesture.objectId,
            nodeIndex: gesture.nodeIndex,
            handle: gesture.handle,
            point: target,
          });
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
          onClick={() =>
            setViewport(fitDocumentToView(previewDocument ?? document, size))
          }
        >
          Fit
        </button>
        <button
          type="button"
          data-testid="reset-view"
          onClick={() =>
            setViewport(resetDocumentView(previewDocument ?? document, size))
          }
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
          const pathNodeIndex =
            target.dataset.pathNodeIndex === undefined
              ? null
              : Number(target.dataset.pathNodeIndex);
          const pathSegmentIndex =
            target.dataset.pathSegmentIndex === undefined
              ? null
              : Number(target.dataset.pathSegmentIndex);
          const pathHandle = target.dataset.pathHandle as
            | "incoming"
            | "outgoing"
            | undefined;
          if (event.button === 1 || event.altKey) {
            gestureRef.current = { kind: "pan", previous: point };
          } else if (
            pathHandle !== undefined &&
            pathNodeIndex !== null &&
            pathOverlay !== null
          ) {
            gestureRef.current = {
              kind: "path-handle",
              startDomain: screenToDomain(point, viewport),
              objectId: pathOverlay.object.id,
              nodeIndex: pathNodeIndex,
              handle: pathHandle,
            };
          } else if (
            pathNodeIndex !== null &&
            pathOverlay !== null &&
            pathSelection !== null
          ) {
            const mode = selectionMode(event);
            const nextNodeIndices =
              mode === "replace"
                ? [pathNodeIndex]
                : mode === "add"
                  ? [...new Set([...pathSelection.nodeIndices, pathNodeIndex])]
                  : pathSelection.nodeIndices.includes(pathNodeIndex)
                    ? pathSelection.nodeIndices.filter((index) => index !== pathNodeIndex)
                    : [...pathSelection.nodeIndices, pathNodeIndex];
            onEditorAction({
              type: "selection.path-node",
              objectId: pathOverlay.object.id,
              nodeIndex: pathNodeIndex,
              mode,
            });
            gestureRef.current =
              nextNodeIndices.length === 0
                ? null
                : {
                    kind: "path-node",
                    startDomain: screenToDomain(point, viewport),
                    objectId: pathOverlay.object.id,
                    nodeIndices: nextNodeIndices,
                  };
          } else if (pathSegmentIndex !== null && pathOverlay !== null) {
            onEditorAction({
              type: "selection.path-segment",
              objectId: pathOverlay.object.id,
              segmentIndex: pathSegmentIndex,
              mode: selectionMode(event),
            });
            gestureRef.current = null;
          } else if (
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
          } else {
            gestureRef.current = {
              kind: "marquee",
              start: point,
              mode: selectionMode(event),
            };
            setMarquee({ start: point, end: point });
          }
          setGestureKind(gestureRef.current?.kind ?? null);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const point = pointFromEvent(event.clientX, event.clientY);
          setCursor(screenToDomain(point, viewport));
          const gesture = gestureRef.current;
          if (gesture?.kind === "pan") {
            const delta = {
              xCssPx: point.xCssPx - gesture.previous.xCssPx,
              yCssPx: point.yCssPx - gesture.previous.yCssPx,
            };
            gesture.previous = point;
            setViewport((current) =>
              panViewport(current, delta),
            );
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
            {displayedScene.gridLines.map((line) =>
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
            x={displayedScene.stock.xCssPx}
            y={displayedScene.stock.yCssPx}
            width={displayedScene.stock.widthCssPx}
            height={displayedScene.stock.heightCssPx}
          />
          {manufacturingProjection !== null && (
            <g
              className="manufacturing-preview"
              data-testid="manufacturing-preview"
              pointerEvents="none"
            >
              {manufacturingProjection.regions.map((region) => (
                <polygon
                  key={region.id}
                  className={`manufacturing-region ${region.disposition}`}
                  data-region-disposition={region.disposition}
                  points={pointsAttribute(region.points)}
                />
              ))}
            </g>
          )}
          <g className="guides" data-testid="viewport-guides">
            {displayedScene.guides.map((guide) =>
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
          <g
            className="placeholder-objects"
            data-testid={previewIsVisible ? "import-preview-overlay" : undefined}
          >
            {displayedScene.objects.map((object) =>
              object.kind === "compound" ? (
                <path
                  key={object.key}
                  className={`${
                    displayedSelectionIds.includes(object.objectId)
                      ? "selected-object "
                      : ""
                  }${
                    previewIsVisible
                      ? incomingObjectIds.has(object.objectId)
                        ? "incoming-import-object"
                        : "existing-import-object"
                      : ""
                  }`}
                  data-object-id={object.objectId}
                  data-source-id={object.sourceId}
                  data-compound-index={object.compoundIndex}
                  data-import-object={
                    previewIsVisible
                      ? incomingObjectIds.has(object.objectId)
                        ? "incoming"
                        : "existing"
                      : undefined
                  }
                  data-testid="compound-text-path"
                  d={compoundPathData(object.contours)}
                  fillRule={object.fillRule}
                  clipRule={object.fillRule}
                />
              ) : object.closed ? (
                <polygon
                  key={object.key}
                  className={`${
                    displayedSelectionIds.includes(object.objectId)
                      ? "selected-object "
                      : ""
                  }${
                    previewIsVisible
                      ? incomingObjectIds.has(object.objectId)
                        ? "incoming-import-object"
                        : "existing-import-object"
                      : ""
                  }`}
                  data-object-id={object.objectId}
                  data-source-id={object.sourceId}
                  data-import-object={
                    previewIsVisible
                      ? incomingObjectIds.has(object.objectId)
                        ? "incoming"
                        : "existing"
                      : undefined
                  }
                  points={pointsAttribute(object.points)}
                />
              ) : (
                <polyline
                  key={object.key}
                  className={`${
                    displayedSelectionIds.includes(object.objectId)
                      ? "selected-object "
                      : ""
                  }${
                    previewIsVisible
                      ? incomingObjectIds.has(object.objectId)
                        ? "incoming-import-object"
                        : "existing-import-object"
                      : ""
                  }`}
                  data-object-id={object.objectId}
                  data-source-id={object.sourceId}
                  data-import-object={
                    previewIsVisible
                      ? incomingObjectIds.has(object.objectId)
                        ? "incoming"
                        : "existing"
                      : undefined
                  }
                  points={pointsAttribute(object.points)}
                />
              ),
            )}
          </g>
          {rasterProjection !== null && (
            <image
              data-testid="raster-preview-image"
              href={rasterProjection.dataUrl}
              x={rasterProjection.xCssPx}
              y={rasterProjection.yCssPx}
              width={rasterProjection.widthCssPx}
              height={rasterProjection.heightCssPx}
              opacity={rasterProjection.opacity}
              preserveAspectRatio="none"
              pointerEvents="none"
            />
          )}
          {manufacturingProjection?.bridgePolygon !== null &&
            manufacturingProjection?.bridgePolygon !== undefined && (
              <polygon
                className="bridge-proposal-overlay"
                data-testid="bridge-proposal-overlay"
                points={pointsAttribute(manufacturingProjection.bridgePolygon)}
                pointerEvents="none"
              />
            )}
          {manufacturingProjection?.focusedIssueLocation !== null &&
            manufacturingProjection?.focusedIssueLocation !== undefined && (
              <g
                className="manufacturing-issue-marker"
                data-testid="manufacturing-issue-marker"
                pointerEvents="none"
              >
                <circle
                  cx={manufacturingProjection.focusedIssueLocation.xCssPx}
                  cy={manufacturingProjection.focusedIssueLocation.yCssPx}
                  r={8}
                />
                <line
                  x1={manufacturingProjection.focusedIssueLocation.xCssPx - 12}
                  y1={manufacturingProjection.focusedIssueLocation.yCssPx}
                  x2={manufacturingProjection.focusedIssueLocation.xCssPx + 12}
                  y2={manufacturingProjection.focusedIssueLocation.yCssPx}
                />
                <line
                  x1={manufacturingProjection.focusedIssueLocation.xCssPx}
                  y1={manufacturingProjection.focusedIssueLocation.yCssPx - 12}
                  x2={manufacturingProjection.focusedIssueLocation.xCssPx}
                  y2={manufacturingProjection.focusedIssueLocation.yCssPx + 12}
                />
              </g>
            )}
          {pathOverlay !== null && (
            <g className="path-edit-overlay" data-testid="path-edit-overlay">
              {pathOverlay.nodes.flatMap((node) => {
                const handles = [
                  ["incoming", node.incoming],
                  ["outgoing", node.outgoing],
                ] as const;
                return node.selected
                  ? handles.flatMap(([kind, handlePoint]) =>
                      handlePoint === null
                        ? []
                        : [
                            <line
                              key={`line-${String(node.index)}-${kind}`}
                              className="curve-handle-line"
                              x1={node.point.xCssPx}
                              y1={node.point.yCssPx}
                              x2={handlePoint.xCssPx}
                              y2={handlePoint.yCssPx}
                            />,
                            <circle
                              key={`handle-${String(node.index)}-${kind}`}
                              className="curve-handle"
                              data-path-node-index={node.index}
                              data-path-handle={kind}
                              cx={handlePoint.xCssPx}
                              cy={handlePoint.yCssPx}
                              r={4}
                            />,
                          ],
                    )
                  : [];
              })}
              {pathOverlay.segments.map((segment) => (
                <rect
                  key={`segment-${String(segment.index)}`}
                  className={`path-segment-handle${segment.selected ? " selected" : ""}`}
                  data-path-segment-index={segment.index}
                  x={segment.point.xCssPx - 3}
                  y={segment.point.yCssPx - 3}
                  width={6}
                  height={6}
                  transform={`rotate(45 ${String(segment.point.xCssPx)} ${String(segment.point.yCssPx)})`}
                />
              ))}
              {pathOverlay.nodes.map((node) => (
                <circle
                  key={`node-${String(node.index)}`}
                  className={`path-node${node.selected ? " selected" : ""}`}
                  data-path-node-index={node.index}
                  data-testid="path-node"
                  cx={node.point.xCssPx}
                  cy={node.point.yCssPx}
                  r={5}
                />
              ))}
            </g>
          )}
          {displayedScene.selection !== null && pathOverlay === null && (
            <g className="selection-overlay" data-testid="selection-overlay">
              <rect
                className="selection-box"
                x={displayedScene.selection.bounds.xCssPx}
                y={displayedScene.selection.bounds.yCssPx}
                width={displayedScene.selection.bounds.widthCssPx}
                height={displayedScene.selection.bounds.heightCssPx}
              />
              {displayedScene.selection.handles.map((handle) => (
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
              {displayedScene.horizontalTicks.map((tick) => (
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
              {displayedScene.verticalTicks.map((tick) => (
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
