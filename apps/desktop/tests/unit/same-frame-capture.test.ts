import { describe, expect, it } from "vitest";

import {
  captureSameFrame,
  SameFrameCaptureError,
  type SameFrameCaptureSource,
} from "../../src/features/physical-preview/sameFrameCapture.js";

const PNG_PREFIX = "data:image/png;base64,";

interface RecordingSource extends SameFrameCaptureSource {
  readonly calls: string[];
}

function recordingSource(
  overrides: Partial<SameFrameCaptureSource> & { widthPx?: number; heightPx?: number } = {},
): RecordingSource {
  const widthPx = overrides.widthPx ?? 4;
  const heightPx = overrides.heightPx ?? 2;
  const calls: string[] = [];
  return {
    calls,
    widthPx,
    heightPx,
    renderFrame:
      overrides.renderFrame ??
      (() => {
        calls.push("renderFrame");
      }),
    readPixels:
      overrides.readPixels ??
      (() => {
        calls.push("readPixels");
        return new Uint8Array(widthPx * heightPx * 4);
      }),
    toDataURL:
      overrides.toDataURL ??
      (() => {
        calls.push("toDataURL");
        return `${PNG_PREFIX}aGVsbG8=`;
      }),
  };
}

describe("captureSameFrame", () => {
  it("renders exactly once, then reads pixels and encodes from that same frame in order", () => {
    const source = recordingSource();

    const capture = captureSameFrame(source);

    // The ordering is the whole point: both reads must follow one render,
    // with no second render able to replace the buffer between them.
    expect(source.calls).toEqual(["renderFrame", "readPixels", "toDataURL"]);
    expect(source.calls.filter((call) => call === "renderFrame")).toHaveLength(1);
    expect(capture).toMatchObject({ widthPx: 4, heightPx: 2 });
    expect(capture.rgba).toHaveLength(4 * 2 * 4);
  });

  it("rejects a zero-sized buffer before rendering or reading anything", () => {
    const source = recordingSource({ widthPx: 0 });

    expect(() => captureSameFrame(source)).toThrow(SameFrameCaptureError);
    expect(source.calls).toEqual([]);
  });

  it("rejects a pixel buffer whose length disagrees with the frame dimensions", () => {
    const source = recordingSource({
      readPixels: () => new Uint8Array(8),
    });

    expect(() => captureSameFrame(source)).toThrow(/expected 32/u);
  });

  it("rejects output that is not a PNG data URL", () => {
    const source = recordingSource({
      toDataURL: () => "data:image/jpeg;base64,aGVsbG8=",
    });

    expect(() => captureSameFrame(source)).toThrow(/did not produce PNG image data/u);
  });

  it("rejects the empty data URL a blank or lost canvas produces", () => {
    const source = recordingSource({ toDataURL: () => "data:," });

    expect(() => captureSameFrame(source)).toThrow(/did not produce PNG image data/u);
  });
});
