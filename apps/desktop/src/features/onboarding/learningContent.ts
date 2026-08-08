import type { LearnTopic } from "./guidedWorkflowState.js";

export interface LearningTopicPresentation {
  readonly id: LearnTopic;
  readonly title: string;
  readonly what: string;
  readonly why: string;
  readonly targetId: string;
}

/**
 * Presentation-only shop explanations. These point at real workspace surfaces
 * and deliberately carry no commands that can alter a project.
 */
export const learningTopics: readonly LearningTopicPresentation[] = [
  {
    id: "physical-layers",
    title: "Physical layers",
    what: "A physical layer is a real sheet, plate, or part in the finished job. Ordinary layers are just drawing organization.",
    why: "LaserX only uses physical layers for stock fit, manufacturing checks, 3D assembly, and production packages.",
    targetId: "edit-layers",
  },
  {
    id: "material-thickness",
    title: "Material and thickness",
    what: "Material and thickness describe the actual stock assigned to a physical layer.",
    why: "They determine whether geometry fits the stock and let the preview and checks describe the part honestly. They are not machine settings.",
    targetId: "edit-layers",
  },
  {
    id: "cutability-findings",
    title: "Cutability findings",
    what: "Analyze all checks the whole physical design for geometry that may not cut or assemble as intended.",
    why: "A finding is a design warning, not a machine-safety certificate. Review the current design before production.",
    targetId: "workflow-analyze",
  },
  {
    id: "repair-groups",
    title: "Repair groups",
    what: "LaserX separates safe automatic cleanup from suggestions and choices that need your judgment.",
    why: "That keeps routine cleanup quick without silently changing design intent. Preview every proposed repair before accepting it.",
    targetId: "workflow-analyze",
  },
  {
    id: "bridge-islands",
    title: "Bridges and islands",
    what: "An island is an enclosed piece that would fall free after cutting. A bridge leaves a small connection to hold it in place.",
    why: "Bridge direction and width affect the finished shape, so LaserX proposes editable geometry and waits for your approval.",
    targetId: "workflow-analyze",
  },
  {
    id: "physical-preview",
    title: "Physical 3D preview",
    what: "3D Preview builds a read-only assembly from the current physical layers, material, thickness, and stack order.",
    why: "It helps catch layer and assembly mistakes before export. Opening or closing it never changes the design.",
    targetId: "workflow-output",
  },
  {
    id: "export-output",
    title: "Export output",
    what: "SVG and DXF export editable geometry. A production package separates the selected physical layers into shop files.",
    why: "Export writes output from the current project; it does not prove the design is safe or send instructions to a machine.",
    targetId: "workflow-output",
  },
] as const;

export function learningTopic(id: LearnTopic): LearningTopicPresentation {
  const topic = learningTopics.find((candidate) => candidate.id === id);
  if (topic === undefined) {
    throw new Error(`Unknown learning topic: ${id}`);
  }
  return topic;
}
