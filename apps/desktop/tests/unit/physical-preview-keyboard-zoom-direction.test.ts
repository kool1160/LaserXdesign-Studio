import { PerspectiveCamera } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { describe, expect, it } from "vitest";

import { KEYBOARD_ZOOM_SCALE } from "../../src/features/physical-preview/PhysicalPreviewScreen.js";

/**
 * Exercises the exact production constant against real OrbitControls math
 * (no mocking, no WebGL/canvas needed -- dollyIn/dollyOut/update are pure
 * camera math). Repairs a finding where `+` and `-` were reversed: the
 * scale factor must be below 1 for dollyIn to move the camera closer,
 * matching the real mouse-wheel handler's own convention.
 */
describe("physical preview keyboard zoom direction", () => {
  it("dollyIn(KEYBOARD_ZOOM_SCALE) moves the camera closer to the target", () => {
    const camera = new PerspectiveCamera(45, 1, 0.1, 1_000);
    camera.position.set(0, 0, 100);
    const controls = new OrbitControls(camera);
    controls.target.set(0, 0, 0);
    controls.update();

    const initialDistance = controls.getDistance();
    controls.dollyIn(KEYBOARD_ZOOM_SCALE);
    controls.update();

    expect(controls.getDistance()).toBeLessThan(initialDistance);
  });

  it("dollyOut(KEYBOARD_ZOOM_SCALE) moves the camera farther from the target", () => {
    const camera = new PerspectiveCamera(45, 1, 0.1, 1_000);
    camera.position.set(0, 0, 100);
    const controls = new OrbitControls(camera);
    controls.target.set(0, 0, 0);
    controls.update();

    const initialDistance = controls.getDistance();
    controls.dollyOut(KEYBOARD_ZOOM_SCALE);
    controls.update();

    expect(controls.getDistance()).toBeGreaterThan(initialDistance);
  });

  it("would have failed with the reverted factor above 1", () => {
    const camera = new PerspectiveCamera(45, 1, 0.1, 1_000);
    camera.position.set(0, 0, 100);
    const controls = new OrbitControls(camera);
    controls.target.set(0, 0, 0);
    controls.update();

    const initialDistance = controls.getDistance();
    const revertedScale = 1.1;
    controls.dollyIn(revertedScale);
    controls.update();

    // Proves this test suite actually catches the reported regression: with
    // the reverted (>1) scale, "dollyIn" incorrectly moves the camera
    // farther away instead of closer.
    expect(controls.getDistance()).toBeGreaterThan(initialDistance);
  });
});
