import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    // Node-only by default; a component test that needs a DOM opts in per
    // file with a `// @vitest-environment jsdom` docblock, so the rest of
    // the suite stays free of DOM/jsdom overhead.
    environment: "node",
    include: [
      "tests/unit/**/*.test.ts",
      "tests/unit/**/*.test.tsx",
      "tests/integration/**/*.test.ts",
    ],
  },
});
