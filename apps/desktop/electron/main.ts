import { join, resolve } from "node:path";

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  type MenuItemConstructorOptions,
} from "electron";
import {
  bundledFontSources,
  discoverWindowsFontSources,
  FontEngine,
} from "@laserx/fonts";

import {
  DesktopController,
  type DesktopDialogs,
  type UnsavedChoice,
} from "./desktop-controller.js";
import {
  createDocumentRequestSchema,
  editorActionRequestSchema,
  IPC_CHANNELS,
  openRecentRequestSchema,
  resolveRecoveryRequestSchema,
  setDisplayUnitRequestSchema,
  setViewportPreferencesRequestSchema,
  textLayoutRequestSchema,
  textUpdateRequestSchema,
  type DesktopState,
} from "./ipc-contract.js";

const testUserDataPath = process.env.LASERX_USER_DATA_PATH;
if (testUserDataPath !== undefined) {
  app.setPath("userData", resolve(testUserDataPath));
}
const testScaleFactor = process.env.LASERX_TEST_DEVICE_SCALE_FACTOR;
if (testScaleFactor !== undefined) {
  app.commandLine.appendSwitch("force-device-scale-factor", testScaleFactor);
}

let mainWindow: BrowserWindow | null = null;
let controller: DesktopController | null = null;
let allowClose = false;
let rejectNextGetState =
  process.env.LASERX_TEST_GET_STATE_FAILURE === "1";

function emitState(state: DesktopState): void {
  if (mainWindow !== null && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC_CHANNELS.stateChanged, state);
    mainWindow.setTitle(
      `${state.project.name}${state.dirty ? " *" : ""} — LaserX Design Studio`,
    );
  }
}

function testPath(): string | null {
  const value = process.env.LASERX_TEST_PROJECT_PATH;
  return value === undefined ? null : resolve(value);
}

function requireMainWindow(): BrowserWindow {
  if (mainWindow === null || mainWindow.isDestroyed()) {
    throw new Error("The application window is not available.");
  }
  return mainWindow;
}

const dialogs: DesktopDialogs = {
  async chooseOpenProject() {
    const configured = testPath();
    if (configured !== null) {
      return configured;
    }
    const result = await dialog.showOpenDialog(requireMainWindow(), {
      title: "Open LaserX Project",
      properties: ["openFile"],
      filters: [{ name: "LaserX Project", extensions: ["laserx"] }],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  },
  async chooseSaveProject(suggestedName) {
    const configured = testPath();
    if (configured !== null) {
      return configured;
    }
    const result = await dialog.showSaveDialog(requireMainWindow(), {
      title: "Save LaserX Project",
      defaultPath: suggestedName,
      filters: [{ name: "LaserX Project", extensions: ["laserx"] }],
    });
    return result.canceled ? null : result.filePath;
  },
  async confirmUnsavedChanges(projectName) {
    const configured = process.env.LASERX_TEST_CLOSE_RESPONSE;
    if (
      configured === "save" ||
      configured === "discard" ||
      configured === "cancel"
    ) {
      return configured;
    }
    const result = await dialog.showMessageBox(requireMainWindow(), {
      type: "warning",
      title: "Unsaved changes",
      message: `Save changes to ${projectName}?`,
      detail: "Your changes will be lost if you do not save them.",
      buttons: ["Save", "Discard", "Cancel"],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
    });
    const choices: readonly UnsavedChoice[] = ["save", "discard", "cancel"];
    return choices[result.response] ?? "cancel";
  },
};

function requireController(): DesktopController {
  if (controller === null) {
    throw new Error("Desktop lifecycle is not initialized.");
  }
  return controller;
}

function registerIpc(): void {
  ipcMain.handle(IPC_CHANNELS.getState, () => {
    if (rejectNextGetState) {
      rejectNextGetState = false;
      throw new Error("Injected initial state failure.");
    }
    return requireController().state;
  });
  ipcMain.handle(IPC_CHANNELS.newProject, () =>
    requireController().newProject(),
  );
  ipcMain.handle(IPC_CHANNELS.createDocument, (_event, request: unknown) => {
    const validated = createDocumentRequestSchema.parse(request);
    return requireController().createDocument(validated);
  });
  ipcMain.handle(IPC_CHANNELS.openProject, () =>
    requireController().openProject(),
  );
  ipcMain.handle(IPC_CHANNELS.openRecent, (_event, request: unknown) => {
    const validated = openRecentRequestSchema.parse(request);
    return requireController().openRecent(validated.filePath);
  });
  ipcMain.handle(IPC_CHANNELS.saveProject, () =>
    requireController().saveProject(),
  );
  ipcMain.handle(IPC_CHANNELS.saveProjectAs, () =>
    requireController().saveProjectAs(),
  );
  ipcMain.handle(IPC_CHANNELS.setDisplayUnit, (_event, request: unknown) => {
    const validated = setDisplayUnitRequestSchema.parse(request);
    return requireController().setDisplayUnit(validated.displayUnit);
  });
  ipcMain.handle(
    IPC_CHANNELS.setViewportPreferences,
    (_event, request: unknown) => {
      const validated = setViewportPreferencesRequestSchema.parse(request);
      return requireController().setViewportPreferences(validated);
    },
  );
  ipcMain.handle(IPC_CHANNELS.editorAction, (_event, request: unknown) => {
    const validated = editorActionRequestSchema.parse(request);
    return requireController().editorAction(validated);
  });
  ipcMain.handle(IPC_CHANNELS.getFontCatalog, () =>
    requireController().fontCatalog(),
  );
  ipcMain.handle(IPC_CHANNELS.createText, (_event, request: unknown) => {
    const validated = textLayoutRequestSchema.parse(request);
    return requireController().createText(validated);
  });
  ipcMain.handle(
    IPC_CHANNELS.updateSelectedText,
    (_event, request: unknown) => {
      const validated = textUpdateRequestSchema.parse(request);
      return requireController().updateSelectedText(validated);
    },
  );
  ipcMain.handle(IPC_CHANNELS.resolveRecovery, (_event, request: unknown) => {
    const validated = resolveRecoveryRequestSchema.parse(request);
    return requireController().resolveRecovery(validated);
  });
}

function buildMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        {
          label: "New Project",
          accelerator: "CmdOrCtrl+N",
          click: () => void requireController().newProject(),
        },
        {
          label: "Open…",
          accelerator: "CmdOrCtrl+O",
          click: () => void requireController().openProject(),
        },
        { type: "separator" },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: () => void requireController().saveProject(),
        },
        {
          label: "Save As…",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => void requireController().saveProjectAs(),
        },
        { type: "separator" },
        {
          label: "Exit",
          role: "quit",
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        {
          label: "Undo",
          accelerator: "CmdOrCtrl+Z",
          click: () =>
            void requireController().editorAction({ type: "history.undo" }),
        },
        {
          label: "Redo",
          accelerator: "CmdOrCtrl+Y",
          click: () =>
            void requireController().editorAction({ type: "history.redo" }),
        },
        { type: "separator" },
        {
          label: "Copy",
          accelerator: "CmdOrCtrl+C",
          click: () =>
            void requireController().editorAction({ type: "clipboard.copy" }),
        },
        {
          label: "Paste",
          accelerator: "CmdOrCtrl+V",
          click: () =>
            void requireController().editorAction({
              type: "clipboard.paste",
            }),
        },
        {
          label: "Duplicate",
          accelerator: "CmdOrCtrl+D",
          click: () =>
            void requireController().editorAction({
              type: "objects.duplicate-selection",
            }),
        },
        {
          label: "Delete",
          accelerator: "Delete",
          click: () =>
            void requireController().editorAction({
              type: "objects.delete",
              objectIds: requireController().state.editor.selectionIds,
            }),
        },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "toggleDevTools" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    useContentSize: true,
    minWidth: 840,
    minHeight: 600,
    show: false,
    backgroundColor: "#101419",
    webPreferences: {
      preload: resolve(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });
  mainWindow.on("close", (event) => {
    if (allowClose) {
      return;
    }
    event.preventDefault();
    void requireController().confirmClose().then((shouldClose) => {
      if (shouldClose && mainWindow !== null) {
        allowClose = true;
        mainWindow.close();
      }
    });
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());

  controller = new DesktopController({
    userDataPath: app.getPath("userData"),
    dialogs,
    onStateChanged: emitState,
    autosaveIntervalMs: Number(
      process.env.LASERX_AUTOSAVE_INTERVAL_MS ?? 30_000,
    ),
    fontEngine: new FontEngine([
      ...bundledFontSources(),
      ...discoverWindowsFontSources([
        join(process.env.WINDIR ?? "C:\\Windows", "Fonts"),
        ...(process.env.LOCALAPPDATA === undefined
          ? []
          : [join(process.env.LOCALAPPDATA, "Microsoft", "Windows", "Fonts")]),
      ]),
    ]),
  });
  await controller.initialize();

  const developmentUrl = process.env.VITE_DEV_SERVER_URL;
  if (developmentUrl !== undefined) {
    const parsed = new URL(developmentUrl);
    if (
      parsed.protocol !== "http:" ||
      parsed.hostname !== "127.0.0.1" ||
      parsed.port !== "5173"
    ) {
      throw new Error("The development renderer URL is not allowlisted.");
    }
    await mainWindow.loadURL(parsed.toString());
  } else {
    await mainWindow.loadFile(resolve(__dirname, "../renderer/index.html"));
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow !== null) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  void app.whenReady().then(async () => {
    registerIpc();
    buildMenu();
    await createWindow();
  });
}

app.on("before-quit", () => {
  controller?.stop();
});

app.on("window-all-closed", () => {
  app.quit();
});
