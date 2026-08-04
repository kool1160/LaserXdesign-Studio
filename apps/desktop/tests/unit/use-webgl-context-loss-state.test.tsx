// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useWebglContextLossState } from "../../src/features/physical-preview/useWebglContextLossState.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("useWebglContextLossState", () => {
  it("starts not lost", () => {
    const target = new EventTarget();
    const { result } = renderHook(() => useWebglContextLossState(target));
    expect(result.current).toEqual({ lost: false, failedToRestore: false });
  });

  it("becomes lost when webglcontextlost fires, and clears on webglcontextrestored", () => {
    const target = new EventTarget();
    const { result } = renderHook(() => useWebglContextLossState(target));

    act(() => {
      target.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    });
    expect(result.current.lost).toBe(true);
    expect(result.current.failedToRestore).toBe(false);

    act(() => {
      target.dispatchEvent(new Event("webglcontextrestored"));
    });
    expect(result.current.lost).toBe(false);
    expect(result.current.failedToRestore).toBe(false);
  });

  it("marks failedToRestore only after the timeout elapses without restoration", () => {
    vi.useFakeTimers();
    const target = new EventTarget();
    const { result } = renderHook(() => useWebglContextLossState(target, 1_000));

    act(() => {
      target.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    });
    expect(result.current.lost).toBe(true);
    expect(result.current.failedToRestore).toBe(false);

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(result.current.failedToRestore).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.lost).toBe(true);
    expect(result.current.failedToRestore).toBe(true);
  });

  it("restoring before the timeout cancels the failedToRestore transition", () => {
    vi.useFakeTimers();
    const target = new EventTarget();
    const { result } = renderHook(() => useWebglContextLossState(target, 1_000));

    act(() => {
      target.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    });
    act(() => {
      vi.advanceTimersByTime(500);
      target.dispatchEvent(new Event("webglcontextrestored"));
    });
    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(result.current).toEqual({ lost: false, failedToRestore: false });
  });

  it("removes both listeners on unmount", () => {
    const target = new EventTarget();
    const addSpy = vi.spyOn(target, "addEventListener");
    const removeSpy = vi.spyOn(target, "removeEventListener");
    const { unmount } = renderHook(() => useWebglContextLossState(target));

    expect(addSpy).toHaveBeenCalledWith("webglcontextlost", expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith("webglcontextrestored", expect.any(Function));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("webglcontextlost", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("webglcontextrestored", expect.any(Function));
  });

  it("does nothing when the target is null", () => {
    const { result } = renderHook(() => useWebglContextLossState(null));
    expect(result.current).toEqual({ lost: false, failedToRestore: false });
  });
});
