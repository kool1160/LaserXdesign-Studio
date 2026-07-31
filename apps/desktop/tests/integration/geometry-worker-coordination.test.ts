import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createBlankProject, identityTransform, type LaserxProject } from "@laserx/domain";
import type {
  GeometryEngineTaskRequest,
  GeometryEngineTaskResult,
} from "@laserx/geometry";
import { afterEach, describe, expect, it } from "vitest";

import {
  DesktopController,
  type DesktopDialogs,
} from "../../electron/desktop-controller.js";
import {
  GeometryOperationCancelledError,
  type GeometryWorkerPort,
} from "../../electron/geometry-worker-service.js";

const PROJECT_PATH = "C:\\fixtures\\geometry.laserx";
const PATH_ONE = "50000000-0000-4000-8000-000000000001";
const PATH_TWO = "50000000-0000-4000-8000-000000000002";
const temporaryDirectories: string[] = [];
const controllers: DesktopController[] = [];

function project(): LaserxProject {
  const value = createBlankProject({
    id: "10000000-0000-4000-8000-000000000000",
    documentId: "20000000-0000-4000-8000-000000000000",
    now: "2026-07-31T10:00:00.000Z",
  });
  const layerId = value.document.activeLayerId;
  value.document.objects = [
    {
      id: PATH_ONE,
      type: "path",
      layerId,
      transform: identityTransform(),
      closed: true,
      points: [
        { xMm: 0, yMm: 0 },
        { xMm: 10, yMm: 0 },
        { xMm: 10, yMm: 10 },
        { xMm: 0, yMm: 10 },
      ],
    },
    {
      id: PATH_TWO,
      type: "path",
      layerId,
      transform: identityTransform(),
      closed: true,
      points: [
        { xMm: 5, yMm: 0 },
        { xMm: 15, yMm: 0 },
        { xMm: 15, yMm: 10 },
        { xMm: 5, yMm: 10 },
      ],
    },
  ];
  return value;
}

function dialogs(): DesktopDialogs {
  return {
    chooseOpenProject: () => Promise.resolve(PROJECT_PATH),
    chooseSaveProject: () => Promise.resolve(PROJECT_PATH),
    confirmUnsavedChanges: () => Promise.resolve("discard"),
  };
}

async function controller(worker: GeometryWorkerPort): Promise<DesktopController> {
  const directory = await mkdtemp(join(tmpdir(), "laserx-geometry-worker-"));
  temporaryDirectories.push(directory);
  const controller = new DesktopController({
    userDataPath: directory,
    dialogs: dialogs(),
    onStateChanged: () => undefined,
    projectStorage: {
      read: () => Promise.resolve(project()),
      write: () => Promise.resolve(),
    },
    geometryWorker: worker,
  });
  controllers.push(controller);
  await controller.initialize();
  await controller.openProject();
  await controller.editorAction({ type: "selection.all" });
  return controller;
}

afterEach(async () => {
  for (const controller of controllers.splice(0)) {
    controller.stop();
  }
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("geometry worker coordination", () => {
  it("terminates canceled work and leaves the document byte-identical", async () => {
    let started: (() => void) | null = null;
    const startedPromise = new Promise<void>((resolve) => {
      started = resolve;
    });
    const worker: GeometryWorkerPort = {
      run: (_request, signal) =>
        new Promise((_resolve, reject) => {
          started?.();
          signal.addEventListener(
            "abort",
            () => reject(new GeometryOperationCancelledError()),
            { once: true },
          );
        }),
    };
    const desktop = await controller(worker);
    const before = JSON.stringify(desktop.state.project.document);
    const operationId = "60000000-0000-4000-8000-000000000001";
    const running = desktop.geometryOperation({
      operationId,
      kind: "boolean",
      operation: "union",
    });
    await startedPromise;
    await desktop.cancelGeometryOperation(operationId);
    const result = await running;
    expect(result).toMatchObject({ ok: false });
    expect(JSON.stringify(desktop.state.project.document)).toBe(before);
    expect(desktop.state.editor.history.undoDepth).toBe(0);
  });

  it("applies a successful result once and undo restores exact geometry", async () => {
    const worker: GeometryWorkerPort = {
      run: (
        request: GeometryEngineTaskRequest,
      ): Promise<GeometryEngineTaskResult> =>
        Promise.resolve({
          operationId: request.operationId,
          contours: [
            {
              closed: true,
              points: [
                { xMm: 0, yMm: 0 },
                { xMm: 15, yMm: 0 },
                { xMm: 15, yMm: 10 },
                { xMm: 0, yMm: 10 },
              ],
            },
          ],
          warnings: [],
          elapsedMs: 2,
          engine: {
            adapter: "test-adapter",
            engine: "test-engine",
            version: "1",
            license: "test",
            coordinateScalePerMm: 1,
          },
        }),
    };
    const desktop = await controller(worker);
    const before = JSON.stringify(desktop.state.project.document);
    const result = await desktop.geometryOperation({
      operationId: "60000000-0000-4000-8000-000000000002",
      kind: "boolean",
      operation: "union",
    });
    expect(result.ok).toBe(true);
    expect(desktop.state.project.document.objects).toHaveLength(1);
    expect(desktop.state.editor.topologySummary).toMatchObject({
      operation: "Union",
      discardedObjectIds: [PATH_TWO],
    });
    await desktop.editorAction({ type: "history.undo" });
    expect(JSON.stringify(desktop.state.project.document)).toBe(before);
  });
});
