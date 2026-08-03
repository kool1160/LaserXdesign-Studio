import { defineConfig } from "vitest/config";

/**
 * Separate from the app's normal `vitest.config.ts` so the Phase 3
 * benchmark harness (which writes evidence files and runs for much longer)
 * never runs as part of the ordinary `pnpm test` suite.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["bench/**/*.bench.ts"],
    // Benchmarks must not run in parallel with each other: concurrent CPU
    // contention would corrupt the timing samples they exist to produce.
    // (Tests within a single file already run sequentially.)
    fileParallelism: false,
  },
});
