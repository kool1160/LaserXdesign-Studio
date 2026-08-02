import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { analyzeDocumentCutability } from "@laserx/cutability";
import { afterEach, describe, expect, it } from "vitest";

import type { CutabilityWorkerPort } from "../../electron/cutability-worker-service.js";
import {
  DesktopController,
  type DesktopDialogs,
} from "../../electron/desktop-controller.js";
import type {
  VectorFileFormat,
  VectorFileService,
} from "../../electron/vector-storage.js";

const temporaryDirectories: string[] = [];
const controllers: DesktopController[] = [];
const cutabilityWorker: CutabilityWorkerPort = {
  run: (request) => Promise.resolve(analyzeDocumentCutability(
    request.document,
    { operationId: request.operationId, objectIds: request.objectIds },
  )),
};

class MemoryVectorStorage implements VectorFileService {
  public readonly writes: Array<{
    filePath: string;
    contents: string;
    format: VectorFileFormat;
  }> = [];

  public constructor(private readonly source: string) {}

  public read(): Promise<string> {
    return Promise.resolve(this.source);
  }

  public write(
    filePath: string,
    contents: string,
    format: VectorFileFormat,
  ): Promise<void> {
    this.writes.push({ filePath, contents, format });
    return Promise.resolve();
  }
}

afterEach(async () => {
  for (const controller of controllers.splice(0)) controller.stop();
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("desktop vector interchange", () => {
  it("keeps preview non-destructive and commits it as one undoable edit", async () => {
    const directory = await mkdtemp(join(tmpdir(), "laserx-vector-"));
    temporaryDirectories.push(directory);
    const source = `<svg width="600mm" height="300mm" viewBox="0 0 600 300"><g data-layer="Cut"><polygon points="0,0 600,0 600,300"/></g></svg>`;
    const storage = new MemoryVectorStorage(source);
    const dialogs: DesktopDialogs = {
      chooseOpenProject: () => Promise.resolve(null),
      chooseSaveProject: () => Promise.resolve(null),
      confirmUnsavedChanges: () => Promise.resolve("discard"),
      chooseImportVector: () => Promise.resolve(join(directory, "sign.svg")),
      chooseExportVector: (_format, suggestedName) => Promise.resolve(join(directory, suggestedName)),
    };
    const controller = new DesktopController({
      userDataPath: join(directory, "user-data"),
      dialogs,
      vectorStorage: storage,
      cutabilityWorker,
      onStateChanged: () => undefined,
    });
    controllers.push(controller);
    await controller.initialize();
    await controller.runCutabilityAnalysis(
      "60000000-0000-4000-8000-000000000070",
      [],
    );
    expect(controller.state.analysis.cutability).not.toBeNull();

    const previewResult = await controller.previewVectorImport({ unitlessDxfUnit: "millimeters" });
    expect(previewResult.ok).toBe(true);
    expect(controller.state.dirty).toBe(false);
    expect(controller.state.project.document.objects).toHaveLength(0);
    expect(controller.state.editor.importPreview).toMatchObject({ format: "svg", sourceName: "sign.svg" });
    expect(controller.state.editor.importPreview?.fitMode).toBe("resize-stock");
    expect(await controller.configureVectorImport({
      fitMode: "scale-artwork",
      marginMm: 10,
    })).toMatchObject({ ok: true });
    expect(controller.state.editor.importPreview).toMatchObject({
      fitMode: "scale-artwork",
      proposedDocumentDimensionsMm: controller.state.project.document.dimensions,
    });

    await controller.commitVectorImport();
    expect(controller.state.editor.importPreview).toBeNull();
    expect(controller.state.project.document.objects).toHaveLength(1);
    expect(controller.state.editor.history.undoDepth).toBe(1);
    expect(controller.state.analysis.cutability).toBeNull();

    await controller.editorAction({ type: "history.undo" });
    expect(controller.state.project.document.objects).toHaveLength(0);
  });

  it("exports without changing project history and reports units, bounds, and warnings", async () => {
    const directory = await mkdtemp(join(tmpdir(), "laserx-vector-"));
    temporaryDirectories.push(directory);
    const storage = new MemoryVectorStorage("");
    const dialogs: DesktopDialogs = {
      chooseOpenProject: () => Promise.resolve(null),
      chooseSaveProject: () => Promise.resolve(null),
      confirmUnsavedChanges: () => Promise.resolve("discard"),
      chooseImportVector: () => Promise.resolve(null),
      chooseExportVector: (format) => Promise.resolve(join(directory, `sign.${format}`)),
    };
    const controller = new DesktopController({
      userDataPath: join(directory, "user-data"),
      dialogs,
      vectorStorage: storage,
      onStateChanged: () => undefined,
    });
    controllers.push(controller);
    await controller.initialize();
    await controller.editorAction({ type: "object.create", objectType: "line" });
    const historyBefore = controller.state.editor.history.undoDepth;

    const result = await controller.exportVector({ format: "dxf" });
    expect(result.ok).toBe(true);
    expect(storage.writes[0]).toMatchObject({ format: "dxf" });
    expect(storage.writes[0]?.contents).toContain("$INSUNITS\n70\n4\n");
    expect(controller.state.editor.history.undoDepth).toBe(historyBefore);
    expect(controller.state.interchange.exportSummary).toMatchObject({
      format: "dxf",
      objectCount: 1,
      warningCount: 0,
      units: "millimeters",
    });
  });
});
