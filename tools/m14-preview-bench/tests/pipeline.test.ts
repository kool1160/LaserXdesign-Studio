import { serializeProject, parseProject } from "@laserx/project-format";
import { describe, expect, it } from "vitest";

import { benchFixtures } from "../src/fixtures.js";
import { buildScene, convertToThree, describeProject, measureAnalysis } from "../src/pipeline.js";
import { median, p95, summarize } from "../src/stats.js";

describe("bench statistics", () => {
  it("uses a conventional median for odd and even sample counts", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("uses nearest-rank p95", () => {
    const values = Array.from({ length: 20 }, (_, index) => index + 1);
    expect(p95(values)).toBe(19);
    expect(p95([5])).toBe(5);
  });

  it("summarizes min, median, p95, and max", () => {
    const statistics = summarize([10, 1, 5, 3]);
    expect(statistics).toEqual({ samples: 4, minMs: 1, medianMs: 4, p95Ms: 10, maxMs: 10 });
  });
});

describe("measured pipeline", () => {
  it("produces text fixtures with real glyph contours and interior holes", async () => {
    const fixtures = await benchFixtures();
    const textHeavy = fixtures.find((fixture) => fixture.key === "text-heavy");
    if (textHeavy === undefined) throw new Error("text-heavy fixture missing");

    const shape = describeProject(textHeavy.project);
    // Outlined text is the point of this gate: many closed contours and far
    // more points than the rectangle/circle research baseline.
    expect(shape.objects).toBeGreaterThan(80);
    expect(shape.contourPoints).toBeGreaterThan(5000);
    expect(shape.closedPaths).toBe(shape.objects);

    const analysis = measureAnalysis(textHeavy.project.document);
    const scene = buildScene(textHeavy.project.document, analysis.summary);
    const holes = scene.flatMap((layer) => layer.shapes).filter((s) => s.holes.length > 0);
    // Glyph counters (O, R, A, 8, &) must become genuine holes, not extra solids.
    expect(holes.length).toBeGreaterThan(0);
  }, 600_000);

  it("is deterministic and leaves the source project structurally unchanged", async () => {
    const fixtures = await benchFixtures();
    const fixture = fixtures.find((candidate) => candidate.key === "text-short");
    if (fixture === undefined) throw new Error("text-short fixture missing");

    const serialized = serializeProject(fixture.project);
    const project = parseProject(serialized);
    const before = JSON.stringify(project);

    const first = convertToThree(buildScene(project.document, measureAnalysis(project.document).summary));
    const second = convertToThree(buildScene(project.document, measureAnalysis(project.document).summary));

    expect(second).toEqual(first);
    // The preview is a read-only consumer; measuring it must not mutate input.
    expect(JSON.stringify(project)).toBe(before);
  }, 600_000);

  it("attributes analysis cost to the four reported phases", async () => {
    const fixtures = await benchFixtures();
    const fixture = fixtures.find((candidate) => candidate.key === "text-short");
    if (fixture === undefined) throw new Error("text-short fixture missing");

    const { phases } = measureAnalysis(fixture.project.document);
    const summed =
      phases.normalizingMs + phases.topologyMs + phases.spacingMs + phases.classifyingMs;

    // The phases must account for essentially all of the measured total, or the
    // cost attribution the G1 decision rests on would be meaningless.
    expect(summed).toBeGreaterThan(phases.totalMs * 0.9);
    expect(summed).toBeLessThanOrEqual(phases.totalMs);
  }, 600_000);
});
