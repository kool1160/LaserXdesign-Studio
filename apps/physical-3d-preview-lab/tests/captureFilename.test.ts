import { describe, expect, it } from "vitest";

import { buildCaptureFilename } from "../src/captureFilename";

describe("buildCaptureFilename", () => {
  it("is deterministic for the same project/view/mode", () => {
    const input = { projectName: "Two Layer Face and Backing", view: "front", mode: "assembled" } as const;
    expect(buildCaptureFilename(input)).toBe(buildCaptureFilename(input));
  });

  it("produces a stable, filesystem-safe slug from the project name", () => {
    expect(
      buildCaptureFilename({
        projectName: "Two Layer Face and Backing",
        view: "front",
        mode: "assembled",
      }),
    ).toBe("laserx-preview-two-layer-face-and-backing-front-assembled.png");
  });

  it("differs per view and per mode", () => {
    const base = { projectName: "Face Plate", view: "front", mode: "assembled" } as const;
    expect(buildCaptureFilename(base)).not.toBe(
      buildCaptureFilename({ ...base, view: "back" }),
    );
    expect(buildCaptureFilename(base)).not.toBe(
      buildCaptureFilename({ ...base, mode: "exploded" }),
    );
  });

  it("falls back to a safe default for a name with no usable characters", () => {
    expect(
      buildCaptureFilename({ projectName: "!!!", view: "edge", mode: "exploded" }),
    ).toBe("laserx-preview-project-edge-exploded.png");
  });

  it("contains no path separators or spaces", () => {
    const filename = buildCaptureFilename({
      projectName: "Weird / Name\\With Slashes",
      view: "perspective",
      mode: "exploded",
    });
    expect(filename).not.toMatch(/[/\\ ]/u);
  });
});
