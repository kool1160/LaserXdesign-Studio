import type {
  GuidedGoal,
  GuidedWorkflowDefinition,
} from "./guidedWorkflowState.js";

export interface GuidedStepPresentation {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly surface:
    | "create"
    | "import"
    | "ai"
    | "analysis"
    | "preview"
    | "output";
}

export interface GuidedGoalPresentation {
  readonly goal: GuidedGoal;
  readonly title: string;
  readonly description: string;
  readonly definition: GuidedWorkflowDefinition;
  readonly steps: readonly GuidedStepPresentation[];
}

function goal(
  goalId: GuidedGoal,
  title: string,
  description: string,
  steps: readonly GuidedStepPresentation[],
  transientStepIds: readonly string[],
): GuidedGoalPresentation {
  return Object.freeze({
    goal: goalId,
    title,
    description,
    definition: Object.freeze({
      goal: goalId,
      definitionVersion: 1,
      stepIds: Object.freeze(steps.map((step) => step.id)),
      // G1 has no optional explanatory stage. Product checkpoints are never
      // skippable merely because the shell has a Skip control available.
      skippableStepIds: Object.freeze([]),
      transientStepIds: Object.freeze([...transientStepIds]),
    }),
    steps: Object.freeze(steps.map((step) => Object.freeze({ ...step }))),
  });
}

export const GUIDED_GOALS: Readonly<
  Record<GuidedGoal, GuidedGoalPresentation>
> = Object.freeze({
  "create-first-sign": goal(
    "create-first-sign",
    "Create My First Sign",
    "Build a simple, correctly sized sign and check it before export.",
    [
      { id: "choose-size-material", title: "Choose size and material", description: "Set the real stock size and assign material and thickness to a physical layer.", surface: "create" },
      { id: "add-content", title: "Add your sign content", description: "Add a real shape, sign layout, or text object to the physical layer.", surface: "create" },
      { id: "analyze-cutability", title: "Check the design", description: "Run the whole-design manufacturability check on the current design.", surface: "analysis" },
      { id: "resolve-findings", title: "Review findings", description: "Resolve blocking findings before moving on.", surface: "analysis" },
      { id: "physical-preview", title: "Review the 3D result", description: "Render the physical stack-up, or explicitly acknowledge why this computer cannot render it.", surface: "preview" },
      { id: "save-export", title: "Save and export", description: "Save if wanted, then export SVG or DXF successfully to finish.", surface: "output" },
    ],
    ["resolve-findings"],
  ),
  "import-own-design": goal(
    "import-own-design",
    "Import My Own Design",
    "Choose existing artwork, turn it into editable geometry, then check and export the physical design.",
    [
      { id: "choose-file", title: "Choose your artwork", description: "Choose one SVG, DXF, PNG, or JPEG; LaserX will open the matching preparation path.", surface: "import" },
      { id: "prepare-source", title: "Prepare the artwork", description: "Review real vector units and fit, or trace the selected raster, then accept editable paths or cancel.", surface: "import" },
      { id: "assign-physical", title: "Set physical details", description: "Confirm real stock size and assign material, thickness, and physical roles to the imported layers.", surface: "create" },
      { id: "analyze-cutability", title: "Check the design", description: "Run Analyze all on the current imported design; selection-only and layer-only checks do not complete this step.", surface: "analysis" },
      { id: "resolve-findings", title: "Review findings", description: "Resolve blocking findings before moving on.", surface: "analysis" },
      { id: "physical-preview", title: "Review the 3D result", description: "Render the physical stack-up, or explicitly acknowledge why this computer cannot render it.", surface: "preview" },
      { id: "export-result", title: "Save and export", description: "Save if wanted, then export SVG or DXF successfully to finish.", surface: "output" },
    ],
    ["prepare-source", "resolve-findings"],
  ),
  "describe-with-ai": goal(
    "describe-with-ai",
    "Describe What I Want With AI — Optional",
    "Use the connected AI concept tool, then turn the result into checked editable geometry.",
    [
      { id: "describe-sign", title: "Describe your sign", description: "Tell LaserX what you want and optionally attach a reference image.", surface: "ai" },
      { id: "choose-concept", title: "Choose a concept", description: "Review the generated concepts and choose one to continue with.", surface: "ai" },
      { id: "make-manufacturable", title: "Prepare editable geometry", description: "Accept the concept and set its real physical details.", surface: "create" },
      { id: "analyze-cutability", title: "Check the design", description: "Run the manufacturability check on the accepted concept.", surface: "analysis" },
      { id: "resolve-findings", title: "Review findings", description: "Resolve blocking findings before moving on.", surface: "analysis" },
      { id: "physical-preview", title: "Review the 3D result", description: "Confirm the physical stack-up before export.", surface: "preview" },
      { id: "export-result", title: "Save or export", description: "Save the LaserX project and export editable artwork when ready.", surface: "output" },
    ],
    ["choose-concept", "resolve-findings"],
  ),
});

export function guidedGoal(goalId: GuidedGoal): GuidedGoalPresentation {
  return GUIDED_GOALS[goalId];
}

export function guidedStep(
  goalId: GuidedGoal,
  stepId: string,
): GuidedStepPresentation | null {
  return GUIDED_GOALS[goalId].steps.find((step) => step.id === stepId) ?? null;
}
