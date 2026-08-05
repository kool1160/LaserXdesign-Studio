import { deflateSync } from "node:zlib";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createBlankProject,
  identityTransform,
  type LaserxProject,
  type Layer,
} from "@laserx/domain";
import { afterEach, describe, expect, it } from "vitest";

import {
  DesktopController,
  type DesktopDialogs,
} from "../../electron/desktop-controller.js";
import {
  runPhysicalPreviewTask,
  type PhysicalPreviewTaskRequest,
  type PhysicalPreviewTaskResult,
} from "../../../../packages/physical-preview-3d/src/task.js";
import type { PhysicalPreviewWorkerPort } from "../../electron/physical-preview-worker-service.js";
import { MAX_CAPTURE_BYTES } from "../../electron/capture-limits.js";

const OPERATION_ID = "a0000000-0000-4000-8000-000000000001";
const FACE_LAYER_ID = "b0000000-0000-4000-8000-000000000001";
const RECT_ID = "c0000000-0000-4000-8000-000000000001";
const CAPTURE_WIDTH = 8;
const CAPTURE_HEIGHT = 4;

const temporaryDirectories: string[] = [];
const controllers: DesktopController[] = [];

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

/** A genuinely well-formed PNG, so tests exercise real header validation. */
function realPngBase64(widthPx = CAPTURE_WIDTH, heightPx = CAPTURE_HEIGHT): string {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(widthPx, 0);
  ihdrData.writeUInt32BE(heightPx, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // RGBA
  const raw = Buffer.alloc(heightPx * (1 + widthPx * 4));
  for (let row = 0; row < heightPx; row += 1) {
    raw[row * (1 + widthPx * 4)] = 0; // filter: none
  }
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdrData),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]).toString("base64");
}

/** Signature + a well-formed IHDR only: passes a header-only check, but has
 * no IDAT and no terminal IEND. */
function headerOnlyBase64(): string {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(CAPTURE_WIDTH, 0);
  ihdrData.writeUInt32BE(CAPTURE_HEIGHT, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdrData),
    Buffer.alloc(64), // padding so it clears the minimum-size check
  ]).toString("base64");
}

/** A real PNG with its final bytes removed: framing no longer terminates. */
function truncatedBase64(): string {
  const full = Buffer.from(realPngBase64(), "base64");
  return full.subarray(0, full.length - 12).toString("base64");
}

/** A real PNG with one IDAT payload byte flipped, invalidating its CRC. */
function corruptedCrcBase64(): string {
  const full = Buffer.from(realPngBase64(), "base64");
  // 8 signature + 25 IHDR chunk = first byte of the IDAT chunk header; step
  // into its data region and flip a bit.
  const idatDataStart = 8 + 25 + 8;
  full[idatDataStart] = (full[idatDataStart] ?? 0) ^ 0xff;
  return full.toString("base64");
}

/** IHDR with a CRC-correct but wrong-length payload. readPngHeader would
 * still read its first 8 data bytes as "dimensions". */
function badIhdrLengthBase64(): string {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(20); // valid PNG requires exactly 13
  ihdrData.writeUInt32BE(CAPTURE_WIDTH, 0);
  ihdrData.writeUInt32BE(CAPTURE_HEIGHT, 4);
  const raw = Buffer.alloc(CAPTURE_HEIGHT * (1 + CAPTURE_WIDTH * 4));
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdrData),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]).toString("base64");
}

/** A second, fully valid IHDR chunk inserted after the first. */
function duplicateIhdrBase64(): string {
  const full = Buffer.from(realPngBase64(), "base64");
  const ihdrChunk = full.subarray(8, 8 + 25);
  return Buffer.concat([
    full.subarray(0, 8 + 25),
    ihdrChunk,
    full.subarray(8 + 25),
  ]).toString("base64");
}

/** IEND carrying data, which a conforming terminator never does. */
function nonEmptyIendBase64(): string {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(CAPTURE_WIDTH, 0);
  ihdrData.writeUInt32BE(CAPTURE_HEIGHT, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  const raw = Buffer.alloc(CAPTURE_HEIGHT * (1 + CAPTURE_WIDTH * 4));
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdrData),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.from("nope", "ascii")),
  ]).toString("base64");
}

/** Only the 8-byte signature plus padding: structurally not a PNG. */
function signatureOnlyBase64(): string {
  const bytes = Buffer.alloc(128);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
  return bytes.toString("base64");
}

function physicalProject(): LaserxProject {
  const layer: Layer = {
    id: FACE_LAYER_ID,
    name: "Face",
    visible: true,
    locked: false,
    manufacturing: {
      role: "face",
      material: "mild-steel",
      thicknessMm: 3,
      stockThicknessDesignation: null,
      process: "laser",
      notes: "",
      registrationGroup: null,
      registrationHoleIds: [],
    },
  };
  return createBlankProject({
    id: "aaaaaaaa-0000-4000-8000-000000000001",
    documentId: "aaaaaaaa-0000-4000-8000-000000000002",
    now: "2026-08-05T12:00:00.000Z",
    width: 200,
    height: 100,
    layers: [layer],
    activeLayerId: FACE_LAYER_ID,
    objects: [
      {
        id: RECT_ID,
        type: "rectangle",
        layerId: FACE_LAYER_ID,
        transform: identityTransform(),
        origin: { xMm: 10, yMm: 10 },
        widthMm: 80,
        heightMm: 40,
      },
    ],
  });
}

const immediateWorker: PhysicalPreviewWorkerPort = {
  run: (request: PhysicalPreviewTaskRequest): Promise<PhysicalPreviewTaskResult> =>
    Promise.resolve(runPhysicalPreviewTask(request)),
};

interface Harness {
  controller: DesktopController;
  directory: string;
  chosenPaths: string[];
  fingerprint: string;
}

async function desktop(
  choose: (directory: string, suggested: string) => string | null,
): Promise<Harness> {
  const directory = await mkdtemp(join(tmpdir(), "laserx-capture-ipc-"));
  temporaryDirectories.push(directory);
  const chosenPaths: string[] = [];
  const dialogs: DesktopDialogs = {
    chooseOpenProject: () => Promise.resolve(join(directory, "p.laserx")),
    chooseSaveProject: () => Promise.resolve(null),
    confirmUnsavedChanges: () => Promise.resolve("discard"),
    choosePreviewCapturePath: (suggested) => {
      const chosen = choose(directory, suggested);
      if (chosen !== null) chosenPaths.push(chosen);
      return Promise.resolve(chosen);
    },
  };
  const controller = new DesktopController({
    userDataPath: directory,
    dialogs,
    onStateChanged: () => undefined,
    projectStorage: {
      read: () => Promise.resolve(physicalProject()),
      write: () => Promise.resolve(),
    },
    physicalPreviewWorker: immediateWorker,
  });
  controllers.push(controller);
  await controller.initialize();
  await controller.openProject();
  await controller.runPhysicalPreview(OPERATION_ID);
  const fingerprint = controller.state.physicalPreview.assembly?.fingerprint;
  if (fingerprint === undefined) throw new Error("Expected a built preview assembly.");
  return { controller, directory, chosenPaths, fingerprint };
}

function request(harness: Harness, overrides: Record<string, unknown> = {}) {
  return {
    filename: "laserx-preview-fixture-front-assembled.png",
    pngBase64: realPngBase64(),
    overwrite: true,
    widthPx: CAPTURE_WIDTH,
    heightPx: CAPTURE_HEIGHT,
    assemblyFingerprint: harness.fingerprint,
    ...overrides,
  } as Parameters<DesktopController["savePhysicalPreviewCapture"]>[0];
}

afterEach(async () => {
  for (const controller of controllers.splice(0)) controller.stop();
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("privileged physical preview capture save", () => {
  it("writes a valid capture to the chosen path and reports it saved", async () => {
    const harness = await desktop((directory, suggested) => join(directory, suggested));

    const result = await harness.controller.savePhysicalPreviewCapture(request(harness));

    expect(result).toMatchObject({ ok: true });
    expect(harness.controller.state.physicalPreview.capture).toMatchObject({
      status: "saved",
      error: null,
    });
    const written = await readFile(
      join(harness.directory, "laserx-preview-fixture-front-assembled.png"),
    );
    expect(written.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  it("rejects a signature-only payload without prompting or writing", async () => {
    const harness = await desktop((directory, suggested) => join(directory, suggested));

    await harness.controller.savePhysicalPreviewCapture(
      request(harness, { pngBase64: signatureOnlyBase64() }),
    );

    expect(harness.controller.state.physicalPreview.capture).toMatchObject({
      status: "failed",
      targetPath: null,
    });
    // The save dialog must never have opened for invalid evidence.
    expect(harness.chosenPaths).toEqual([]);
    expect(await readdir(harness.directory)).not.toContain(
      "laserx-preview-fixture-front-assembled.png",
    );
  });

  it("rejects a capture whose claimed dimensions disagree with its IHDR", async () => {
    const harness = await desktop((directory, suggested) => join(directory, suggested));

    await harness.controller.savePhysicalPreviewCapture(
      request(harness, { widthPx: CAPTURE_WIDTH + 1 }),
    );

    expect(harness.controller.state.physicalPreview.capture?.status).toBe("failed");
    expect(harness.controller.state.physicalPreview.capture?.error).toMatch(
      /dimensions did not match/u,
    );
    expect(harness.chosenPaths).toEqual([]);
  });

  it("rejects a capture bound to a stale assembly fingerprint", async () => {
    const harness = await desktop((directory, suggested) => join(directory, suggested));

    await harness.controller.savePhysicalPreviewCapture(
      request(harness, { assemblyFingerprint: "stale-fingerprint" }),
    );

    expect(harness.controller.state.physicalPreview.capture?.status).toBe("failed");
    expect(harness.controller.state.physicalPreview.capture?.error).toMatch(
      /no longer matches the current physical preview/u,
    );
    expect(harness.chosenPaths).toEqual([]);
  });

  it("rejects a capture after the physical content changed underneath it", async () => {
    const harness = await desktop((directory, suggested) => join(directory, suggested));
    const staleFingerprint = harness.fingerprint;

    // A real physical edit invalidates the displayed assembly, so a capture
    // taken before it no longer depicts the current document.
    await harness.controller.editorAction({
      type: "objects.move",
      objectIds: [RECT_ID],
      deltaXmm: 15,
      deltaYmm: 0,
    });

    await harness.controller.savePhysicalPreviewCapture(
      request(harness, { assemblyFingerprint: staleFingerprint }),
    );

    expect(harness.controller.state.physicalPreview.capture?.status).toBe("failed");
    expect(harness.chosenPaths).toEqual([]);
  });

  it("rejects malformed base64 before anything reaches the filesystem", async () => {
    const harness = await desktop((directory, suggested) => join(directory, suggested));

    await harness.controller.savePhysicalPreviewCapture(
      request(harness, { pngBase64: "!!!!not-base64!!!!" }),
    );

    expect(harness.controller.state.physicalPreview.capture?.status).toBe("failed");
    expect(harness.chosenPaths).toEqual([]);
  });

  it("rejects a header-only PNG with no IDAT or IEND without prompting or writing", async () => {
    const harness = await desktop((directory, suggested) => join(directory, suggested));

    await harness.controller.savePhysicalPreviewCapture(
      request(harness, { pngBase64: headerOnlyBase64() }),
    );

    expect(harness.controller.state.physicalPreview.capture?.status).toBe("failed");
    expect(harness.controller.state.physicalPreview.capture?.error).toMatch(
      /complete, valid PNG/u,
    );
    expect(harness.chosenPaths).toEqual([]);
    expect(await readdir(harness.directory)).not.toContain(
      "laserx-preview-fixture-front-assembled.png",
    );
  });

  it("rejects a truncated PNG without prompting or writing", async () => {
    const harness = await desktop((directory, suggested) => join(directory, suggested));

    await harness.controller.savePhysicalPreviewCapture(
      request(harness, { pngBase64: truncatedBase64() }),
    );

    expect(harness.controller.state.physicalPreview.capture?.status).toBe("failed");
    expect(harness.chosenPaths).toEqual([]);
    expect((await readdir(harness.directory)).filter((n) => n.endsWith(".png"))).toEqual([]);
  });

  it("rejects a PNG whose chunk CRC no longer matches its data", async () => {
    const harness = await desktop((directory, suggested) => join(directory, suggested));

    await harness.controller.savePhysicalPreviewCapture(
      request(harness, { pngBase64: corruptedCrcBase64() }),
    );

    expect(harness.controller.state.physicalPreview.capture?.status).toBe("failed");
    expect(harness.controller.state.physicalPreview.capture?.error).toMatch(
      /bad-chunk-crc/u,
    );
    expect(harness.chosenPaths).toEqual([]);
  });

  it("rejects a CRC-correct IHDR whose length is not exactly 13 bytes", async () => {
    const harness = await desktop((directory, suggested) => join(directory, suggested));

    await harness.controller.savePhysicalPreviewCapture(
      request(harness, { pngBase64: badIhdrLengthBase64() }),
    );

    expect(harness.controller.state.physicalPreview.capture?.error).toMatch(
      /bad-ihdr-length/u,
    );
    expect(harness.chosenPaths).toEqual([]);
    expect((await readdir(harness.directory)).filter((n) => n.endsWith(".png"))).toEqual([]);
  });

  it("rejects a duplicate IHDR chunk", async () => {
    const harness = await desktop((directory, suggested) => join(directory, suggested));

    await harness.controller.savePhysicalPreviewCapture(
      request(harness, { pngBase64: duplicateIhdrBase64() }),
    );

    expect(harness.controller.state.physicalPreview.capture?.error).toMatch(
      /duplicate-ihdr/u,
    );
    expect(harness.chosenPaths).toEqual([]);
  });

  it("rejects an IEND chunk carrying data", async () => {
    const harness = await desktop((directory, suggested) => join(directory, suggested));

    await harness.controller.savePhysicalPreviewCapture(
      request(harness, { pngBase64: nonEmptyIendBase64() }),
    );

    expect(harness.controller.state.physicalPreview.capture?.error).toMatch(
      /bad-iend-length/u,
    );
    expect(harness.chosenPaths).toEqual([]);
  });

  it("rejects decoded bytes above the shared size limit before prompting", async () => {
    const harness = await desktop((directory, suggested) => join(directory, suggested));
    // Just over the writer's own ceiling: the point is that the controller
    // refuses it before a dialog, not that the writer refuses it after one.
    const oversized = Buffer.alloc(MAX_CAPTURE_BYTES + 1).toString("base64");

    await harness.controller.savePhysicalPreviewCapture(
      request(harness, { pngBase64: oversized }),
    );

    expect(harness.controller.state.physicalPreview.capture?.status).toBe("failed");
    expect(harness.controller.state.physicalPreview.capture?.error).toMatch(
      /64 MB safety limit/u,
    );
    expect(harness.chosenPaths).toEqual([]);
    expect((await readdir(harness.directory)).filter((n) => n.endsWith(".png"))).toEqual([]);
  });

  it("treats a canceled save dialog as a clean no-op that writes nothing", async () => {
    const harness = await desktop(() => null);

    const result = await harness.controller.savePhysicalPreviewCapture(request(harness));

    expect(result).toMatchObject({ ok: true });
    expect(harness.controller.state.physicalPreview.capture).toMatchObject({
      status: "canceled",
      targetPath: null,
      error: null,
    });
    expect(await readdir(harness.directory)).not.toContain(
      "laserx-preview-fixture-front-assembled.png",
    );
  });

  it("reports an explicit failure when the destination cannot be written", async () => {
    const harness = await desktop((directory) => join(directory, "missing", "capture.png"));

    await harness.controller.savePhysicalPreviewCapture(request(harness));

    expect(harness.controller.state.physicalPreview.capture?.status).toBe("failed");
    expect(harness.controller.state.physicalPreview.capture?.error).toMatch(
      /could not be saved/u,
    );
  });

  it("never mutates the document, dirty flag, history, selection, or export surfaces", async () => {
    const harness = await desktop((directory, suggested) => join(directory, suggested));
    const beforeDocument = JSON.stringify(harness.controller.state.project.document);
    const beforeDirty = harness.controller.state.dirty;
    const beforeUndoDepth = harness.controller.state.editor.history.undoDepth;
    const beforeSelection = harness.controller.state.editor.selectionIds;

    await harness.controller.savePhysicalPreviewCapture(request(harness));

    expect(JSON.stringify(harness.controller.state.project.document)).toBe(beforeDocument);
    expect(harness.controller.state.dirty).toBe(beforeDirty);
    expect(harness.controller.state.editor.history.undoDepth).toBe(beforeUndoDepth);
    expect(harness.controller.state.editor.selectionIds).toEqual(beforeSelection);
    expect(harness.controller.state.analysis.cutability).toBeNull();
    expect(harness.controller.state.production.exportSummary).toBeNull();
    expect(harness.controller.state.interchange.exportSummary).toBeNull();
  });

  it("clears the capture result when a different project is opened", async () => {
    const harness = await desktop((directory, suggested) => join(directory, suggested));
    await harness.controller.savePhysicalPreviewCapture(request(harness));
    expect(harness.controller.state.physicalPreview.capture).not.toBeNull();

    await harness.controller.newProject();

    expect(harness.controller.state.physicalPreview.capture).toBeNull();
  });
});
