import type { PathObject } from "@laserx/domain";
import { applyAffineTransform, previewPathJoin } from "@laserx/geometry";

export interface SelectedPathJoinPreview {
  firstEnd: "start" | "end";
  secondEnd: "start" | "end";
  distanceMm: number;
  withinTolerance: boolean;
}

export function previewSelectedPathJoin(
  paths: readonly PathObject[],
  toleranceMm: number,
): SelectedPathJoinPreview | null {
  const first = paths[0];
  const second = paths[1];
  if (
    paths.length !== 2 ||
    first === undefined ||
    second === undefined ||
    first.closed ||
    second.closed ||
    !Number.isFinite(toleranceMm) ||
    toleranceMm < 0
  ) {
    return null;
  }
  const worldPath = (path: PathObject) => ({
    closed: path.closed,
    points: path.points.map((point) =>
      applyAffineTransform(point, path.transform),
    ),
  });
  const firstWorld = worldPath(first);
  const secondWorld = worldPath(second);
  const previews = (["start", "end"] as const)
    .flatMap((firstEnd) =>
      (["start", "end"] as const).map((secondEnd) => ({
        firstEnd,
        secondEnd,
        ...previewPathJoin(
          firstWorld,
          firstEnd,
          secondWorld,
          secondEnd,
          toleranceMm,
        ),
      })),
    )
    .sort((left, right) => left.distanceMm - right.distanceMm);
  return previews[0] ?? null;
}
