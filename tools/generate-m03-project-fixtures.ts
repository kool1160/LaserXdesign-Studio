import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  createBlankProject,
  identityTransform,
  setViewportPreferences,
  type DocumentObject,
  type LaserxProject,
} from "../packages/domain/src/index.js";
import {
  parseProject,
  serializeProject,
} from "../packages/project-format/src/index.js";

const repositoryRoot = process.cwd();
const fixturesDirectory = resolve(repositoryRoot, "fixtures/projects");
const projectId = "123e4567-e89b-42d3-a456-426614174000";
const documentId = "123e4567-e89b-42d3-a456-426614174001";
const artworkLayerId = "223e4567-e89b-42d3-a456-426614174001";
const notesLayerId = "323e4567-e89b-42d3-a456-426614174001";
const now = "2026-07-30T12:00:00.000Z";

function editingProject(): LaserxProject {
  const children: DocumentObject[] = [
    {
      id: "123e4567-e89b-42d3-a456-426614174011",
      type: "rectangle",
      layerId: artworkLayerId,
      transform: identityTransform(),
      origin: { xMm: 120, yMm: 30 },
      widthMm: 80,
      heightMm: 50,
    },
    {
      id: "123e4567-e89b-42d3-a456-426614174012",
      type: "ellipse",
      layerId: artworkLayerId,
      transform: identityTransform(),
      center: { xMm: 270, yMm: 70 },
      radiusXmm: 40,
      radiusYmm: 25,
    },
  ];
  return setViewportPreferences(
    createBlankProject({
      id: projectId,
      documentId,
      now,
      width: 24,
      height: 12,
      inputUnit: "inches",
      displayUnit: "inches",
      layers: [
        {
          id: artworkLayerId,
          name: "Artwork",
          visible: true,
          locked: false,
        },
        {
          id: notesLayerId,
          name: "Reference",
          visible: false,
          locked: true,
        },
      ],
      activeLayerId: artworkLayerId,
      guides: [
        {
          id: "423e4567-e89b-42d3-a456-426614174001",
          axis: "x",
          positionMm: 304.8,
        },
      ],
      objects: [
        {
          id: "123e4567-e89b-42d3-a456-426614174010",
          type: "line",
          layerId: artworkLayerId,
          transform: {
            ...identityTransform(),
            eMm: 5,
            fMm: 10,
          },
          start: { xMm: 10, yMm: 10 },
          end: { xMm: 100, yMm: 80 },
        },
        {
          id: "123e4567-e89b-42d3-a456-426614174020",
          type: "group",
          layerId: artworkLayerId,
          transform: {
            a: 0,
            b: 1,
            c: -1,
            d: 0,
            eMm: 300,
            fMm: -100,
          },
          children,
        },
        {
          id: "123e4567-e89b-42d3-a456-426614174013",
          type: "path",
          layerId: notesLayerId,
          transform: identityTransform(),
          closed: true,
          points: [
            { xMm: 350, yMm: 20 },
            { xMm: 430, yMm: 20 },
            { xMm: 390, yMm: 90 },
          ],
        },
      ],
    }),
    {
      gridSpacingMm: 12.7,
      snappingEnabled: true,
    },
    now,
  );
}

const v2Source = await readFile(
  resolve(fixturesDirectory, "populated-v2.laserx"),
  "utf8",
);
await Promise.all([
  writeFile(
    resolve(fixturesDirectory, "editing-v3.laserx"),
    serializeProject(editingProject()),
    "utf8",
  ),
  writeFile(
    resolve(fixturesDirectory, "migrated-v2-to-v3.laserx"),
    serializeProject(parseProject(v2Source)),
    "utf8",
  ),
]);
