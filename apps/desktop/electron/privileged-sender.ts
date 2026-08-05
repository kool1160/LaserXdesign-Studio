/**
 * Trust check for privileged IPC (M14 G5, ADR 0024 section 6).
 *
 * Expressed over minimal structural types rather than Electron classes so the
 * decision itself is unit-testable in Node without launching a browser
 * window -- the alternative is a security check that only ever runs in
 * production.
 */

export interface TrustedSenderFrame {
  readonly url: string;
}

export interface TrustedSenderWebContents {
  readonly mainFrame: TrustedSenderFrame;
}

export interface PrivilegedSenderCandidate {
  readonly sender: unknown;
  readonly senderFrame: TrustedSenderFrame | null;
}

export interface TrustedWindow {
  readonly webContents: TrustedSenderWebContents;
  isDestroyed(): boolean;
}

/**
 * Accepts only the renderer entry point this application itself loaded:
 * the packaged `file://.../renderer/index.html`, or the Vite dev server
 * origin when one is configured.
 */
export function isAllowedRendererUrl(
  url: string,
  developmentUrl: string | undefined,
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol === "file:") {
    return parsed.pathname.toLowerCase().endsWith("/renderer/index.html");
  }

  if (developmentUrl === undefined) return false;
  let allowed: URL;
  try {
    allowed = new URL(developmentUrl);
  } catch {
    return false;
  }
  // Origin comparison, not prefix matching: a prefix test would accept a
  // lookalike host such as `http://127.0.0.1:5173.evil.test`.
  return parsed.origin === allowed.origin;
}

export type PrivilegedSenderRejection =
  | "no-window"
  | "wrong-web-contents"
  | "not-main-frame"
  | "disallowed-url";

/**
 * Returns `null` when the request is trusted, or the reason it is not.
 *
 * Checks three independent properties, because none alone is sufficient:
 *
 * - the request came from the expected `WebContents`;
 * - it came from that contents' **main frame**. `event.sender` identifies the
 *   window, not the frame, and every subframe shares its parent's
 *   `WebContents` -- so a `sender` check alone would accept an embedded
 *   frame;
 * - that frame is showing an allowlisted renderer URL, so even the main
 *   frame cannot reach this path after being navigated somewhere unexpected.
 */
export function classifyPrivilegedSender(
  event: PrivilegedSenderCandidate,
  window: TrustedWindow | null,
  developmentUrl: string | undefined,
): PrivilegedSenderRejection | null {
  if (window === null || window.isDestroyed()) return "no-window";
  if (event.sender !== window.webContents) return "wrong-web-contents";
  if (event.senderFrame === null || event.senderFrame !== window.webContents.mainFrame) {
    return "not-main-frame";
  }
  if (!isAllowedRendererUrl(event.senderFrame.url, developmentUrl)) {
    return "disallowed-url";
  }
  return null;
}
