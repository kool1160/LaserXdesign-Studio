import { describe, expect, it } from "vitest";

import {
  classifyPrivilegedSender,
  isAllowedRendererUrl,
  type TrustedWindow,
} from "../../electron/privileged-sender.js";

const PACKAGED_URL = "file:///C:/Program%20Files/LaserX/resources/app.asar/renderer/index.html";
const DEV_URL = "http://127.0.0.1:5173";

function windowWith(url: string): {
  window: TrustedWindow;
  mainFrame: { url: string };
} {
  const mainFrame = { url };
  const window: TrustedWindow = {
    webContents: { mainFrame },
    isDestroyed: () => false,
  };
  return { window, mainFrame };
}

describe("isAllowedRendererUrl", () => {
  it("accepts the packaged renderer entry point", () => {
    expect(isAllowedRendererUrl(PACKAGED_URL, undefined)).toBe(true);
  });

  it("rejects another file:// path", () => {
    expect(
      isAllowedRendererUrl("file:///C:/Users/someone/evil.html", undefined),
    ).toBe(false);
  });

  it("accepts the configured dev server origin", () => {
    expect(isAllowedRendererUrl(`${DEV_URL}/index.html`, DEV_URL)).toBe(true);
  });

  it("rejects a remote origin even when a dev server is configured", () => {
    expect(isAllowedRendererUrl("https://evil.test/index.html", DEV_URL)).toBe(false);
  });

  it("rejects a lookalike host that merely starts with the dev origin", () => {
    // A prefix check would wrongly accept this.
    expect(
      isAllowedRendererUrl("http://127.0.0.1:5173.evil.test/index.html", DEV_URL),
    ).toBe(false);
  });

  it("rejects any http origin when no dev server is configured", () => {
    expect(isAllowedRendererUrl(`${DEV_URL}/index.html`, undefined)).toBe(false);
  });
});

describe("classifyPrivilegedSender", () => {
  it("accepts the main frame of the expected window", () => {
    const { window, mainFrame } = windowWith(PACKAGED_URL);

    expect(
      classifyPrivilegedSender(
        { sender: window.webContents, senderFrame: mainFrame },
        window,
        undefined,
      ),
    ).toBeNull();
  });

  it("rejects a same-window subframe, which shares the parent's WebContents", () => {
    const { window } = windowWith(PACKAGED_URL);
    const subframe = { url: "https://embedded.test/frame.html" };

    // The sender (WebContents) matches exactly -- only the frame identity
    // distinguishes this from a legitimate request.
    expect(
      classifyPrivilegedSender(
        { sender: window.webContents, senderFrame: subframe },
        window,
        undefined,
      ),
    ).toBe("not-main-frame");
  });

  it("rejects a different window's WebContents", () => {
    const { window } = windowWith(PACKAGED_URL);
    const other = windowWith(PACKAGED_URL);

    expect(
      classifyPrivilegedSender(
        { sender: other.window.webContents, senderFrame: other.mainFrame },
        window,
        undefined,
      ),
    ).toBe("wrong-web-contents");
  });

  it("rejects the main frame once it has been navigated off the allowlisted URL", () => {
    const { window, mainFrame } = windowWith("https://evil.test/index.html");

    expect(
      classifyPrivilegedSender(
        { sender: window.webContents, senderFrame: mainFrame },
        window,
        undefined,
      ),
    ).toBe("disallowed-url");
  });

  it("rejects a null sender frame", () => {
    const { window } = windowWith(PACKAGED_URL);

    expect(
      classifyPrivilegedSender(
        { sender: window.webContents, senderFrame: null },
        window,
        undefined,
      ),
    ).toBe("not-main-frame");
  });

  it("rejects when there is no window or it has been destroyed", () => {
    const { window, mainFrame } = windowWith(PACKAGED_URL);
    const destroyed: TrustedWindow = {
      webContents: window.webContents,
      isDestroyed: () => true,
    };

    expect(
      classifyPrivilegedSender({ sender: window.webContents, senderFrame: mainFrame }, null, undefined),
    ).toBe("no-window");
    expect(
      classifyPrivilegedSender(
        { sender: window.webContents, senderFrame: mainFrame },
        destroyed,
        undefined,
      ),
    ).toBe("no-window");
  });
});
