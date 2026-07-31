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
]);
