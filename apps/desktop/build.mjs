import { build } from "esbuild";

const shared = {
  bundle: true,
  platform: "node",
  target: "node22",
  external: ["electron"],
  sourcemap: true,
  logLevel: "info",
  loader: {
    ".woff2": "binary",
  },
};

await Promise.all([
  build({
    ...shared,
    entryPoints: ["electron/main.ts"],
    outfile: "dist/electron/main.cjs",
    format: "cjs",
  }),
  build({
    ...shared,
    entryPoints: ["electron/preload.ts"],
    outfile: "dist/electron/preload.cjs",
    format: "cjs",
  }),
  build({
    ...shared,
    entryPoints: ["electron/credential-preload.ts"],
    outfile: "dist/electron/credential-preload.cjs",
    format: "cjs",
  }),
  build({
    ...shared,
    entryPoints: ["electron/geometry-worker.ts"],
    outfile: "dist/electron/geometry-worker.cjs",
    format: "cjs",
  }),
  build({
    ...shared,
    entryPoints: ["electron/raster-worker.ts"],
    outfile: "dist/electron/raster-worker.cjs",
    format: "cjs",
  }),
  build({
    ...shared,
    entryPoints: ["electron/cutability-worker.ts"],
    outfile: "dist/electron/cutability-worker.cjs",
    format: "cjs",
  }),
]);
