import { ipcRenderer } from "electron";

import { CREDENTIAL_WINDOW_CHANNELS } from "./credential-window-contract.js";

function requiredElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`Missing secure credential control: ${id}`);
  return element;
}

window.addEventListener("DOMContentLoaded", () => {
  const form = requiredElement("credential-form") as HTMLFormElement;
  const input = requiredElement("credential-input") as HTMLInputElement;
  const cancel = requiredElement("credential-cancel") as HTMLButtonElement;
  const error = requiredElement("credential-error") as HTMLDivElement;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    error.textContent = "";
    const value = input.value;
    input.value = "";
    ipcRenderer.send(CREDENTIAL_WINDOW_CHANNELS.submit, value);
  });
  cancel.addEventListener("click", () => {
    input.value = "";
    ipcRenderer.send(CREDENTIAL_WINDOW_CHANNELS.cancel);
  });
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    input.value = "";
    ipcRenderer.send(CREDENTIAL_WINDOW_CHANNELS.cancel);
  });
  ipcRenderer.on(
    CREDENTIAL_WINDOW_CHANNELS.validationError,
    (_event, message: unknown) => {
      error.textContent = typeof message === "string"
        ? message
        : "The key could not be accepted.";
      input.focus();
    },
  );
  input.focus();
});
