import { describe, expect, it } from "vitest";

import {
  bridgeProposalRequestSchema,
  aiGenerateRequestSchema,
  attachAiReferenceRequestSchema,
  cutabilityAnalysisRequestSchema,
  createDocumentRequestSchema,
  desktopStateSchema,
  editorActionRequestSchema,
  fontCatalogSchema,
  openRecentRequestSchema,
  rasterTraceRequestSchema,
  setManufacturingSettingsRequestSchema,
  setDisplayUnitRequestSchema,
  setViewportPreferencesRequestSchema,
  signToolRequestSchema,
  textLayoutRequestSchema,
  vectorExportRequestSchema,
  vectorImportPreviewRequestSchema,
  textUpdateRequestSchema,
} from "../../electron/ipc-contract.js";

describe("typed IPC validation", () => {
  it("keeps vector paths and file contents out of renderer requests", () => {
    expect(
      vectorImportPreviewRequestSchema.safeParse({
        unitlessDxfUnit: "millimeters",
      }).success,
    ).toBe(true);
    expect(
      vectorImportPreviewRequestSchema.safeParse({
        unitlessDxfUnit: "millimeters",
        filePath: "C:\\secret\\sign.dxf",
      }).success,
    ).toBe(false);
    expect(vectorExportRequestSchema.safeParse({ format: "svg" }).success).toBe(true);
    expect(vectorExportRequestSchema.safeParse({ format: "dwg" }).success).toBe(false);
  });

  it("keeps raster paths and pixels out of strict tracing requests", () => {
    const request = {
      operationId: "60000000-0000-4000-8000-000000000071",
      settings: {
        preset: "balanced",
        outputWidthMm: 150,
        crop: { left: 0, top: 0, right: 0, bottom: 0 },
        rotationDeg: 0,
        grayscaleMode: "luminance",
        contrast: 0,
        threshold: 128,
        invert: false,
        blurRadiusPx: 1,
        denoiseRadiusPx: 1,
        background: "auto",
        speckleAreaPx: 6,
        smoothingPasses: 1,
        simplificationToleranceMm: 0.2,
      },
    };
    expect(rasterTraceRequestSchema.safeParse(request).success).toBe(true);
    expect(
      rasterTraceRequestSchema.safeParse({
        ...request,
        filePath: "C:\\private\\logo.png",
      }).success,
    ).toBe(false);
    expect(
      rasterTraceRequestSchema.safeParse({
        ...request,
        pixels: [0, 0, 0, 255],
      }).success,
    ).toBe(false);
    expect(
      rasterTraceRequestSchema.safeParse({
        ...request,
        settings: { ...request.settings, threshold: 300 },
      }).success,
    ).toBe(false);
  });

  it("keeps manufacturing geometry in the trusted host and validates settings", () => {
    const analysisRequest = {
      operationId: "60000000-0000-4000-8000-000000000072",
      objectIds: ["123e4567-e89b-42d3-a456-426614174002"],
    };
    expect(cutabilityAnalysisRequestSchema.safeParse(analysisRequest).success).toBe(true);
    expect(cutabilityAnalysisRequestSchema.safeParse({
      ...analysisRequest,
      document: { objects: [] },
    }).success).toBe(false);
    const analysisScopeSchema = desktopStateSchema.shape.analysis.shape.scope;
    expect(analysisScopeSchema.safeParse({
      kind: "selection",
      layerId: null,
      layerName: null,
      objectIds: analysisRequest.objectIds,
    }).success).toBe(true);
    expect(analysisScopeSchema.safeParse({
      kind: "selection",
      layerId: null,
      layerName: null,
      objectIds: [],
    }).success).toBe(false);
    const bridgeRequest = {
      issueId: "DISCONNECTED_ISLAND:1",
      widthMm: 2,
      mode: "automatic",
    };
    expect(bridgeProposalRequestSchema.safeParse(bridgeRequest).success).toBe(true);
    expect(bridgeProposalRequestSchema.safeParse({
      ...bridgeRequest,
      replacementContours: [],
    }).success).toBe(false);
    expect(setManufacturingSettingsRequestSchema.safeParse({
      settings: {
        presetId: "laser-mild-steel-3mm",
        process: "laser",
        material: "mild-steel",
        thicknessMm: 3,
        kerfWidthMm: -0.2,
        minimumFeatureWidthMm: 1,
        minimumBridgeWidthMm: 2,
        minimumGapMm: 0.8,
        contourSpacingMm: 1,
        heatDistortionSpacingMm: null,
        tolerancePreset: "balanced",
        customizedFields: [],
      },
    }).success).toBe(false);
  });

  it("rejects arbitrary fields, pixels, and invalid viewport values", () => {
    expect(
      setDisplayUnitRequestSchema.safeParse({
        displayUnit: "pixels",
      }).success,
    ).toBe(false);
    expect(
      openRecentRequestSchema.safeParse({
        filePath: "C:\\safe.laserx",
        command: "rm",
      }).success,
    ).toBe(false);
    expect(
      createDocumentRequestSchema.safeParse({
        width: -1,
        height: 12,
        inputUnit: "inches",
      }).success,
    ).toBe(false);
    expect(
      setViewportPreferencesRequestSchema.safeParse({
        gridSpacingMm: 0,
      }).success,
    ).toBe(false);
    expect(
      editorActionRequestSchema.safeParse({
        type: "objects.move",
        objectIds: ["123e4567-e89b-42d3-a456-426614174002"],
        deltaXmm: 1,
        deltaYmm: 2,
        document: { arbitrary: true },
      }).success,
    ).toBe(false);
    expect(
      editorActionRequestSchema.safeParse({
        type: "layer.set-manufacturing",
        layerId: "123e4567-e89b-42d3-a456-426614174002",
        manufacturing: {
          role: "non-cut-preview",
          material: "other",
          thicknessMm: 1,
          process: "laser",
          notes: "Invalid preview process",
          registrationGroup: null,
          registrationHoleIds: [],
        },
      }).success,
    ).toBe(false);
    expect(
      editorActionRequestSchema.safeParse({
        type: "layer.set-manufacturing",
        layerId: "123e4567-e89b-42d3-a456-426614174002",
        manufacturing: {
          role: "face",
          material: "mild-steel",
          thicknessMm: 3,
          process: "laser",
          notes: "",
          registrationGroup: "main",
          registrationHoleIds: [
            "223e4567-e89b-42d3-a456-426614174002",
            "223e4567-e89b-42d3-a456-426614174002",
          ],
        },
      }).success,
    ).toBe(false);
    expect(
      editorActionRequestSchema.safeParse({
        type: "objects.duplicate",
        objectIds: ["123e4567-e89b-42d3-a456-426614174002"],
        idMap: {},
        offsetXmm: 10,
        offsetYmm: 10,
      }).success,
    ).toBe(false);
  });

  it("accepts only a complete renderer document snapshot", () => {
    const result = desktopStateSchema.safeParse({
      project: {
        id: "123e4567-e89b-42d3-a456-426614174000",
        name: "Untitled",
        document: {
          kind: "document",
          id: "123e4567-e89b-42d3-a456-426614174001",
          dimensions: { widthMm: 609.6, heightMm: 304.8 },
          origin: { xMm: 0, yMm: 0 },
          settings: {
            displayUnit: "inches",
            viewport: {
              rulersVisible: true,
              gridVisible: true,
              gridSpacingMm: 12.7,
              snapping: {
                enabled: false,
                snapToGrid: true,
                snapToGuides: true,
                snapToObjects: true,
                snapToDocument: true,
              },
            },
            manufacturing: {
              presetId: "laser-mild-steel-3mm",
              process: "laser",
              material: "mild-steel",
              thicknessMm: 3,
              kerfWidthMm: 0.2,
              minimumFeatureWidthMm: 1,
              minimumBridgeWidthMm: 2,
              minimumGapMm: 0.8,
              contourSpacingMm: 1,
              heatDistortionSpacingMm: null,
              tolerancePreset: "balanced",
              customizedFields: [],
            },
          },
          layers: [
            {
              id: "123e4567-e89b-42d3-a456-426614174002",
              name: "Layer 1",
              visible: true,
              locked: false,
            },
          ],
          activeLayerId: "123e4567-e89b-42d3-a456-426614174002",
          guides: [],
          objects: [],
          templates: [],
        },
      },
      editor: {
        selectionIds: [],
        selectionBounds: null,
        clipboardHasContent: false,
        pathSelection: null,
        topologySummary: null,
        importPreview: null,
        rasterTracePreview: null,
        signToolPreview: null,
        aiConceptPreview: null,
        history: {
          undoDepth: 0,
          redoDepth: 0,
          limit: 100,
          transactionActive: false,
        },
      },
      filePath: null,
      dirty: false,
      recovered: false,
      recentProjects: [],
      recovery: null,
      interchange: { exportSummary: null },
      production: { preview: null, exportSummary: null },
      raster: { job: null, preview: null },
      ai: {
        connection: {
          providerId: "openai",
          providerName: "OpenAI",
          status: "disconnected",
          model: "gpt-5.6-sol",
          message: "Connect a user-owned OpenAI API key to generate concepts.",
          retryAfterMs: null,
        },
        credentialPrompt: { active: false, timeoutMs: 120_000 },
        job: null,
        reference: null,
        concepts: [],
        selectedConceptId: null,
        usage: null,
        estimate: {
          model: "gpt-5.6-sol",
          maxOutputTokens: 6000,
          note: "Provider billing varies by usage.",
        },
      },
      analysis: {
        scope: null,
        job: null,
        focusedIssueId: null,
        bridgeProposal: null,
        cutability: null,
      },
    });
    expect(result.success).toBe(true);
  });

  it("keeps font paths and generated contours outside renderer requests", () => {
    expect(
      textLayoutRequestSchema.safeParse({
        fontId: "bundled:noto-sans",
        content: "LaserX",
        sizeMm: 20,
        trackingMm: 0,
        wordSpacingMm: 0,
        lineSpacing: 1.2,
        alignment: "left",
        arc: null,
        fontPath: "C:\\Windows\\Fonts\\arial.ttf",
      }).success,
    ).toBe(false);
    expect(
      textUpdateRequestSchema.safeParse({
        fontId: "bundled:noto-sans",
        content: "LaserX",
        sizeMm: 20,
        trackingMm: 0,
        wordSpacingMm: 0,
        lineSpacing: 1.2,
        alignment: "left",
        arc: null,
      }).success,
    ).toBe(false);
    expect(
      textUpdateRequestSchema.safeParse({
        fontId: "bundled:noto-sans",
        content: "LaserX",
        sizeMm: 20,
        trackingMm: 0,
        wordSpacingMm: 0,
        lineSpacing: 1.2,
        alignment: "left",
        arc: null,
        mode: "explicit",
      }).success,
    ).toBe(true);
    expect(
      fontCatalogSchema.safeParse([
        {
          id: "bundled:noto-sans",
          family: "Noto Sans",
          style: "Regular",
          source: "bundled",
          categories: ["industrial"],
          fingerprint: "a".repeat(64),
          license: {
            spdx: "OFL-1.1",
            copyright: "Copyright holder",
            licenseFile: "packages/fonts/licenses/OFL-1.1.txt",
            provenance: "@fontsource-variable/noto-sans@5.3.0",
          },
          path: "C:\\secret.ttf",
        },
      ]).success,
    ).toBe(false);
  });

  it("keeps generated sign geometry, IDs, and font paths out of strict parameter requests", () => {
    const request = {
      kind: "template",
      stylePresetId: "industrial-stencil",
      parameters: {
        kind: "address",
        shape: "rounded-rectangle",
        widthMm: 609.6,
        heightMm: 304.8,
        borderWidthMm: 12,
        holeDiameterMm: 6,
        holeInsetMm: 25.4,
        fontId: "bundled:saira-stencil-one",
        fontSizeMm: 42,
        primaryText: "1042",
        secondaryText: "OAK STREET",
        arcRadiusMm: null,
      },
    };
    expect(signToolRequestSchema.safeParse(request).success).toBe(true);
    expect(signToolRequestSchema.safeParse({
      ...request,
      objects: [{ id: "123e4567-e89b-42d3-a456-426614174002" }],
    }).success).toBe(false);
    expect(signToolRequestSchema.safeParse({
      ...request,
      parameters: {
        ...request.parameters,
        contours: [{ points: [{ xMm: 0, yMm: 0 }] }],
        fontPath: "C:\\Windows\\Fonts\\arial.ttf",
      },
    }).success).toBe(false);
  });

  it("keeps AI credentials, reference bytes, and generated geometry out of renderer requests", () => {
    const request = {
      operationId: "70000000-0000-4000-8000-000000000071",
      prompt: "An industrial address sign",
      wording: "1042 OAK STREET",
      widthMm: 609.6,
      heightMm: 304.8,
      style: "industrial",
      process: "laser",
      detailLevel: "balanced",
      bridgePreference: "automatic",
      holes: { enabled: true, diameterMm: 6, insetMm: 25.4 },
      layerCount: 2,
      backingPlate: true,
      conceptCount: 3,
      useReferenceImage: true,
      referenceConsent: true,
    };
    expect(aiGenerateRequestSchema.safeParse(request).success).toBe(true);
    for (const forbidden of [
      { apiKey: "renderer-secret" },
      { credential: "renderer-secret" },
      { referenceImage: { dataUrl: "data:image/png;base64,AAAA" } },
      { objects: [] },
      { provider: { endpoint: "https://example.test" } },
    ]) {
      expect(aiGenerateRequestSchema.safeParse({ ...request, ...forbidden }).success).toBe(false);
    }
    expect(attachAiReferenceRequestSchema.safeParse({ consent: true }).success).toBe(true);
    expect(attachAiReferenceRequestSchema.safeParse({ consent: false }).success).toBe(false);
    expect(attachAiReferenceRequestSchema.safeParse({
      consent: true,
      filePath: "C:\\private\\reference.png",
    }).success).toBe(false);
  });

  it("accepts signed exact coordinates and zero line extents", () => {
    const result = editorActionRequestSchema.safeParse({
      type: "objects.set-bounds",
      objectIds: ["123e4567-e89b-42d3-a456-426614174002"],
      xMm: 0,
      yMm: -25,
      widthMm: 120,
      heightMm: 0,
      lockAspectRatio: false,
    });
    expect(result.success).toBe(true);
    expect(
      editorActionRequestSchema.safeParse({
        type: "objects.set-bounds",
        objectIds: ["123e4567-e89b-42d3-a456-426614174002"],
        widthMm: -1,
        lockAspectRatio: false,
      }).success,
    ).toBe(false);
  });
});
