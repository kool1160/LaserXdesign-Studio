import { describe, expect, it } from "vitest";

import { computeCameraPose, PREVIEW_VIEWS } from "../src/cameraPose";

const TARGET: readonly [number, number, number] = [10, 20, 5];
const DISTANCE = 100;

describe("computeCameraPose", () => {
  it("front: positions the camera directly on +Z from the target, up +Y", () => {
    expect(computeCameraPose("front", TARGET, DISTANCE)).toEqual({
      position: [10, 20, 105],
      up: [0, 1, 0],
    });
  });

  it("back: positions the camera directly on -Z from the target, up +Y", () => {
    expect(computeCameraPose("back", TARGET, DISTANCE)).toEqual({
      position: [10, 20, -95],
      up: [0, 1, 0],
    });
  });

  it("edge: positions the camera on +X from the target, showing the stack side-on", () => {
    expect(computeCameraPose("edge", TARGET, DISTANCE)).toEqual({
      position: [110, 20, 5],
      up: [0, 1, 0],
    });
  });

  it("perspective: positions the camera on all three axes for an angled 3/4 view", () => {
    expect(computeCameraPose("perspective", TARGET, DISTANCE)).toEqual({
      position: [80, 75, 95],
      up: [0, 1, 0],
    });
  });

  it("is deterministic and pure — repeated calls with the same input produce equal output", () => {
    const first = computeCameraPose("perspective", TARGET, DISTANCE);
    const second = computeCameraPose("perspective", TARGET, DISTANCE);
    expect(second).toEqual(first);
  });

  it("produces a distinct camera position for every view", () => {
    const positions = PREVIEW_VIEWS.map((view) =>
      computeCameraPose(view, TARGET, DISTANCE).position.join(","),
    );
    expect(new Set(positions).size).toBe(PREVIEW_VIEWS.length);
  });

  it("front and back are mirrored across the target on the Z axis", () => {
    const front = computeCameraPose("front", TARGET, DISTANCE);
    const back = computeCameraPose("back", TARGET, DISTANCE);
    expect(front.position[2] - TARGET[2]).toBe(-(back.position[2] - TARGET[2]));
    expect(front.position[0]).toBe(back.position[0]);
    expect(front.position[1]).toBe(back.position[1]);
  });
});
