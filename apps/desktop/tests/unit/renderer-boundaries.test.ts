import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("renderer editing boundaries", () => {
  it("routes React editing through editor actions without document mutation", async () => {
    const sources = await Promise.all(
      ["src/app/App.tsx", "src/components/Viewport.tsx"].map((file) =>
        readFile(resolve(process.cwd(), file), "utf8"),
      ),
    );
    const combined = sources.join("\n");
    expect(combined).toContain("editorAction");
    expect(combined).not.toMatch(
      /document\.(?:objects|layers|guides)\s*=/u,
    );
    expect(combined).not.toMatch(
      /document\.(?:objects|layers|guides)\.(?:push|splice|sort)\(/u,
    );
    expect(combined).not.toContain("applyEditorCommand");
  });

  it("routes AI work through typed preload commands without renderer network or credentials", async () => {
    const source = await readFile(
      resolve(process.cwd(), "src/components/AiGenerationPanel.tsx"),
      "utf8",
    );
    expect(source).toContain("window.laserx.generateAiConcepts");
    expect(source).toContain("window.laserx.connectAi");
    expect(source).not.toMatch(/\bfetch\s*\(/u);
    expect(source).not.toContain("Authorization");
    expect(source).not.toMatch(/apiKey\s*[:=]/u);
    expect(source).not.toMatch(/credential\s*[:=]/u);
  });
});
