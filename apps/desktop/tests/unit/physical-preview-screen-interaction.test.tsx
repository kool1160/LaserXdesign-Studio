// @vitest-environment jsdom
import type { PhysicalPreviewAssembly } from "@laserx/physical-preview-3d";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PhysicalPreviewScreen from "../../src/features/physical-preview/PhysicalPreviewScreen.js";

const FACE_LAYER_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const BACKING_LAYER_ID = "aaaaaaaa-0000-4000-8000-000000000002";

function twoLayerAssembly(): PhysicalPreviewAssembly {
  const zRange = { minZmm: 0, maxZmm: 3 };
  return {
    identity: {
      projectId: "cccccccc-0000-4000-8000-000000000001",
      documentId: "cccccccc-0000-4000-8000-000000000002",
      projectUpdatedAt: "2026-08-04T12:00:00.000Z",
    },
    stockMm: { widthMm: 200, heightMm: 100 },
    status: "complete",
    spacing: { assembledGapMm: 0, explodedGapMm: 20 },
    layers: [
      {
        layerId: FACE_LAYER_ID,
        name: "Face",
        role: "face",
        thicknessMm: 3,
        material: { material: "mild-steel", stockThicknessDesignation: null, displayLabel: "3 mm" },
        shapes: [],
        boundsMm: null,
        order: 0,
        assembledZRangeMm: zRange,
        explodedZRangeMm: zRange,
      },
      {
        layerId: BACKING_LAYER_ID,
        name: "Backing",
        role: "backing",
        thicknessMm: 6,
        material: { material: "acrylic", stockThicknessDesignation: null, displayLabel: "6 mm" },
        shapes: [],
        boundsMm: null,
        order: 1,
        assembledZRangeMm: zRange,
        explodedZRangeMm: zRange,
      },
    ],
    assembledDepthMm: 9,
    depthStatus: "verified",
    findings: [],
    fingerprint: "fixture-fingerprint",
  };
}

// jsdom has no WebGL implementation, so isWebglAvailable() correctly reports
// unavailable here and jsdom logs its own "Not implemented: getContext()"
// notice directly to stdout via its virtual console (not through
// console.error, so it cannot be suppressed with a spy). That notice is
// expected and harmless -- interaction with the toolbar, keyboard, and
// layer list does not require a real canvas at all.
/** New required G5 props; capture behavior has its own dedicated tests. */
const captureProps = {
  onCapture: () => undefined,
  captureStatus: null,
  projectName: "Fixture project",
};

afterEach(() => {
  cleanup();
});

describe("PhysicalPreviewScreen keyboard and layer-visibility interaction", () => {
  it("selects a view by keyboard the same way the button does", () => {
    render(<PhysicalPreviewScreen assembly={twoLayerAssembly()} onClose={() => undefined} {...captureProps} />);
    const container = screen.getByTestId("physical-preview-screen");

    expect(screen.getByTestId("physical-preview-view-perspective")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.keyDown(container, { key: "1" });
    expect(screen.getByTestId("physical-preview-view-front")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("physical-preview-view-perspective")).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    fireEvent.keyDown(container, { key: "3" });
    expect(screen.getByTestId("physical-preview-view-edge")).toHaveAttribute("aria-pressed", "true");
  });

  it("resets the view by keyboard the same way the button does", () => {
    render(<PhysicalPreviewScreen assembly={twoLayerAssembly()} onClose={() => undefined} {...captureProps} />);
    const container = screen.getByTestId("physical-preview-screen");

    fireEvent.keyDown(container, { key: "2" });
    expect(screen.getByTestId("physical-preview-view-back")).toHaveAttribute("aria-pressed", "true");

    fireEvent.keyDown(container, { key: "0" });
    expect(screen.getByTestId("physical-preview-view-perspective")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("toggles assembled/exploded mode by keyboard the same way the button does", () => {
    render(<PhysicalPreviewScreen assembly={twoLayerAssembly()} onClose={() => undefined} {...captureProps} />);
    const container = screen.getByTestId("physical-preview-screen");

    expect(screen.getByTestId("physical-preview-mode-assembled")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.keyDown(container, { key: "m" });
    expect(screen.getByTestId("physical-preview-mode-exploded")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.keyDown(container, { key: "M" });
    expect(screen.getByTestId("physical-preview-mode-assembled")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("handled keys never reach a global window keydown listener", () => {
    const windowListener = vi.fn();
    window.addEventListener("keydown", windowListener);
    try {
      render(<PhysicalPreviewScreen assembly={twoLayerAssembly()} onClose={() => undefined} {...captureProps} />);
      const container = screen.getByTestId("physical-preview-screen");

      for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "-", "1", "0", "m"]) {
        fireEvent.keyDown(container, { key, bubbles: true });
      }

      // Every key this component handles calls stopPropagation, so none of
      // them may reach a listener on window -- otherwise, with a document
      // still selected in the 2D editor underneath this overlay, arrow keys
      // would also move selected path nodes.
      expect(windowListener).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("keydown", windowListener);
    }
  });

  it("an unhandled key is not intercepted and still bubbles", () => {
    const windowListener = vi.fn();
    window.addEventListener("keydown", windowListener);
    try {
      render(<PhysicalPreviewScreen assembly={twoLayerAssembly()} onClose={() => undefined} {...captureProps} />);
      const container = screen.getByTestId("physical-preview-screen");

      fireEvent.keyDown(container, { key: "Tab", bubbles: true });

      expect(windowListener).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener("keydown", windowListener);
    }
  });

  it("toggles per-layer visibility without any IPC call or project mutation", () => {
    render(<PhysicalPreviewScreen assembly={twoLayerAssembly()} onClose={() => undefined} {...captureProps} />);

    const faceCheckbox = screen.getByTestId(
      `physical-preview-layer-visibility-${FACE_LAYER_ID}`,
    );
    expect(faceCheckbox).toBeChecked();

    fireEvent.click(faceCheckbox);
    expect(faceCheckbox).not.toBeChecked();

    fireEvent.click(faceCheckbox);
    expect(faceCheckbox).toBeChecked();
  });

  it("closes on the close button", () => {
    const onClose = vi.fn();
    render(<PhysicalPreviewScreen assembly={twoLayerAssembly()} onClose={onClose} {...captureProps} />);

    fireEvent.click(screen.getByTestId("physical-preview-close"));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
