import type { PreviewView } from "./cameraPose";

export type AssemblyMode = "assembled" | "exploded";

export interface CaptureFilenameInput {
  projectName: string;
  view: PreviewView;
  mode: AssemblyMode;
}

/** Same slugging approach as `@laserx/production-export`'s `safeFilePart`. */
function slug(value: string): string {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .toLowerCase()
    .slice(0, 60);
  return cleaned.length === 0 ? "project" : cleaned;
}

/**
 * Deterministic PNG filename for customer-preview capture: same
 * project/view/mode always produces the same name, so repeat captures
 * during a session overwrite rather than accumulate ambiguous copies.
 */
export function buildCaptureFilename({ projectName, view, mode }: CaptureFilenameInput): string {
  return `laserx-preview-${slug(projectName)}-${view}-${mode}.png`;
}
