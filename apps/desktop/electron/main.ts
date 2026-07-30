import { resolve } from "node:path";

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  type MenuItemConstructorOptions,
} from "electron";

import {
  DesktopController,
  type DesktopDialogs,
  type UnsavedChoice,
} from "./desktop-controller.js";
import {
  IPC_CHANNELS,
  openRecentRequestSchema,
  resolveRecoveryRequestSchema,
  setDisplayUnitRequestSchema,
  type DesktopState,
} from "./ipc-contract.js";

const testUserDataPath = process.env.LASERX_USER_DATA_PATH;
if (testUserDataPath !== undefined) {
  app.setPath("userData", resolve(testUserDataPath));
}

let mainWindow: BrowserWindow | null = null;
let controller: DesktopController | null = null;
let allowClose = false;

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
  ipcMain.handle(IPC_CHANNELS.getState, () => requireController().state);
  ipcMain.handle(IPC_CHANNELS.newProject, () =>
    requireController().newProject(),
  );
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
