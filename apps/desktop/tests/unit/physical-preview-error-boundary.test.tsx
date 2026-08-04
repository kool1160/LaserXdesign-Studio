// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { lazy, Suspense } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PhysicalPreviewErrorBoundary } from "../../src/features/physical-preview/PhysicalPreviewErrorBoundary.js";

afterEach(() => {
  cleanup();
});

describe("PhysicalPreviewErrorBoundary", () => {
  it("catches a rejected lazy chunk without unmounting sibling app content", async () => {
    // Suspense catches a *pending* dynamic import, never a *rejected* one --
    // this simulates exactly the failure mode the finding names: a missing
    // or corrupt preview chunk.
    const FailingLazy = lazy(() =>
      Promise.reject(new Error("Simulated preview chunk fetch failure.")),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const onClose = vi.fn();

    render(
      <div>
        <div data-testid="sibling-app-content">Still editing in 2D</div>
        <PhysicalPreviewErrorBoundary onClose={onClose}>
          <Suspense fallback={<div>Loading…</div>}>
            <FailingLazy />
          </Suspense>
        </PhysicalPreviewErrorBoundary>
      </div>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId("physical-preview-crashed")).not.toBeNull();
    });

    // The failure must stay local to the preview subtree -- the rest of the
    // app (here represented by the sibling element) must remain mounted and
    // untouched, unlike an uncaught error reaching the app's root boundary.
    expect(screen.queryByTestId("sibling-app-content")).not.toBeNull();

    screen.getByRole("button", { name: "Close preview" }).click();
    expect(onClose).toHaveBeenCalledOnce();

    consoleError.mockRestore();
  });

  it("renders children normally when nothing fails", () => {
    render(
      <PhysicalPreviewErrorBoundary onClose={() => undefined}>
        <div data-testid="preview-content">3D scene</div>
      </PhysicalPreviewErrorBoundary>,
    );

    expect(screen.queryByTestId("preview-content")).not.toBeNull();
    expect(screen.queryByTestId("physical-preview-crashed")).toBeNull();
  });

  it("catches a runtime render error from the wrapped scene without unmounting sibling app content", () => {
    function ThrowingScene(): never {
      throw new Error("Simulated Three.js render failure.");
    }
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const onClose = vi.fn();

    render(
      <div>
        <div data-testid="sibling-app-content">Still editing in 2D</div>
        <PhysicalPreviewErrorBoundary onClose={onClose}>
          <ThrowingScene />
        </PhysicalPreviewErrorBoundary>
      </div>,
    );

    expect(screen.queryByTestId("physical-preview-crashed")).not.toBeNull();
    expect(screen.queryByTestId("sibling-app-content")).not.toBeNull();

    consoleError.mockRestore();
  });
});
