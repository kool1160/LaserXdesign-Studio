import { readFileSync } from "node:fs";

import { createBlankProject } from "@laserx/domain";
import { describe, expect, it } from "vitest";

import {
  parseProject,
  ProjectFormatError,
  projectMigrationRegistry,
  serializeProject,
} from "../src/index.js";

const PROJECT_ID = "123e4567-e89b-42d3-a456-426614174000";
const NOW = "2026-07-30T12:00:00.000Z";

function fixture(name: string): string {
  return readFileSync(
    new URL(`../../../fixtures/projects/${name}`, import.meta.url),
    "utf8",
  );
}

function expectProjectError(
  action: () => unknown,
  code: ProjectFormatError["code"],
): void {
  try {
    action();
    throw new Error("Expected parsing to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(ProjectFormatError);
    expect((error as ProjectFormatError).code).toBe(code);
  }
}

describe("schema version 1", () => {
  it("round trips a blank project deterministically", () => {
    const project = createBlankProject({
      id: PROJECT_ID,
      now: NOW,
      settings: { displayUnit: "inches" },
    });

    const first = serializeProject(project);
    const reopened = parseProject(first);

    expect(reopened).toEqual(project);
    expect(serializeProject(reopened)).toBe(first);
  });

  it("rejects corrupt JSON with a useful error code", () => {
    expectProjectError(() => parseProject("{"), "INVALID_JSON");
  });

  it("rejects future schema versions without attempting migration", () => {
    expectProjectError(
      () => parseProject(JSON.stringify({ schemaVersion: 99 })),
      "UNSUPPORTED_FUTURE_VERSION",
    );
  });

  it("rejects structurally invalid version-1 projects", () => {
    expectProjectError(
      () => parseProject(JSON.stringify({ schemaVersion: 1 })),
      "INVALID_PROJECT",
    );
  });

  it("starts with an explicit empty migration registry", () => {
    expect(projectMigrationRegistry).toEqual([]);
  });

  it("keeps the reviewed schema fixtures executable", () => {
    expect(parseProject(fixture("blank-v1.laserx")).schemaVersion).toBe(1);
    expectProjectError(
      () => parseProject(fixture("corrupt-v1.laserx")),
      "INVALID_JSON",
    );
    expectProjectError(
      () => parseProject(fixture("future-v99.laserx")),
      "UNSUPPORTED_FUTURE_VERSION",
    );
  });
});
