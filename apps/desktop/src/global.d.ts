import type { LaserxDesktopApi } from "../electron/ipc-contract.js";

declare global {
  interface Window {
    laserx: LaserxDesktopApi;
  }
}

export {};
