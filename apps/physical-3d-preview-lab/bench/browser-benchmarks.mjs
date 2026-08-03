/*
 * This file runs under Node (Playwright driver), but the bodies passed to
 * `page.evaluate(...)` are serialized and executed inside the browser, so
 * they legitimately reference browser globals. The repository's root ESLint
 * config gives `.mjs` files Node globals only; these are declared here
 * rather than by editing the shared root config, which is outside this
 * experiment's owned paths.
 */
/* global window, document, requestAnimationFrame, Image */

import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

import { inspectPng, pngBytesFromDataUrl } from "./png-inspect.mjs";
import { writeResultsSection } from "./results-io.mjs";
import { summarize } from "./stats.mjs";

const PORT = 4174;
const BASE_URL = `http://127.0.0.1:${String(PORT)}`;
const VIEWPORT = { width: 1280, height: 800 };

const READINESS_WARMUP = 2;
const READINESS_SAMPLES = 10;
const INTERACTION_WARMUP = 3;
const INTERACTION_SAMPLES = 20;
const CAPTURE_WARMUP = 2;
const CAPTURE_SAMPLES = 12;
const FRAME_SAMPLE_MS = 2000;
const STRESS_CYCLES = 60;

/** Fixtures given the deeper interaction/stress treatment. */
const BASELINE_FIXTURE = "two-layer";
const STRESS_FIXTURE = "high-complexity";

async function startPreviewServer() {
  // Run vite's JS entry with the current Node binary rather than the `vite`
  // shell shim: Windows refuses to spawn `.cmd` wrappers without a shell,
  // and `shell: true` would then have to cope with spaces in the repo path.
  const appRoot = fileURLToPath(new URL("..", import.meta.url));
  const viteEntry = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
  const child = spawn(
    process.execPath,
    [viteEntry, "preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"],
    { cwd: appRoot, stdio: "ignore" },
  );
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await delay(250);
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) return child;
    } catch {
      // keep polling
    }
  }
  child.kill();
  throw new Error(`Preview server did not become ready on ${BASE_URL}.`);
}

/**
 * Waits until the preview is genuinely ready: the canvas is visible AND
 * React Three Fiber has finished creating its WebGLRenderer (signalled by
 * the bench hook). R3F's `onCreated` lands several frames after the canvas
 * element first becomes visible, so a fixed rAF count is not a sound
 * readiness gate — measured directly before choosing this definition.
 */
async function waitForPreviewReady(page) {
  await page.locator('[data-testid="preview-canvas"] canvas').waitFor({ state: "visible" });
  await page.waitForFunction(() => (window.__laserxPreviewLab?.renderer ?? null) !== null, null, {
    timeout: 20_000,
  });
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve(null);
          });
        });
      }),
  );
}

async function measureReadiness(page, fixtureKey) {
  const samples = [];
  for (let run = 0; run < READINESS_WARMUP + READINESS_SAMPLES; run += 1) {
    const start = Date.now();
    await page.goto(`${BASE_URL}/?fixture=${fixtureKey}`, { waitUntil: "load" });
    await waitForPreviewReady(page);
    const elapsed = Date.now() - start;
    if (run >= READINESS_WARMUP) samples.push(elapsed);
  }
  return { ...summarize(samples), warmupRuns: READINESS_WARMUP, samples };
}

/**
 * Clicks a control and measures until the next fully rendered frame after
 * React has committed the change. This is "click to next painted frame",
 * not raw GPU time — stated plainly rather than implied as a GPU metric.
 */
async function measureClickToFrame(page, testId, warmupRuns, sampleRuns, alternateTestId) {
  const samples = [];
  for (let run = 0; run < warmupRuns + sampleRuns; run += 1) {
    const target = alternateTestId !== undefined && run % 2 === 1 ? alternateTestId : testId;
    const elapsed = await page.evaluate(async (selectorId) => {
      const element = document.querySelector(`[data-testid="${selectorId}"]`);
      if (element === null) throw new Error(`Missing control ${selectorId}`);
      const start = performance.now();
      element.click();
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve(null);
          });
        });
      });
      return performance.now() - start;
    }, target);
    if (run >= warmupRuns) samples.push(elapsed);
  }
  return { ...summarize(samples), warmupRuns, samples: samples.map((v) => Math.round(v * 10_000) / 10_000) };
}

/** Samples requestAnimationFrame deltas to characterize bounded interaction pacing. */
async function measureFrameIntervals(page, durationMs) {
  const deltas = await page.evaluate(
    (windowMs) =>
      new Promise((resolve) => {
        const collected = [];
        let previous = performance.now();
        const started = previous;
        function step(now) {
          collected.push(now - previous);
          previous = now;
          if (now - started < windowMs) requestAnimationFrame(step);
          else resolve(collected);
        }
        requestAnimationFrame(step);
      }),
    durationMs,
  );
  // Drop the first delta: it spans scheduling latency, not a rendered frame.
  return deltas.slice(1);
}

/**
 * `performance.memory.usedJSHeapSize` is coarsely bucketed by Chromium for
 * security (it reported an identical, suspiciously round value before and
 * after a 60-cycle stress run, which would have been meaningless as
 * evidence). The CDP `Performance.getMetrics` `JSHeapUsedSize` counter is
 * byte-accurate, so it is used as the heap metric and the quantized
 * `performance.memory` value is recorded alongside it only for contrast.
 */
async function readResources(page, cdp) {
  await page.evaluate(() => {
    if (typeof globalThis.gc === "function") globalThis.gc();
  });
  const inPage = await page.evaluate(() => {
    const hook = window.__laserxPreviewLab;
    const memory = performance.memory ?? null;
    return {
      renderer: hook?.rendererInfo() ?? null,
      quantizedJsHeapBytes: memory ? memory.usedJSHeapSize : null,
    };
  });
  const { metrics } = await cdp.send("Performance.getMetrics");
  const heap = metrics.find((metric) => metric.name === "JSHeapUsedSize");
  const nodes = metrics.find((metric) => metric.name === "Nodes");
  const listeners = metrics.find((metric) => metric.name === "JSEventListeners");
  return {
    ...inPage,
    jsHeapUsedBytes: heap?.value ?? null,
    domNodes: nodes?.value ?? null,
    jsEventListeners: listeners?.value ?? null,
  };
}

/** Reads the live canvas back as a PNG data URL, the same call the app's capture uses. */
async function readCanvasPng(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="preview-canvas"] canvas');
    if (canvas === null) throw new Error("Missing canvas");
    return canvas.toDataURL("image/png");
  });
}

/** Decodes the captured PNG and measures how much of it is actually non-background. */
async function analyzeCapturedPixels(page, dataUrl) {
  return page.evaluate(
    async ([url, backgroundHex]) => {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = () => {
          resolve(null);
        };
        image.onerror = () => {
          reject(new Error("Failed to decode captured PNG."));
        };
        image.src = url;
      });
      const surface = document.createElement("canvas");
      surface.width = image.width;
      surface.height = image.height;
      const context = surface.getContext("2d");
      if (context === null) throw new Error("No 2D context for pixel analysis.");
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, surface.width, surface.height);

      const background = {
        r: Number.parseInt(backgroundHex.slice(1, 3), 16),
        g: Number.parseInt(backgroundHex.slice(3, 5), 16),
        b: Number.parseInt(backgroundHex.slice(5, 7), 16),
      };
      const distinct = new Set();
      let nonBackground = 0;
      const totalPixels = surface.width * surface.height;
      for (let index = 0; index < data.length; index += 4) {
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        distinct.add((r << 16) | (g << 8) | b);
        if (
          Math.abs(r - background.r) > 6 ||
          Math.abs(g - background.g) > 6 ||
          Math.abs(b - background.b) > 6
        ) {
          nonBackground += 1;
        }
      }
      return {
        widthPx: surface.width,
        heightPx: surface.height,
        totalPixels,
        distinctColors: distinct.size,
        nonBackgroundPixels: nonBackground,
        nonBackgroundFraction: Math.round((nonBackground / totalPixels) * 100_000) / 100_000,
      };
    },
    [dataUrl, "#2b2b2b"],
  );
}

async function main() {
  const server = await startPreviewServer();
  const browser = await chromium.launch({ args: ["--js-flags=--expose-gc"] });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");

  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(String(error));
  });

  const results = {
    environment: {
      capturedAt: new Date().toISOString(),
      browser: `chromium ${browser.version()}`,
      playwright: "1.62.0",
      viewportCssPx: VIEWPORT,
      deviceScaleFactor: 1,
      headless: true,
      gcExposed: false,
      note:
        "Headless Chromium on this development machine. requestAnimationFrame pacing in " +
        "headless mode is scheduler-driven and is not a real-display GPU frame-rate measurement.",
    },
  };

  await page.goto(`${BASE_URL}/?fixture=${BASELINE_FIXTURE}`, { waitUntil: "load" });
  await waitForPreviewReady(page);

  results.environment.gcExposed = await page.evaluate(
    () => typeof globalThis.gc === "function",
  );

  const fixtures = await page.evaluate(() => window.__laserxPreviewLab?.fixtures ?? []);
  if (fixtures.length === 0) throw new Error("The bench hook exposed no fixtures.");

  // --- initial canvas readiness, every reviewed fixture -------------------
  const readiness = [];
  for (const fixture of fixtures) {
    readiness.push({ key: fixture.key, canvasReadyMs: await measureReadiness(page, fixture.key) });
    process.stdout.write(`readiness ${fixture.key} done\n`);
  }
  results.canvasReadiness = readiness;

  // --- interaction: mode + view regeneration -----------------------------
  const interaction = [];
  for (const fixtureKey of [BASELINE_FIXTURE, STRESS_FIXTURE]) {
    await page.goto(`${BASE_URL}/?fixture=${fixtureKey}`, { waitUntil: "load" });
    await waitForPreviewReady(page);
    const modeToggle = await measureClickToFrame(
      page,
      "mode-exploded",
      INTERACTION_WARMUP,
      INTERACTION_SAMPLES,
      "mode-assembled",
    );
    const frameIntervals = await measureFrameIntervals(page, FRAME_SAMPLE_MS);
    interaction.push({
      key: fixtureKey,
      assembledExplodedToggleMs: modeToggle,
      frameIntervalMs: { ...summarize(frameIntervals), sampleWindowMs: FRAME_SAMPLE_MS },
    });
    process.stdout.write(`interaction ${fixtureKey} done\n`);
  }
  results.interaction = interaction;

  // --- PNG capture: real app path + structural/pixel validation ----------
  const captureRuns = [];
  await page.goto(`${BASE_URL}/?fixture=${BASELINE_FIXTURE}`, { waitUntil: "load" });
  await waitForPreviewReady(page);
  for (let run = 0; run < CAPTURE_WARMUP + CAPTURE_SAMPLES; run += 1) {
    const start = Date.now();
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("capture-png").click();
    const download = await downloadPromise;
    const elapsed = Date.now() - start;
    if (run >= CAPTURE_WARMUP) captureRuns.push(elapsed);
    await download.delete();
  }

  const capturedDataUrl = await readCanvasPng(page);
  const inspection = inspectPng(pngBytesFromDataUrl(capturedDataUrl));
  const pixels = await analyzeCapturedPixels(page, capturedDataUrl);
  const secondDataUrl = await readCanvasPng(page);
  const secondInspection = inspectPng(pngBytesFromDataUrl(secondDataUrl));

  results.pngCapture = {
    appDownloadPathMs: {
      ...summarize(captureRuns),
      warmupRuns: CAPTURE_WARMUP,
      samples: captureRuns,
    },
    structural: inspection,
    pixels,
    repeatDigestMatches:
      inspection.valid && secondInspection.valid
        ? inspection.sha256 === secondInspection.sha256
        : false,
  };
  process.stdout.write("png capture done\n");

  // --- stress: repeated mode/view/visibility/readback cycles -------------
  await page.goto(`${BASE_URL}/?fixture=${STRESS_FIXTURE}`, { waitUntil: "load" });
  await waitForPreviewReady(page);
  const before = await readResources(page, cdp);
  const cycleSamples = [];
  const resourceTrail = [];
  const layerCheckboxIds = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid^="layer-visibility-"]')).map((element) =>
      element.getAttribute("data-testid"),
    ),
  );

  for (let cycle = 0; cycle < STRESS_CYCLES; cycle += 1) {
    const start = Date.now();
    await page.getByTestId(cycle % 2 === 0 ? "mode-exploded" : "mode-assembled").click();
    await page
      .getByRole("button", { name: ["Front", "Back", "Edge", "Perspective"][cycle % 4], exact: true })
      .click();
    const checkboxId = layerCheckboxIds[cycle % Math.max(layerCheckboxIds.length, 1)];
    if (checkboxId) {
      await page.getByTestId(checkboxId).click();
      await page.getByTestId(checkboxId).click();
    }
    // Force a real GPU readback each cycle: the expensive part of capture,
    // without the download plumbing.
    await readCanvasPng(page);
    cycleSamples.push(Date.now() - start);

    // Sample periodically so growth can be shown as a curve. Endpoint-only
    // sampling cannot distinguish a bounded one-off allocation from steady
    // linear growth, which is the whole question being asked.
    if ((cycle + 1) % 10 === 0) {
      const sample = await readResources(page, cdp);
      resourceTrail.push({
        cycle: cycle + 1,
        geometries: sample.renderer?.geometries ?? null,
        textures: sample.renderer?.textures ?? null,
        programs: sample.renderer?.programs ?? null,
        jsHeapUsedBytes: sample.jsHeapUsedBytes,
        domNodes: sample.domNodes,
        jsEventListeners: sample.jsEventListeners,
      });
    }
  }
  const after = await readResources(page, cdp);

  results.stress = {
    fixture: STRESS_FIXTURE,
    cycles: STRESS_CYCLES,
    cycleMsNote:
      "Driver-measured wall time per cycle, including Playwright automation " +
      "round-trips for each click and readback. Not an in-app cost.",
    cycleMs: { ...summarize(cycleSamples), samples: cycleSamples },
    resourcesBefore: before,
    resourcesAfter: after,
    resourceTrail,
    rendererGeometryDelta:
      before.renderer && after.renderer
        ? after.renderer.geometries - before.renderer.geometries
        : null,
    rendererTextureDelta:
      before.renderer && after.renderer ? after.renderer.textures - before.renderer.textures : null,
    rendererProgramDelta:
      before.renderer && after.renderer ? after.renderer.programs - before.renderer.programs : null,
    jsHeapUsedDeltaBytes:
      before.jsHeapUsedBytes !== null && after.jsHeapUsedBytes !== null
        ? after.jsHeapUsedBytes - before.jsHeapUsedBytes
        : null,
    domNodeDelta:
      before.domNodes !== null && after.domNodes !== null
        ? after.domNodes - before.domNodes
        : null,
    jsEventListenerDelta:
      before.jsEventListeners !== null && after.jsEventListeners !== null
        ? after.jsEventListeners - before.jsEventListeners
        : null,
  };
  process.stdout.write("stress done\n");

  // --- real WebGL context loss via WEBGL_lose_context ---------------------
  await page.goto(`${BASE_URL}/?fixture=${BASELINE_FIXTURE}`, { waitUntil: "load" });
  await waitForPreviewReady(page);
  const errorsBeforeLoss = pageErrors.length;

  const lossSupport = await page.evaluate(() => {
    const renderer = window.__laserxPreviewLab?.renderer ?? null;
    if (renderer === null) return { supported: false, reason: "No renderer registered." };
    const gl = renderer.getContext();
    const extension = gl.getExtension("WEBGL_lose_context");
    if (extension === null) {
      return { supported: false, reason: "WEBGL_lose_context unavailable in this browser." };
    }
    // Retain the extension object before losing the context: once the
    // context is lost, `getExtension` returns null, so re-fetching it later
    // would silently no-op the restore.
    globalThis.__laserxLoseContextExtension = extension;
    extension.loseContext();
    return { supported: true, reason: null };
  });

  let realLoss = { attempted: true, ...lossSupport, overlayShown: false, restored: false };
  if (lossSupport.supported) {
    await page
      .getByTestId("context-lost")
      .waitFor({ state: "visible", timeout: 10_000 })
      .then(
        () => {
          realLoss.overlayShown = true;
        },
        () => {
          realLoss.overlayShown = false;
        },
      );
    // Readouts must survive a real context loss, not just a synthetic event.
    realLoss.readoutStillPresent = await page
      .getByTestId("dimensions")
      .textContent()
      .then((text) => (text ?? "").includes("mm"));

    await page.evaluate(() => {
      globalThis.__laserxLoseContextExtension?.restoreContext();
    });
    await page
      .getByTestId("context-lost")
      .waitFor({ state: "detached", timeout: 10_000 })
      .then(
        () => {
          realLoss.restored = true;
        },
        () => {
          realLoss.restored = false;
        },
      );
  }
  realLoss.uncaughtPageErrors = pageErrors.length - errorsBeforeLoss;
  results.webglContextLoss = {
    real: realLoss,
    syntheticFallbackCoveredBy:
      "apps/physical-3d-preview-lab/tests/e2e/lab.spec.ts — synthetic webglcontextlost event test, retained as fallback evidence.",
  };
  process.stdout.write("context loss done\n");

  results.totalUncaughtPageErrors = pageErrors.length;
  results.pageErrors = pageErrors;

  writeResultsSection("browser", results);

  await context.close();
  await browser.close();
  server.kill();

  process.stdout.write("\nBrowser benchmarks complete.\n");
  if (pageErrors.length > 0) {
    process.stdout.write(`WARNING: ${String(pageErrors.length)} uncaught page error(s).\n`);
  }
}

await main();
