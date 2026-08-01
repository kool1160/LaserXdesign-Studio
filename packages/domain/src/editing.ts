import {
  IDENTITY_AFFINE_TRANSFORM,
  addNodeToPathSegment,
  applyAffineTransform,
  boundsCenter,
  boundsHeight,
  boundsWidth,
  cleanupEditablePath,
  composeAffineTransforms,
  deletePathNodes,
  invertAffineTransform,
  joinEditablePaths,
  movePathNodes,
  reverseEditablePath,
  rotationTransformAt,
  scaleTransformAt,
  setEditablePathClosed,
  setPathNodeHandle,
  simplifyEditablePath,
  splitOpenPathAtNode,
  translationTransform,
  type AffineTransformMm,
  type BoundsMm,
  type PointMm,
  type EditablePathGeometry,
} from "@laserx/geometry";

import {
  MAX_SAVED_SIGN_TEMPLATES,
  collectObjectIds,
  copyDocument,
  copyDocumentObject,
  copySignTemplate,
  findLayer,
  getObjectBounds,
  getSelectionBounds,
  isLayerEditable,
  objectUsesLayerRecursively,
  type DocumentObject,
  type Guide,
  type LaserxDocument,
  type Layer,
  type PathObject,
  type SavedSignTemplate,
} from "./model.js";

export type AlignmentKind =
  | "left"
  | "center-x"
  | "right"
  | "bottom"
  | "center-y"
  | "top";

export type DistributionKind = "horizontal" | "vertical";
export type MirrorAxis = "horizontal" | "vertical";
export type ZOrderAction =
  | "bring-forward"
  | "send-backward"
  | "bring-front"
  | "send-back";

export type EditorCommand =
  | {
      type: "objects.move";
      objectIds: string[];
      deltaXmm: number;
      deltaYmm: number;
      snapToleranceMm?: number | undefined;
    }
  | {
      type: "objects.set-bounds";
      objectIds: string[];
      xMm?: number | undefined;
      yMm?: number | undefined;
      widthMm?: number | undefined;
      heightMm?: number | undefined;
      lockAspectRatio: boolean;
    }
  | {
      type: "objects.scale";
      objectIds: string[];
      scaleX: number;
      scaleY: number;
      pivot: PointMm;
    }
  | {
      type: "objects.rotate";
      objectIds: string[];
      angleDeg: number;
      pivot: PointMm;
    }
  | {
      type: "objects.mirror";
      objectIds: string[];
      axis: MirrorAxis;
      pivot: PointMm;
    }
  | {
      type: "objects.duplicate";
      objectIds: string[];
      idMap: Record<string, string>;
      offsetXmm: number;
      offsetYmm: number;
    }
  | {
      type: "objects.insert";
      objects: DocumentObject[];
    }
  | {
      type: "objects.import";
      layers: Layer[];
      objects: DocumentObject[];
    }
  | {
      type: "objects.replace";
      object: DocumentObject;
    }
  | {
      type: "objects.replace-topology";
      sourceObjectIds: string[];
      replacements: PathObject[];
    }
  | {
      type: "template.upsert";
      template: SavedSignTemplate;
    }
  | {
      type: "template.delete";
      templateId: string;
    }
  | {
      type: "path.move-nodes";
      objectId: string;
      nodeIndices: number[];
      deltaXmm: number;
      deltaYmm: number;
    }
  | {
      type: "path.add-node";
      objectId: string;
      segmentIndex: number;
      ratio: number;
    }
  | {
      type: "path.delete-nodes";
      objectId: string;
      nodeIndices: number[];
    }
  | {
      type: "path.set-handle";
      objectId: string;
      nodeIndex: number;
      handle: "incoming" | "outgoing";
      point: PointMm | null;
    }
  | {
      type: "path.set-closed";
      objectId: string;
      closed: boolean;
    }
  | { type: "path.reverse"; objectId: string }
  | {
      type: "path.simplify";
      objectId: string;
      toleranceMm: number;
    }
  | {
      type: "path.cleanup";
      objectId: string;
      toleranceMm: number;
    }
  | {
      type: "paths.join";
      firstObjectId: string;
      firstEnd: "start" | "end";
      secondObjectId: string;
      secondEnd: "start" | "end";
      toleranceMm: number;
    }
  | {
      type: "path.split";
      objectId: string;
      nodeIndex: number;
      newObjectId: string;
    }
  | {
      type: "objects.convert-text";
      objectIds: string[];
      groupIds: Record<string, string>;
      contourIds: Record<string, string[]>;
      preserveSource: boolean;
    }
  | { type: "objects.delete"; objectIds: string[] }
  | {
      type: "objects.align";
      objectIds: string[];
      alignment: AlignmentKind;
    }
  | {
      type: "objects.distribute";
      objectIds: string[];
      distribution: DistributionKind;
    }
  | {
      type: "objects.group";
      objectIds: string[];
      groupId: string;
      layerId: string;
    }
  | { type: "objects.ungroup"; objectIds: string[] }
  | {
      type: "objects.z-order";
      objectIds: string[];
      action: ZOrderAction;
    }
  | { type: "layer.add"; layer: Layer }
  | { type: "layer.activate"; layerId: string }
  | { type: "layer.rename"; layerId: string; name: string }
  | { type: "layer.set-visibility"; layerId: string; visible: boolean }
  | { type: "layer.set-locked"; layerId: string; locked: boolean }
  | { type: "layer.reorder"; layerId: string; toIndex: number }
  | {
      type: "layer.delete";
      layerId: string;
      fallbackLayerId: string;
    }
  | { type: "guide.add"; guide: Guide }
  | { type: "guide.move"; guideId: string; positionMm: number }
  | { type: "guide.delete"; guideId: string };

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite.`);
  }
}

function assertNonnegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be nonnegative and finite.`);
  }
}

function editablePath(
  document: LaserxDocument,
  objectId: string,
): PathObject {
  const object = document.objects.find((candidate) => candidate.id === objectId);
  if (
    object?.type !== "path" ||
    !isLayerEditable(document, object.layerId)
  ) {
    throw new RangeError("The requested path is missing or not editable.");
  }
  return object;
}

function pathGeometry(object: PathObject): EditablePathGeometry {
  return {
    closed: object.closed,
    points: object.points.map((point) => ({ ...point })),
    ...(object.handles === undefined
      ? {}
      : {
          handles: object.handles.map((handle) => ({
            incoming:
              handle.incoming === null ? null : { ...handle.incoming },
            outgoing:
              handle.outgoing === null ? null : { ...handle.outgoing },
          })),
        }),
  };
}

function worldPathGeometry(object: PathObject): EditablePathGeometry {
  const geometry = pathGeometry(object);
  return {
    closed: geometry.closed,
    points: geometry.points.map((point) =>
      applyAffineTransform(point, object.transform),
    ),
    ...(geometry.handles === undefined
      ? {}
      : {
          handles: geometry.handles.map((handle) => ({
            incoming:
              handle.incoming === null
                ? null
                : applyAffineTransform(handle.incoming, object.transform),
            outgoing:
              handle.outgoing === null
                ? null
                : applyAffineTransform(handle.outgoing, object.transform),
          })),
        }),
  };
}

function withPathGeometry(
  object: PathObject,
  geometry: EditablePathGeometry,
  transform = object.transform,
): PathObject {
  return {
    ...object,
    transform: { ...transform },
    closed: geometry.closed,
    points: geometry.points.map((point) => ({ ...point })),
    ...(geometry.handles === undefined
      ? { handles: undefined }
      : {
          handles: geometry.handles.map((handle) => ({
            incoming:
              handle.incoming === null ? null : { ...handle.incoming },
            outgoing:
              handle.outgoing === null ? null : { ...handle.outgoing },
          })),
        }),
  };
}

function worldDeltaToLocal(
  object: PathObject,
  deltaXmm: number,
  deltaYmm: number,
): PointMm {
  const inverse = invertAffineTransform(object.transform);
  const origin = applyAffineTransform({ xMm: 0, yMm: 0 }, inverse);
  const target = applyAffineTransform(
    { xMm: deltaXmm, yMm: deltaYmm },
    inverse,
  );
  return {
    xMm: target.xMm - origin.xMm,
    yMm: target.yMm - origin.yMm,
  };
}

function editableObjectIds(
  document: LaserxDocument,
  requestedIds: readonly string[],
): Set<string> {
  return new Set(
    document.objects
      .filter(
        (object) =>
          requestedIds.includes(object.id) &&
          isLayerEditable(document, object.layerId),
      )
      .map((object) => object.id),
  );
}

function applyTransformToIds(
  document: LaserxDocument,
  requestedIds: readonly string[],
  transform: AffineTransformMm,
): void {
  const editableIds = editableObjectIds(document, requestedIds);
  document.objects = document.objects.map((object) =>
    editableIds.has(object.id)
      ? {
          ...copyDocumentObject(object),
          transform: composeAffineTransforms(transform, object.transform),
        }
      : object,
  );
}

function anchors(bounds: BoundsMm, axis: "x" | "y"): number[] {
  return axis === "x"
    ? [
        bounds.minXmm,
        (bounds.minXmm + bounds.maxXmm) / 2,
        bounds.maxXmm,
      ]
    : [
        bounds.minYmm,
        (bounds.minYmm + bounds.maxYmm) / 2,
        bounds.maxYmm,
      ];
}

function closestAdjustment(
  movingAnchors: readonly number[],
  targets: readonly number[],
  toleranceMm: number,
): number | null {
  let adjustment: number | null = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const moving of movingAnchors) {
    for (const target of targets) {
      const candidate = target - moving;
      const candidateDistance = Math.abs(candidate);
      if (
        candidateDistance <= toleranceMm &&
        candidateDistance < distance
      ) {
        distance = candidateDistance;
        adjustment = candidate;
      }
    }
  }
  return adjustment;
}

function gridAdjustment(
  movingAnchors: readonly number[],
  spacingMm: number,
  toleranceMm: number,
): number | null {
  let adjustment: number | null = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const moving of movingAnchors) {
    const candidate =
      Math.round(moving / spacingMm) * spacingMm - moving;
    const candidateDistance = Math.abs(candidate);
    if (
      candidateDistance <= toleranceMm &&
      candidateDistance < distance
    ) {
      adjustment = candidate;
      distance = candidateDistance;
    }
  }
  return adjustment;
}

export interface SnappedMove {
  deltaXmm: number;
  deltaYmm: number;
}

export function snapMoveDelta(
  document: LaserxDocument,
  objectIds: readonly string[],
  requestedDelta: SnappedMove,
  toleranceMm: number,
): SnappedMove {
  const preferences = document.settings.viewport.snapping;
  const selectionBounds = getSelectionBounds(document, objectIds);
  if (
    selectionBounds === null ||
    !preferences.enabled ||
    toleranceMm <= 0
  ) {
    return { ...requestedDelta };
  }
  const movedBounds: BoundsMm = {
    minXmm: selectionBounds.minXmm + requestedDelta.deltaXmm,
    minYmm: selectionBounds.minYmm + requestedDelta.deltaYmm,
    maxXmm: selectionBounds.maxXmm + requestedDelta.deltaXmm,
    maxYmm: selectionBounds.maxYmm + requestedDelta.deltaYmm,
  };
  const xTargets: number[] = [];
  const yTargets: number[] = [];

  if (preferences.snapToDocument) {
    xTargets.push(0, document.dimensions.widthMm / 2, document.dimensions.widthMm);
    yTargets.push(
      0,
      document.dimensions.heightMm / 2,
      document.dimensions.heightMm,
    );
  }
  if (preferences.snapToGuides) {
    for (const guide of document.guides) {
      (guide.axis === "x" ? xTargets : yTargets).push(guide.positionMm);
    }
  }
  if (preferences.snapToObjects) {
    const selected = new Set(objectIds);
    for (const object of document.objects) {
      if (selected.has(object.id)) {
        continue;
      }
      const layer = findLayer(document, object.layerId);
      if (layer?.visible !== true) {
        continue;
      }
      const bounds = getObjectBounds(object);
      xTargets.push(...anchors(bounds, "x"));
      yTargets.push(...anchors(bounds, "y"));
    }
  }

  const movedXAnchors = anchors(movedBounds, "x");
  const movedYAnchors = anchors(movedBounds, "y");
  let adjustX = closestAdjustment(movedXAnchors, xTargets, toleranceMm);
  let adjustY = closestAdjustment(movedYAnchors, yTargets, toleranceMm);
  if (preferences.snapToGrid) {
    const gridX = gridAdjustment(
      movedXAnchors,
      document.settings.viewport.gridSpacingMm,
      toleranceMm,
    );
    const gridY = gridAdjustment(
      movedYAnchors,
      document.settings.viewport.gridSpacingMm,
      toleranceMm,
    );
    if (
      gridX !== null &&
      (adjustX === null || Math.abs(gridX) < Math.abs(adjustX))
    ) {
      adjustX = gridX;
    }
    if (
      gridY !== null &&
      (adjustY === null || Math.abs(gridY) < Math.abs(adjustY))
    ) {
      adjustY = gridY;
    }
  }
  return {
    deltaXmm: requestedDelta.deltaXmm + (adjustX ?? 0),
    deltaYmm: requestedDelta.deltaYmm + (adjustY ?? 0),
  };
}

export function cloneObjectWithNewIds(
  object: DocumentObject,
  idMap: Readonly<Record<string, string>>,
  targetLayerId?: string,
): DocumentObject {
  const id = idMap[object.id];
  if (id === undefined) {
    throw new RangeError(`Missing replacement ID for ${object.id}.`);
  }
  if (object.type === "group") {
    return {
        ...object,
        id,
        layerId: targetLayerId ?? object.layerId,
        transform: { ...object.transform },
        children: object.children.map((child) =>
          cloneObjectWithNewIds(child, idMap, targetLayerId),
        ),
      };
  }
  return {
    ...copyDocumentObject(object),
    id,
    layerId: targetLayerId ?? object.layerId,
  };
}

export function cloneObjectsWithNewIds(
  objects: readonly DocumentObject[],
  idMap: Readonly<Record<string, string>>,
  offsetXmm: number,
  offsetYmm: number,
  targetLayerId?: string,
): DocumentObject[] {
  const offset = translationTransform(offsetXmm, offsetYmm);
  return objects.map((object) => {
    const clone = cloneObjectWithNewIds(object, idMap, targetLayerId);
    return {
      ...clone,
      transform: composeAffineTransforms(offset, clone.transform),
    };
  });
}

function validateInsertedIds(
  document: LaserxDocument,
  objects: readonly DocumentObject[],
): void {
  const existing = new Set(
    document.objects.flatMap((object) => collectObjectIds(object)),
  );
  const incoming = objects.flatMap((object) => collectObjectIds(object));
  if (new Set(incoming).size !== incoming.length) {
    throw new RangeError("Inserted object IDs must be unique.");
  }
  if (incoming.some((id) => existing.has(id))) {
    throw new RangeError("Inserted object IDs must be new to the document.");
  }
  if (
    objects.some((object) => findLayer(document, object.layerId) === undefined)
  ) {
    throw new RangeError("Inserted objects must reference an existing layer.");
  }
  if (objects.some((object) => !objectUsesLayerRecursively(object))) {
    throw new RangeError(
      "Every descendant of an inserted group must use the group's layer.",
    );
  }
  if (objects.some((object) => !objectPathGeometryIsValid(object))) {
    throw new RangeError("Inserted path geometry is invalid.");
  }
}

function pointIsFinite(point: PointMm): boolean {
  return Number.isFinite(point.xMm) && Number.isFinite(point.yMm);
}

function objectPathGeometryIsValid(object: DocumentObject): boolean {
  if (object.type === "group") {
    return object.children.every((child) => objectPathGeometryIsValid(child));
  }
  if (object.type !== "path") {
    return true;
  }
  return (
    object.points.length >= (object.closed ? 3 : 2) &&
    object.points.every(pointIsFinite) &&
    (object.handles === undefined ||
      (object.handles.length === object.points.length &&
        object.handles.every(
          (handles) =>
            (handles.incoming === null || pointIsFinite(handles.incoming)) &&
            (handles.outgoing === null || pointIsFinite(handles.outgoing)),
        )))
  );
}

function setLayerRecursively(
  object: DocumentObject,
  layerId: string,
): DocumentObject {
  const copy = copyDocumentObject(object);
  return copy.type === "group"
    ? {
        ...copy,
        layerId,
        children: copy.children.map((child) =>
          setLayerRecursively(child, layerId),
        ),
      }
    : { ...copy, layerId };
}

function alignObjects(
  document: LaserxDocument,
  objectIds: readonly string[],
  alignment: AlignmentKind,
): void {
  const editableIds = editableObjectIds(document, objectIds);
  const selected = document.objects.filter((object) =>
    editableIds.has(object.id),
  );
  const selectionBounds = getSelectionBounds(
    document,
    selected.map((object) => object.id),
  );
  if (selectionBounds === null || selected.length < 2) {
    return;
  }
  for (const object of selected) {
    const bounds = getObjectBounds(object);
    let deltaXmm = 0;
    let deltaYmm = 0;
    switch (alignment) {
      case "left":
        deltaXmm = selectionBounds.minXmm - bounds.minXmm;
        break;
      case "center-x":
        deltaXmm =
          boundsCenter(selectionBounds).xMm - boundsCenter(bounds).xMm;
        break;
      case "right":
        deltaXmm = selectionBounds.maxXmm - bounds.maxXmm;
        break;
      case "bottom":
        deltaYmm = selectionBounds.minYmm - bounds.minYmm;
        break;
      case "center-y":
        deltaYmm =
          boundsCenter(selectionBounds).yMm - boundsCenter(bounds).yMm;
        break;
      case "top":
        deltaYmm = selectionBounds.maxYmm - bounds.maxYmm;
        break;
    }
    applyTransformToIds(
      document,
      [object.id],
      translationTransform(deltaXmm, deltaYmm),
    );
  }
}

function distributeObjects(
  document: LaserxDocument,
  objectIds: readonly string[],
  distribution: DistributionKind,
): void {
  const editableIds = editableObjectIds(document, objectIds);
  const selected = document.objects
    .filter((object) => editableIds.has(object.id))
    .map((object) => ({
      object,
      center: boundsCenter(getObjectBounds(object)),
    }))
    .sort((first, second) =>
      distribution === "horizontal"
        ? first.center.xMm - second.center.xMm
        : first.center.yMm - second.center.yMm,
    );
  if (selected.length < 3) {
    return;
  }
  const first = selected[0];
  const last = selected[selected.length - 1];
  if (first === undefined || last === undefined) {
    return;
  }
  const start =
    distribution === "horizontal" ? first.center.xMm : first.center.yMm;
  const end =
    distribution === "horizontal" ? last.center.xMm : last.center.yMm;
  const step = (end - start) / (selected.length - 1);
  for (let index = 1; index < selected.length - 1; index += 1) {
    const entry = selected[index];
    if (entry === undefined) {
      continue;
    }
    const target = start + step * index;
    const current =
      distribution === "horizontal"
        ? entry.center.xMm
        : entry.center.yMm;
    applyTransformToIds(
      document,
      [entry.object.id],
      translationTransform(
        distribution === "horizontal" ? target - current : 0,
        distribution === "vertical" ? target - current : 0,
      ),
    );
  }
}

function reorderObjects(
  document: LaserxDocument,
  objectIds: readonly string[],
  action: ZOrderAction,
): void {
  const selectedIds = editableObjectIds(document, objectIds);
  document.objects = document.layers.flatMap((layer) => {
    const layerObjects = document.objects.filter(
      (object) => object.layerId === layer.id,
    );
    if (action === "bring-front" || action === "send-back") {
      const selected = layerObjects.filter((object) =>
        selectedIds.has(object.id),
      );
      const remaining = layerObjects.filter(
        (object) => !selectedIds.has(object.id),
      );
      return action === "bring-front"
        ? [...remaining, ...selected]
        : [...selected, ...remaining];
    }
    const reordered = [...layerObjects];
    if (action === "bring-forward") {
      for (let index = reordered.length - 2; index >= 0; index -= 1) {
        const current = reordered[index];
        const next = reordered[index + 1];
        if (
          current !== undefined &&
          next !== undefined &&
          selectedIds.has(current.id) &&
          !selectedIds.has(next.id)
        ) {
          reordered[index] = next;
          reordered[index + 1] = current;
        }
      }
    } else {
      for (let index = 1; index < reordered.length; index += 1) {
        const current = reordered[index];
        const previous = reordered[index - 1];
        if (
          current !== undefined &&
          previous !== undefined &&
          selectedIds.has(current.id) &&
          !selectedIds.has(previous.id)
        ) {
          reordered[index] = previous;
          reordered[index - 1] = current;
        }
      }
    }
    return reordered;
  });
}

export function applyEditorCommand(
  source: LaserxDocument,
  command: EditorCommand,
): LaserxDocument {
  const document = copyDocument(source);
  switch (command.type) {
    case "objects.move": {
      assertFinite(command.deltaXmm, "Move X");
      assertFinite(command.deltaYmm, "Move Y");
      const snapped =
        command.snapToleranceMm === undefined
          ? {
              deltaXmm: command.deltaXmm,
              deltaYmm: command.deltaYmm,
            }
          : snapMoveDelta(
              document,
              command.objectIds,
              {
                deltaXmm: command.deltaXmm,
                deltaYmm: command.deltaYmm,
              },
              command.snapToleranceMm,
            );
      applyTransformToIds(
        document,
        command.objectIds,
        translationTransform(snapped.deltaXmm, snapped.deltaYmm),
      );
      break;
    }
    case "objects.set-bounds": {
      const selectedIds = [
        ...editableObjectIds(document, command.objectIds),
      ];
      const bounds = getSelectionBounds(document, selectedIds);
      if (bounds === null) {
        break;
      }
      if (command.xMm !== undefined) {
        assertFinite(command.xMm, "Target X");
      }
      if (command.yMm !== undefined) {
        assertFinite(command.yMm, "Target Y");
      }
      const sourceWidth = boundsWidth(bounds);
      const sourceHeight = boundsHeight(bounds);
      let targetWidth = command.widthMm ?? sourceWidth;
      let targetHeight = command.heightMm ?? sourceHeight;
      assertNonnegative(targetWidth, "Target width");
      assertNonnegative(targetHeight, "Target height");
      if (sourceWidth === 0 && targetWidth !== 0) {
        throw new RangeError(
          "Cannot resize width because the selection's current width is zero.",
        );
      }
      if (sourceHeight === 0 && targetHeight !== 0) {
        throw new RangeError(
          "Cannot resize height because the selection's current height is zero.",
        );
      }
      if (sourceWidth > 0 && targetWidth === 0) {
        throw new RangeError(
          "Target width must remain positive for a nonzero-width selection.",
        );
      }
      if (sourceHeight > 0 && targetHeight === 0) {
        throw new RangeError(
          "Target height must remain positive for a nonzero-height selection.",
        );
      }
      if (
        command.lockAspectRatio &&
        sourceWidth > 0 &&
        sourceHeight > 0
      ) {
        const aspect = sourceWidth / sourceHeight;
        if (command.widthMm !== undefined) {
          targetHeight = targetWidth / aspect;
        } else if (command.heightMm !== undefined) {
          targetWidth = targetHeight * aspect;
        }
      }
      const scale = scaleTransformAt(
        sourceWidth === 0 ? 1 : targetWidth / sourceWidth,
        sourceHeight === 0 ? 1 : targetHeight / sourceHeight,
        { xMm: bounds.minXmm, yMm: bounds.minYmm },
      );
      applyTransformToIds(document, selectedIds, scale);
      const scaledBounds = getSelectionBounds(document, selectedIds);
      if (scaledBounds !== null) {
        applyTransformToIds(
          document,
          selectedIds,
          translationTransform(
            (command.xMm ?? scaledBounds.minXmm) - scaledBounds.minXmm,
            (command.yMm ?? scaledBounds.minYmm) - scaledBounds.minYmm,
          ),
        );
      }
      break;
    }
    case "objects.scale":
      applyTransformToIds(
        document,
        command.objectIds,
        scaleTransformAt(command.scaleX, command.scaleY, command.pivot),
      );
      break;
    case "objects.rotate":
      applyTransformToIds(
        document,
        command.objectIds,
        rotationTransformAt(command.angleDeg, command.pivot),
      );
      break;
    case "objects.mirror":
      applyTransformToIds(
        document,
        command.objectIds,
        scaleTransformAt(
          command.axis === "vertical" ? -1 : 1,
          command.axis === "horizontal" ? -1 : 1,
          command.pivot,
        ),
      );
      break;
    case "objects.duplicate": {
      const editableIds = editableObjectIds(document, command.objectIds);
      const originals = document.objects.filter((object) =>
        editableIds.has(object.id),
      );
      const expectedIds = originals.flatMap((object) =>
        collectObjectIds(object),
      );
      if (expectedIds.some((id) => command.idMap[id] === undefined)) {
        throw new RangeError("Duplicate requires a new ID for every object.");
      }
      const duplicates = cloneObjectsWithNewIds(
        originals,
        command.idMap,
        command.offsetXmm,
        command.offsetYmm,
      );
      validateInsertedIds(document, duplicates);
      document.objects.push(...duplicates);
      break;
    }
    case "objects.insert":
      validateInsertedIds(document, command.objects);
      document.objects.push(...command.objects.map(copyDocumentObject));
      break;
    case "objects.import": {
      const incomingLayerIds = command.layers.map((layer) => layer.id);
      if (
        new Set(incomingLayerIds).size !== incomingLayerIds.length ||
        incomingLayerIds.some((id) => findLayer(document, id) !== undefined)
      ) {
        throw new RangeError("Imported layer IDs must be unique and new to the document.");
      }
      const layers = command.layers.map((layer) => {
        const name = layer.name.trim();
        if (name.length === 0 || name.length > 100) {
          throw new RangeError("Imported layer names must contain 1 to 100 characters.");
        }
        return { ...layer, name };
      });
      document.layers.push(...layers);
      validateInsertedIds(document, command.objects);
      document.objects.push(...command.objects.map(copyDocumentObject));
      break;
    }
    case "template.upsert": {
      const template = copySignTemplate(command.template);
      const existingIndex = document.templates.findIndex(
        (candidate) => candidate.id === template.id,
      );
      if (
        existingIndex < 0 &&
        [
          ...document.layers.map((layer) => layer.id),
          ...document.guides.map((guide) => guide.id),
          ...document.objects.flatMap(collectObjectIds),
        ].includes(template.id)
      ) {
        throw new RangeError("Template IDs must be unique within the document.");
      }
      if (existingIndex < 0) {
        if (document.templates.length >= MAX_SAVED_SIGN_TEMPLATES) {
          throw new RangeError("A document supports at most 1,000 saved sign templates.");
        }
        document.templates.push(template);
      } else {
        document.templates[existingIndex] = template;
      }
      break;
    }
    case "template.delete":
      document.templates = document.templates.filter(
        (template) => template.id !== command.templateId,
      );
      break;
    case "objects.replace": {
      const index = document.objects.findIndex(
        (object) => object.id === command.object.id,
      );
      const previous = document.objects[index];
      if (
        previous === undefined ||
        !isLayerEditable(document, previous.layerId) ||
        command.object.layerId !== previous.layerId ||
        !objectPathGeometryIsValid(command.object) ||
        collectObjectIds(command.object).some(
          (id) =>
            id !== previous.id &&
            document.objects.some((object) =>
              collectObjectIds(object).includes(id),
            ),
        )
      ) {
        throw new RangeError("Replacement object is invalid or not editable.");
      }
      document.objects[index] = copyDocumentObject(command.object);
      break;
    }
    case "objects.replace-topology": {
      const sourceIds = new Set(
        editableObjectIds(document, command.sourceObjectIds),
      );
      if (
        sourceIds.size !== new Set(command.sourceObjectIds).size ||
        command.replacements.length === 0
      ) {
        throw new RangeError("Topology replacement sources are invalid.");
      }
      const insertionIndex = document.objects.findIndex((object) =>
        sourceIds.has(object.id),
      );
      if (insertionIndex < 0) {
        throw new RangeError("Topology replacement sources are missing.");
      }
      const retained = document.objects.filter(
        (object) => !sourceIds.has(object.id),
      );
      const retainedIds = new Set(
        retained.flatMap((object) => collectObjectIds(object)),
      );
      const replacementIds = command.replacements.flatMap((object) =>
        collectObjectIds(object),
      );
      if (
        new Set(replacementIds).size !== replacementIds.length ||
        replacementIds.some((id) => retainedIds.has(id)) ||
        command.replacements.some(
          (object) =>
            !isLayerEditable(document, object.layerId) ||
            !objectPathGeometryIsValid(object),
        )
      ) {
        throw new RangeError("Topology replacement paths contain invalid IDs or layers.");
      }
      retained.splice(
        insertionIndex,
        0,
        ...command.replacements.map((object) => copyDocumentObject(object) as PathObject),
      );
      document.objects = retained;
      break;
    }
    case "path.move-nodes": {
      assertFinite(command.deltaXmm, "Node move X");
      assertFinite(command.deltaYmm, "Node move Y");
      const object = editablePath(document, command.objectId);
      const geometry = movePathNodes(
        pathGeometry(object),
        command.nodeIndices,
        worldDeltaToLocal(object, command.deltaXmm, command.deltaYmm),
      );
      document.objects = document.objects.map((candidate) =>
        candidate.id === object.id ? withPathGeometry(object, geometry) : candidate,
      );
      break;
    }
    case "path.add-node": {
      const object = editablePath(document, command.objectId);
      const geometry = addNodeToPathSegment(
        pathGeometry(object),
        command.segmentIndex,
        command.ratio,
      ).path;
      document.objects = document.objects.map((candidate) =>
        candidate.id === object.id ? withPathGeometry(object, geometry) : candidate,
      );
      break;
    }
    case "path.delete-nodes": {
      const object = editablePath(document, command.objectId);
      const geometry = deletePathNodes(pathGeometry(object), command.nodeIndices);
      document.objects = document.objects.map((candidate) =>
        candidate.id === object.id ? withPathGeometry(object, geometry) : candidate,
      );
      break;
    }
    case "path.set-handle": {
      const object = editablePath(document, command.objectId);
      const inverse = invertAffineTransform(object.transform);
      const localPoint =
        command.point === null
          ? null
          : applyAffineTransform(command.point, inverse);
      const geometry = setPathNodeHandle(
        pathGeometry(object),
        command.nodeIndex,
        command.handle,
        localPoint,
      );
      document.objects = document.objects.map((candidate) =>
        candidate.id === object.id ? withPathGeometry(object, geometry) : candidate,
      );
      break;
    }
    case "path.set-closed": {
      const object = editablePath(document, command.objectId);
      const geometry = setEditablePathClosed(pathGeometry(object), command.closed);
      document.objects = document.objects.map((candidate) =>
        candidate.id === object.id ? withPathGeometry(object, geometry) : candidate,
      );
      break;
    }
    case "path.reverse": {
      const object = editablePath(document, command.objectId);
      const geometry = reverseEditablePath(pathGeometry(object));
      document.objects = document.objects.map((candidate) =>
        candidate.id === object.id ? withPathGeometry(object, geometry) : candidate,
      );
      break;
    }
    case "path.simplify": {
      const object = editablePath(document, command.objectId);
      const geometry = simplifyEditablePath(
        worldPathGeometry(object),
        command.toleranceMm,
      );
      document.objects = document.objects.map((candidate) =>
        candidate.id === object.id
          ? withPathGeometry(object, geometry, IDENTITY_AFFINE_TRANSFORM)
          : candidate,
      );
      break;
    }
    case "path.cleanup": {
      const object = editablePath(document, command.objectId);
      const geometry = cleanupEditablePath(
        worldPathGeometry(object),
        command.toleranceMm,
      ).path;
      document.objects = document.objects.map((candidate) =>
        candidate.id === object.id
          ? withPathGeometry(object, geometry, IDENTITY_AFFINE_TRANSFORM)
          : candidate,
      );
      break;
    }
    case "paths.join": {
      if (command.firstObjectId === command.secondObjectId) {
        throw new RangeError("Joining requires two different open paths.");
      }
      const first = editablePath(document, command.firstObjectId);
      const second = editablePath(document, command.secondObjectId);
      if (first.layerId !== second.layerId) {
        throw new RangeError(
          "Joining paths requires both paths to share one editable layer.",
        );
      }
      const geometry = joinEditablePaths(
        worldPathGeometry(first),
        command.firstEnd,
        worldPathGeometry(second),
        command.secondEnd,
        command.toleranceMm,
      );
      document.objects = document.objects
        .filter((candidate) => candidate.id !== second.id)
        .map((candidate) =>
          candidate.id === first.id
            ? withPathGeometry(first, geometry, IDENTITY_AFFINE_TRANSFORM)
            : candidate,
        );
      break;
    }
    case "path.split": {
      const object = editablePath(document, command.objectId);
      if (
        document.objects.some((candidate) =>
          collectObjectIds(candidate).includes(command.newObjectId),
        )
      ) {
        throw new RangeError("Split path requires a unique new object ID.");
      }
      const [first, second] = splitOpenPathAtNode(
        pathGeometry(object),
        command.nodeIndex,
      );
      const index = document.objects.findIndex((candidate) => candidate.id === object.id);
      document.objects.splice(
        index,
        1,
        withPathGeometry(object, first),
        withPathGeometry({ ...object, id: command.newObjectId }, second),
      );
      break;
    }
    case "objects.convert-text": {
      const editableIds = editableObjectIds(document, command.objectIds);
      const existingIds = new Set(
        document.objects.flatMap((object) => collectObjectIds(object)),
      );
      const generatedIds = new Set<string>();
      document.objects = document.objects.map((object) => {
        if (object.type !== "text" || !editableIds.has(object.id)) {
          return object;
        }
        const groupId = command.groupIds[object.id];
        const contourIds = command.contourIds[object.id];
        if (
          groupId === undefined ||
          contourIds === undefined ||
          contourIds.length !== object.contours.length
        ) {
          throw new RangeError(
            "Outline conversion requires IDs for every contour.",
          );
        }
        for (const id of [groupId, ...contourIds]) {
          if (existingIds.has(id) || generatedIds.has(id)) {
            throw new RangeError("Outline conversion IDs must be unique.");
          }
          generatedIds.add(id);
        }
        const sourceText = object;
        return {
          id: groupId,
          type: "group",
          layerId: object.layerId,
          transform: { ...object.transform },
          children: object.contours.map((contour, index) => ({
            id: contourIds[index] as string,
            type: "path",
            layerId: object.layerId,
            transform: { ...IDENTITY_AFFINE_TRANSFORM },
            closed: contour.closed,
            points: contour.points.map((point) => ({
              xMm: point.xMm + object.origin.xMm,
              yMm: point.yMm + object.origin.yMm,
            })),
          })),
          ...(command.preserveSource
            ? {
                sourceText: {
                  content: sourceText.content,
                  origin: { ...sourceText.origin },
                  style: { ...sourceText.style },
                  arc:
                    sourceText.arc === null ? null : { ...sourceText.arc },
                  contours: sourceText.contours.map((contour) => ({
                    compoundIndex: contour.compoundIndex,
                    closed: contour.closed,
                    points: contour.points.map((point) => ({ ...point })),
                  })),
                },
              }
            : {}),
        };
      });
      break;
    }
    case "objects.delete": {
      const editableIds = editableObjectIds(document, command.objectIds);
      document.objects = document.objects.filter(
        (object) => !editableIds.has(object.id),
      );
      break;
    }
    case "objects.align":
      alignObjects(document, command.objectIds, command.alignment);
      break;
    case "objects.distribute":
      distributeObjects(
        document,
        command.objectIds,
        command.distribution,
      );
      break;
    case "objects.group": {
      if (!isLayerEditable(document, command.layerId)) {
        break;
      }
      const editableIds = editableObjectIds(document, command.objectIds);
      const selected = document.objects.filter((object) =>
        editableIds.has(object.id),
      );
      if (selected.length < 2) {
        break;
      }
      validateInsertedIds(document, [
        {
          id: command.groupId,
          type: "group",
          layerId: command.layerId,
          transform: { ...IDENTITY_AFFINE_TRANSFORM },
          children: [],
        },
      ]);
      const selectedIndexes = selected.map((object) =>
        document.objects.findIndex((candidate) => candidate.id === object.id),
      );
      const insertionIndex = Math.min(...selectedIndexes);
      document.objects = document.objects.filter(
        (object) => !editableIds.has(object.id),
      );
      document.objects.splice(insertionIndex, 0, {
        id: command.groupId,
        type: "group",
        layerId: command.layerId,
        transform: { ...IDENTITY_AFFINE_TRANSFORM },
        children: selected.map((object) =>
          setLayerRecursively(object, command.layerId),
        ),
      });
      break;
    }
    case "objects.ungroup": {
      const editableIds = editableObjectIds(document, command.objectIds);
      const next: DocumentObject[] = [];
      for (const object of document.objects) {
        if (object.type !== "group" || !editableIds.has(object.id)) {
          next.push(object);
          continue;
        }
        next.push(
          ...object.children.map((child) => ({
            ...setLayerRecursively(child, object.layerId),
            transform: composeAffineTransforms(
              object.transform,
              child.transform,
            ),
          })),
        );
      }
      document.objects = next;
      break;
    }
    case "objects.z-order":
      reorderObjects(document, command.objectIds, command.action);
      break;
    case "layer.add":
      if (document.layers.some((layer) => layer.id === command.layer.id)) {
        throw new RangeError("Layer IDs must be unique.");
      }
      document.layers.push({ ...command.layer });
      document.activeLayerId = command.layer.id;
      break;
    case "layer.activate":
      if (findLayer(document, command.layerId) !== undefined) {
        document.activeLayerId = command.layerId;
      }
      break;
    case "layer.rename": {
      const name = command.name.trim();
      if (name.length === 0 || name.length > 100) {
        throw new RangeError("Layer names must contain 1 to 100 characters.");
      }
      document.layers = document.layers.map((layer) =>
        layer.id === command.layerId ? { ...layer, name } : layer,
      );
      break;
    }
    case "layer.set-visibility":
      document.layers = document.layers.map((layer) =>
        layer.id === command.layerId
          ? { ...layer, visible: command.visible }
          : layer,
      );
      break;
    case "layer.set-locked":
      document.layers = document.layers.map((layer) =>
        layer.id === command.layerId
          ? { ...layer, locked: command.locked }
          : layer,
      );
      break;
    case "layer.reorder": {
      const index = document.layers.findIndex(
        (layer) => layer.id === command.layerId,
      );
      if (index < 0) {
        break;
      }
      const [layer] = document.layers.splice(index, 1);
      if (layer !== undefined) {
        const target = Math.max(
          0,
          Math.min(document.layers.length, command.toIndex),
        );
        document.layers.splice(target, 0, layer);
      }
      break;
    }
    case "layer.delete": {
      if (document.layers.length <= 1) {
        break;
      }
      if (
        command.layerId === command.fallbackLayerId ||
        findLayer(document, command.fallbackLayerId) === undefined
      ) {
        throw new RangeError("Layer deletion requires another fallback layer.");
      }
      document.objects = document.objects.map((object) =>
        object.layerId === command.layerId
          ? setLayerRecursively(object, command.fallbackLayerId)
          : object,
      );
      document.layers = document.layers.filter(
        (layer) => layer.id !== command.layerId,
      );
      if (document.activeLayerId === command.layerId) {
        document.activeLayerId = command.fallbackLayerId;
      }
      break;
    }
    case "guide.add":
      assertFinite(command.guide.positionMm, "Guide position");
      if (document.guides.some((guide) => guide.id === command.guide.id)) {
        throw new RangeError("Guide IDs must be unique.");
      }
      document.guides.push({ ...command.guide });
      break;
    case "guide.move":
      assertFinite(command.positionMm, "Guide position");
      document.guides = document.guides.map((guide) =>
        guide.id === command.guideId
          ? { ...guide, positionMm: command.positionMm }
          : guide,
      );
      break;
    case "guide.delete":
      document.guides = document.guides.filter(
        (guide) => guide.id !== command.guideId,
      );
      break;
  }
  return document;
}

export function commandSelectionIds(
  command: EditorCommand,
): readonly string[] {
  switch (command.type) {
    case "objects.move":
    case "objects.set-bounds":
    case "objects.scale":
    case "objects.rotate":
    case "objects.mirror":
    case "objects.duplicate":
    case "objects.import":
    case "objects.convert-text":
    case "objects.delete":
    case "objects.align":
    case "objects.distribute":
    case "objects.group":
    case "objects.ungroup":
    case "objects.z-order":
      return command.type === "objects.import"
        ? command.objects.map((object) => object.id)
        : command.objectIds;
    case "template.upsert":
    case "template.delete":
      return [];
    case "objects.replace-topology":
      return command.sourceObjectIds;
    case "path.move-nodes":
    case "path.add-node":
    case "path.delete-nodes":
    case "path.set-handle":
    case "path.set-closed":
    case "path.reverse":
    case "path.simplify":
    case "path.cleanup":
    case "path.split":
      return [command.objectId];
    case "paths.join":
      return [command.firstObjectId, command.secondObjectId];
    default:
      return [];
  }
}
