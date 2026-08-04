import type { PhysicalPreviewAssembly } from "./index.js";
import type { PhysicalPreviewTaskResult } from "./task.js";

/**
 * Immutable-value cache for expensive physical-scene results.
 *
 * Every read and write is cloned. A renderer consumer therefore cannot mutate a
 * cached assembly through layer visibility, camera orchestration, or accidental
 * object edits, and a failed later request cannot corrupt the last valid scene.
 */
export class PhysicalPreviewAssemblyCache {
  readonly #entries = new Map<string, PhysicalPreviewAssembly>();
  readonly #capacity: number;

  public constructor(capacity = 8) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError("Physical preview cache capacity must be a positive integer.");
    }
    this.#capacity = capacity;
  }

  public get size(): number {
    return this.#entries.size;
  }

  public get(inputFingerprint: string): PhysicalPreviewAssembly | null {
    const cached = this.#entries.get(inputFingerprint);
    if (cached === undefined) return null;

    // Refresh insertion order so the bounded map behaves as a small LRU cache.
    this.#entries.delete(inputFingerprint);
    this.#entries.set(inputFingerprint, cached);
    return structuredClone(cached);
  }

  public set(result: Pick<PhysicalPreviewTaskResult, "inputFingerprint" | "assembly">): void {
    const { inputFingerprint } = result;
    this.#entries.delete(inputFingerprint);
    this.#entries.set(inputFingerprint, structuredClone(result.assembly));

    while (this.#entries.size > this.#capacity) {
      const oldest = this.#entries.keys().next().value;
      if (oldest === undefined) break;
      this.#entries.delete(oldest);
    }
  }

  public delete(inputFingerprint: string): boolean {
    return this.#entries.delete(inputFingerprint);
  }

  public clear(): void {
    this.#entries.clear();
  }
}
