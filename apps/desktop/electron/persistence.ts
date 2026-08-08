import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import type { RecoverySnapshot } from "@laserx/application";
import {
  laserxProjectSchema,
  parseProjectValue,
} from "@laserx/project-format";
import { z } from "zod";

import type { OnboardingPreferences } from "../src/features/onboarding/guidedWorkflowState.js";

const recentProjectSchema = z.strictObject({
  filePath: z.string(),
  name: z.string().min(1),
});
const recentProjectsSchema = z.array(recentProjectSchema).max(10);
const recoveryEnvelopeSchema = z.strictObject({
  schemaVersion: z.literal(1),
  capturedAt: z.iso.datetime(),
  originalPath: z.string().nullable(),
  project: z.unknown(),
});
const guidedGoalSchema = z.enum([
  "create-first-sign",
  "import-own-design",
  "describe-with-ai",
]);
const learnTopicSchema = z.enum([
  "physical-layers",
  "material-thickness",
  "cutability-findings",
  "repair-groups",
  "bridge-islands",
  "physical-preview",
  "export-output",
]);
const onboardingWorkflowSnapshotSchema = z.strictObject({
  goal: guidedGoalSchema,
  definitionVersion: z.number().int().positive(),
  currentStepId: z.string().trim().min(1),
  completedStepIds: z.array(z.string().trim().min(1)),
  skippedStepIds: z.array(z.string().trim().min(1)),
  projectBinding: z.strictObject({
    projectId: z.string().trim().min(1),
    documentId: z.string().trim().min(1),
    fingerprint: z.string().trim().min(1),
  }),
});
const onboardingPreferencesSchema: z.ZodType<OnboardingPreferences> =
  z.strictObject({
    schemaVersion: z.literal(2),
    completedGoals: z.array(guidedGoalSchema),
    dismissed: z.boolean(),
    activeWorkflow: onboardingWorkflowSnapshotSchema.nullable(),
    learnModeEnabled: z.boolean(),
    completedLearnTopics: z.array(learnTopicSchema),
  });
const legacyOnboardingPreferencesSchema = z.strictObject({
  schemaVersion: z.literal(1),
  completedGoals: z.array(guidedGoalSchema),
  dismissed: z.boolean(),
  activeWorkflow: onboardingWorkflowSnapshotSchema.nullable(),
});

export interface RecentProject {
  filePath: string;
  name: string;
}

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(
      temporaryPath,
      `${JSON.stringify(value, null, 2)}\n`,
      "utf8",
    );
    await rename(temporaryPath, filePath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

export class RecentProjectsStore {
  readonly #filePath: string;

  public constructor(userDataPath: string) {
    this.#filePath = join(userDataPath, "recent-projects.json");
  }

  public async load(): Promise<RecentProject[]> {
    try {
      const parsed = recentProjectsSchema.safeParse(
        JSON.parse(await readFile(this.#filePath, "utf8")) as unknown,
      );
      return parsed.success ? parsed.data : [];
    } catch {
      return [];
    }
  }

  public async add(project: RecentProject): Promise<RecentProject[]> {
    const current = await this.load();
    const normalizedPath = resolve(project.filePath);
    const next = [
      { ...project, filePath: normalizedPath },
      ...current.filter((item) => resolve(item.filePath) !== normalizedPath),
    ].slice(0, 10);
    await atomicWriteJson(this.#filePath, next);
    return next;
  }
}

export interface RecoveryStorePort {
  load(): Promise<RecoverySnapshot | null>;
  save(snapshot: RecoverySnapshot): Promise<void>;
  remove(): Promise<void>;
}

export class RecoveryStore implements RecoveryStorePort {
  public readonly filePath: string;

  public constructor(userDataPath: string) {
    this.filePath = join(userDataPath, "recovery", "active.laserx.autosave");
  }

  public async load(): Promise<RecoverySnapshot | null> {
    try {
      const parsed = recoveryEnvelopeSchema.safeParse(
        JSON.parse(await readFile(this.filePath, "utf8")) as unknown,
      );
      if (!parsed.success) {
        return null;
      }
      return {
        ...parsed.data,
        project: parseProjectValue(parsed.data.project),
      };
    } catch {
      return null;
    }
  }

  public async save(snapshot: RecoverySnapshot): Promise<void> {
    const validated = {
      ...recoveryEnvelopeSchema.parse(snapshot),
      project: laserxProjectSchema.parse(snapshot.project),
    };
    await atomicWriteJson(this.filePath, validated);
  }

  public async remove(): Promise<void> {
    await unlink(this.filePath).catch(() => undefined);
  }
}

export interface OnboardingPreferencesStorePort {
  load(): Promise<OnboardingPreferences | null>;
  save(preferences: OnboardingPreferences): Promise<void>;
}

export class OnboardingPreferencesStore
  implements OnboardingPreferencesStorePort
{
  public readonly filePath: string;

  public constructor(userDataPath: string) {
    this.filePath = join(userDataPath, "onboarding-preferences.json");
  }

  public async load(): Promise<OnboardingPreferences | null> {
    try {
      const value = JSON.parse(await readFile(this.filePath, "utf8")) as unknown;
      const parsed = onboardingPreferencesSchema.safeParse(value);
      if (parsed.success) return parsed.data;

      const legacy = legacyOnboardingPreferencesSchema.safeParse(value);
      return legacy.success
        ? {
            schemaVersion: 2,
            completedGoals: legacy.data.completedGoals,
            dismissed: legacy.data.dismissed,
            activeWorkflow: legacy.data.activeWorkflow,
            // Do not unexpectedly turn teaching on for an established user.
            // The permanent Learn / Help entry makes it easy to opt in.
            learnModeEnabled: false,
            completedLearnTopics: [],
          }
        : null;
    } catch {
      return null;
    }
  }

  public async save(preferences: OnboardingPreferences): Promise<void> {
    await atomicWriteJson(
      this.filePath,
      onboardingPreferencesSchema.parse(preferences),
    );
  }
}
