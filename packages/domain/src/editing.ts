import {
  IDENTITY_AFFINE_TRANSFORM,
  boundsCenter,
  boundsHeight,
  boundsWidth,
  composeAffineTransforms,
  rotationTransformAt,
  scaleTransformAt,
  translationTransform,
  type AffineTransformMm,
  type BoundsMm,
  type PointMm,
} from "@laserx/geometry";

import {
  collectObjectIds,
  copyDocument,
  copyDocumentObject,
  findLayer,
  getObjectBounds,
  getSelectionBounds,
  isLayerEditable,
  objectUsesLayerRecursively,
  type DocumentObject,
  type Guide,
  type LaserxDocument,
  type Layer,
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
): number {
  let adjustment = 0;
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
): number {
  let adjustment = 0;
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
    if (Math.abs(gridX) < Math.abs(adjustX) || adjustX === 0) {
      adjustX = gridX;
    }
    if (Math.abs(gridY) < Math.abs(adjustY) || adjustY === 0) {
      adjustY = gridY;
    }
  }
  return {
    deltaXmm: requestedDelta.deltaXmm + adjustX,
    deltaYmm: requestedDelta.deltaYmm + adjustY,
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
    case "objects.delete":
    case "objects.align":
    case "objects.distribute":
    case "objects.group":
    case "objects.ungroup":
    case "objects.z-order":
      return command.objectIds;
    default:
      return [];
  }
}
