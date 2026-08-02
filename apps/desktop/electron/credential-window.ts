import type { BrowserWindow as BrowserWindowType, IpcMainEvent } from "electron";
import { BrowserWindow, ipcMain } from "electron";

import {
  CredentialAcquisitionCancelledError,
  type CredentialAcquisitionPort,
} from "./ai-credentials.js";
import { CREDENTIAL_WINDOW_CHANNELS } from "./credential-window-contract.js";

const CREDENTIAL_WINDOW_HTML = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Secure OpenAI connection</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, "Segoe UI Variable", "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: #071019; color: #f6f8fb; }
      main { min-height: 100vh; padding: 28px; display: grid; gap: 18px; align-content: center; }
      .brand { color: #49b9f2; font-size: 13px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
      h1 { margin: 0; font-size: 22px; }
      p { margin: 0; color: #c7d2dc; line-height: 1.5; }
      form { display: grid; gap: 14px; }
      label { display: grid; gap: 7px; color: #c7d2dc; font-size: 13px; font-weight: 700; }
      input { width: 100%; min-height: 40px; padding: 8px 10px; color: #f6f8fb; background: #142638; border: 1px solid #3a6e8c; border-radius: 2px; }
      input:focus, button:focus { outline: 2px solid #9bdcff; outline-offset: 2px; }
      .actions { display: flex; justify-content: flex-end; gap: 10px; }
      button { min-height: 36px; padding: 8px 14px; border: 1px solid #3a6e8c; border-radius: 2px; background: #142638; color: #f6f8fb; font-weight: 700; }
      button[type="submit"] { background: #49b9f2; border-color: #49b9f2; color: #071019; }
      #credential-error { min-height: 20px; color: #ffb4ab; font-size: 13px; }
      small { color: #9caebe; line-height: 1.45; }
    </style>
  </head>
  <body>
    <main data-testid="credential-dialog">
      <span class="brand">LaserX Design Studio</span>
      <h1 id="credential-heading">Connect OpenAI securely</h1>
      <p id="credential-description">Enter the dedicated API key for this computer. LaserX sends it directly to the protected main-process connection boundary and encrypts it with Windows.</p>
      <form id="credential-form" aria-labelledby="credential-heading" aria-describedby="credential-description credential-error">
        <label>
          OpenAI API key
          <input id="credential-input" data-testid="credential-input" type="password" autocomplete="off" spellcheck="false" minlength="20" maxlength="4096" required autofocus>
        </label>
        <div id="credential-error" data-testid="credential-error" role="alert" aria-live="assertive"></div>
        <div class="actions">
          <button id="credential-cancel" data-testid="credential-cancel" type="button">Cancel</button>
          <button data-testid="credential-submit" type="submit">Test and store key</button>
        </div>
      </form>
      <small>The key is never added to the project, normal LaserX renderer state, logs, diagnostics, or crash data. Press Escape to cancel.</small>
    </main>
  </body>
</html>`;

export interface ApplicationCredentialAcquisitionOptions {
  parentWindow: () => BrowserWindowType | null;
  preloadPath: string;
}

function validCredential(value: unknown): value is string {
  return typeof value === "string" &&
    value.length >= 20 &&
    value.length <= 4_096 &&
    !/[\r\n]/u.test(value);
}

export class ApplicationCredentialAcquisition implements CredentialAcquisitionPort {
  readonly #parentWindow: () => BrowserWindowType | null;
  readonly #preloadPath: string;

  public constructor(options: ApplicationCredentialAcquisitionOptions) {
    this.#parentWindow = options.parentWindow;
    this.#preloadPath = options.preloadPath;
  }

  public acquire(
    providerName: string,
    replacing: boolean,
    signal: AbortSignal,
  ): Promise<string | null> {
    return new Promise((resolveCredential, rejectCredential) => {
      if (signal.aborted) {
        rejectCredential(new CredentialAcquisitionCancelledError());
        return;
      }
      const parent = this.#parentWindow();
      if (parent === null || parent.isDestroyed()) {
        rejectCredential(new Error("The LaserX window is unavailable for secure credential entry."));
        return;
      }
      const credentialWindow = new BrowserWindow({
        parent,
        modal: true,
        width: 560,
        height: 430,
        useContentSize: true,
        show: false,
        resizable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        autoHideMenuBar: true,
        title: replacing
          ? `Replace ${providerName} key securely`
          : `Connect ${providerName} securely`,
        backgroundColor: "#071019",
        webPreferences: {
          preload: this.#preloadPath,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: true,
          allowRunningInsecureContent: false,
          webviewTag: false,
          devTools: false,
          spellcheck: false,
        },
      });
      credentialWindow.setMenu(null);
      credentialWindow.setAlwaysOnTop(true, "modal-panel");
      credentialWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

      let settled = false;
      const removeListeners = (): void => {
        ipcMain.off(CREDENTIAL_WINDOW_CHANNELS.submit, onSubmit);
        ipcMain.off(CREDENTIAL_WINDOW_CHANNELS.cancel, onCancel);
        signal.removeEventListener("abort", onAbort);
      };
      const finish = (action: () => void): void => {
        if (settled) return;
        settled = true;
        removeListeners();
        if (!credentialWindow.isDestroyed()) credentialWindow.destroy();
        action();
      };
      const belongsToCredentialWindow = (event: IpcMainEvent): boolean =>
        !credentialWindow.isDestroyed() && event.sender === credentialWindow.webContents;
      const onSubmit = (event: IpcMainEvent, value: unknown): void => {
        if (!belongsToCredentialWindow(event)) return;
        if (!validCredential(value)) {
          credentialWindow.webContents.send(
            CREDENTIAL_WINDOW_CHANNELS.validationError,
            "Enter one key between 20 and 4,096 characters without line breaks.",
          );
          return;
        }
        finish(() => resolveCredential(value.trim()));
      };
      const onCancel = (event: IpcMainEvent): void => {
        if (!belongsToCredentialWindow(event)) return;
        finish(() => rejectCredential(new CredentialAcquisitionCancelledError()));
      };
      const onAbort = (): void => {
        finish(() => rejectCredential(new CredentialAcquisitionCancelledError()));
      };
      ipcMain.on(CREDENTIAL_WINDOW_CHANNELS.submit, onSubmit);
      ipcMain.on(CREDENTIAL_WINDOW_CHANNELS.cancel, onCancel);
      signal.addEventListener("abort", onAbort, { once: true });
      credentialWindow.once("closed", () => {
        finish(() => rejectCredential(new CredentialAcquisitionCancelledError()));
      });
      credentialWindow.once("ready-to-show", () => {
        if (settled || credentialWindow.isDestroyed()) return;
        if (parent.isMinimized()) parent.restore();
        parent.show();
        parent.focus();
        credentialWindow.show();
        credentialWindow.moveTop();
        credentialWindow.focus();
      });
      void credentialWindow
        .loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(CREDENTIAL_WINDOW_HTML)}`)
        .catch((error: unknown) => {
          finish(() => rejectCredential(new Error(
            "The application-owned secure credential window could not be opened.",
            { cause: error },
          )));
        });
    });
  }
}
