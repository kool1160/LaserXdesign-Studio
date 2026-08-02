import { readFile, writeFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import {
  clickAndWaitForCommand,
  kill,
  killAndRemove,
  launchPackaged,
  waitForProjectSchema,
} from "./helpers.js";

test("packaged text stays editable, arcs, converts, undoes, and reopens", async () => {
  const launched = await launchPackaged();
  let savedContours: string;
  try {
    const page = await launched.electronApp.firstWindow();
    await expect(page.getByTestId("text-panel")).toBeVisible();
    await expect
      .poll(
        () => page.getByTestId("font-family").locator("option").count(),
        { timeout: 20_000 },
      )
      .toBeGreaterThanOrEqual(6);

    await page.getByTestId("text-content").fill("B LaserX");
    await page.getByTestId("create-text").click();
    await expect
      .poll(async () =>
        page.evaluate(
          async () =>
            (await window.laserx.getState()).project.document.objects.at(-1)
              ?.type,
        ),
      )
      .toBe("text");
    const compoundPaths = page.getByTestId("compound-text-path");
    await expect(compoundPaths.first()).toHaveAttribute("fill-rule", "evenodd");
    await expect.poll(() => compoundPaths.count()).toBeGreaterThanOrEqual(2);
    await expect
      .poll(async () => {
        const paths = await compoundPaths.evaluateAll((elements) =>
          elements.map((element) => element.getAttribute("d") ?? ""),
        );
        return paths.reduce(
          (count, path) => count + (path.match(/\bM\b/gu)?.length ?? 0),
          0,
        );
      })
      .toBeGreaterThanOrEqual(3);

    await page.getByLabel("Arc text").check();
    await page.getByTestId("arc-radius").fill("90");
    await page.getByTestId("text-content").fill("B Arc LaserX");
    await page.getByTestId("update-text").click();
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const object = (await window.laserx.getState()).project.document.objects.at(-1);
          return object?.type === "text"
            ? `${object.content}:${String(object.arc?.radiusMm)}`
            : object?.type;
        }),
      )
      .toBe("B Arc LaserX:90");

    savedContours = await page.evaluate(async () => {
      const object = (await window.laserx.getState()).project.document.objects.at(-1);
      return object?.type === "text" ? JSON.stringify(object.contours) : "";
    });
    expect(savedContours.length).toBeGreaterThan(100);

    await page.getByTestId("convert-text-outlines").click();
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const object = (await window.laserx.getState()).project.document.objects.at(-1);
          return object?.type === "group" && object.sourceText?.content;
        }),
      )
      .toBe("B Arc LaserX");
    await page.getByTestId("undo").click();
    await expect
      .poll(async () =>
        page.evaluate(
          async () =>
            (await window.laserx.getState()).project.document.objects.at(-1)
              ?.type,
        ),
      )
      .toBe("text");

    await clickAndWaitForCommand(page, "Save as");
    await waitForProjectSchema(launched.projectPath, 9);
    const disk = JSON.parse(await readFile(launched.projectPath, "utf8")) as {
      document: { objects: Array<{ type: string; content?: string }> };
    };
    expect(disk.document.objects.at(-1)).toMatchObject({
      type: "text",
      content: "B Arc LaserX",
    });
  } finally {
    await kill(launched);
  }

  const reopened = await launchPackaged(launched.directory);
  try {
    const page = await reopened.electronApp.firstWindow();
    await page.locator(".recent-section button").first().click();
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const object = (await window.laserx.getState()).project.document.objects.at(-1);
          return object?.type === "text" ? JSON.stringify(object.contours) : "";
        }),
      )
      .toBe(savedContours);
  } finally {
    await killAndRemove(reopened);
  }
});

test("changed font fingerprint preserves geometry until explicit substitution", async () => {
  const launched = await launchPackaged();
  try {
    const page = await launched.electronApp.firstWindow();
    await expect
      .poll(() => page.getByTestId("font-family").locator("option").count())
      .toBeGreaterThanOrEqual(6);
    await page.getByTestId("text-content").fill("O LaserX");
    await page.getByTestId("create-text").click();
    await expect
      .poll(async () =>
        page.evaluate(
          async () =>
            (await window.laserx.getState()).project.document.objects.at(-1)
              ?.type,
        ),
      )
      .toBe("text");
    await clickAndWaitForCommand(page, "Save as");
    await waitForProjectSchema(launched.projectPath, 9);
  } finally {
    await kill(launched);
  }

  const project = JSON.parse(
    await readFile(launched.projectPath, "utf8"),
  ) as {
    document: {
      objects: Array<{
        type: string;
        contours?: unknown;
        style?: { fontFingerprint: string };
      }>;
    };
  };
  const text = project.document.objects.at(-1);
  if (
    text?.type !== "text" ||
    text.style === undefined ||
    text.contours === undefined
  ) {
    throw new Error("Expected saved editable text.");
  }
  const preservedContours = JSON.stringify(text.contours);
  text.style.fontFingerprint = "f".repeat(64);
  await writeFile(
    launched.projectPath,
    `${JSON.stringify(project, null, 2)}\n`,
    "utf8",
  );

  const reopened = await launchPackaged(launched.directory);
  try {
    const page = await reopened.electronApp.firstWindow();
    await page.locator(".recent-section button").first().click();
    await expect
      .poll(async () =>
        page.evaluate(
          async () =>
            (await window.laserx.getState()).project.document.objects.at(-1)
              ?.type,
        ),
      )
      .toBe("text");
    await page.evaluate(async () => {
      await window.laserx.editorAction({ type: "selection.all" });
    });
    await expect
      .poll(async () =>
        page.evaluate(
          async () =>
            (await window.laserx.getState()).editor.selectionIds.length,
        ),
      )
      .toBe(1);
    const rejectedLiveUpdate = await page.evaluate(async () => {
      const state = await window.laserx.getState();
      const object = state.project.document.objects.at(-1);
      if (object?.type !== "text") {
        throw new Error("Expected selected text.");
      }
      return window.laserx.updateSelectedText({
        fontId: object.style.fontId,
        content: object.content,
        sizeMm: object.style.sizeMm,
        trackingMm: object.style.trackingMm,
        wordSpacingMm: object.style.wordSpacingMm,
        lineSpacing: object.style.lineSpacing,
        alignment: object.style.alignment,
        arc: object.arc,
        mode: "live",
      });
    });
    expect(rejectedLiveUpdate).toMatchObject({
      ok: false,
      error:
        "Live editing is paused until the font substitution is explicitly confirmed.",
    });
    await expect(page.getByTestId("missing-font-warning")).toBeVisible();
    await page.waitForTimeout(800);

    const unchanged = await page.evaluate(async () => {
      const state = await window.laserx.getState();
      const object = state.project.document.objects.at(-1);
      return {
        dirty: state.dirty,
        undoDepth: state.editor.history.undoDepth,
        fingerprint:
          object?.type === "text" ? object.style.fontFingerprint : "",
        contours:
          object?.type === "text" ? JSON.stringify(object.contours) : "",
      };
    });
    expect(unchanged).toEqual({
      dirty: false,
      undoDepth: 0,
      fingerprint: "f".repeat(64),
      contours: preservedContours,
    });

    await page
      .getByTestId("font-family")
      .selectOption("bundled:noto-serif");
    await page.getByTestId("update-text").click();
    await expect
      .poll(async () =>
        page.evaluate(async (originalContours) => {
          const state = await window.laserx.getState();
          const object = state.project.document.objects.at(-1);
          return {
            dirty: state.dirty,
            undoDepth: state.editor.history.undoDepth,
            substituted:
              object?.type === "text" &&
              object.style.fontFingerprint !== "f".repeat(64),
            contoursChanged:
              object?.type === "text" &&
              JSON.stringify(object.contours) !== originalContours,
          };
        }, preservedContours),
      )
      .toMatchObject({
        dirty: true,
        undoDepth: 1,
        substituted: true,
        contoursChanged: true,
      });

    await page.getByTestId("undo").click();
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const state = await window.laserx.getState();
          const object = state.project.document.objects.at(-1);
          return {
            dirty: state.dirty,
            fingerprint:
              object?.type === "text"
                ? object.style.fontFingerprint
                : "",
            contours:
              object?.type === "text"
                ? JSON.stringify(object.contours)
                : "",
          };
        }),
      )
      .toEqual({
        dirty: false,
        fingerprint: "f".repeat(64),
        contours: preservedContours,
      });
  } finally {
    await killAndRemove(reopened);
  }
});

test("undo synchronizes the selected text form before the next edit", async () => {
  const launched = await launchPackaged();
  try {
    const page = await launched.electronApp.firstWindow();
    await expect
      .poll(() => page.getByTestId("font-family").locator("option").count())
      .toBeGreaterThanOrEqual(6);
    const fontSelect = page.getByTestId("font-family");
    const originalFontId = await fontSelect.inputValue();

    await page.getByTestId("text-content").fill("Original text");
    await page.getByTestId("create-text").click();
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const object = (await window.laserx.getState()).project.document.objects.at(-1);
          return object?.type === "text" ? object.content : object?.type;
        }),
      )
      .toBe("Original text");

    await page.getByTestId("text-content").fill("Replacement text");
    await fontSelect.selectOption("bundled:noto-serif");
    await page.getByTestId("update-text").click();
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const object = (await window.laserx.getState()).project.document.objects.at(-1);
          return object?.type === "text"
            ? `${object.content}:${object.style.fontId}`
            : object?.type;
        }),
      )
      .toBe("Replacement text:bundled:noto-serif");

    await page.getByTestId("undo").click();
    await expect(page.getByTestId("text-content")).toHaveValue("Original text");
    await expect(fontSelect).toHaveValue(originalFontId);
    const restoredHistory = await page.evaluate(async () =>
      (await window.laserx.getState()).editor.history,
    );
    await page.waitForTimeout(500);
    expect(
      await page.evaluate(async () =>
        (await window.laserx.getState()).editor.history,
      ),
    ).toEqual(restoredHistory);

    await page.getByLabel("Tracking (mm)").fill("1.25");
    await page.getByTestId("update-text").click();
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const object = (await window.laserx.getState()).project.document.objects.at(-1);
          return object?.type === "text"
            ? {
                content: object.content,
                fontId: object.style.fontId,
                trackingMm: object.style.trackingMm,
              }
            : null;
        }),
      )
      .toEqual({
        content: "Original text",
        fontId: originalFontId,
        trackingMm: 1.25,
      });
  } finally {
    await killAndRemove(launched);
  }
});
