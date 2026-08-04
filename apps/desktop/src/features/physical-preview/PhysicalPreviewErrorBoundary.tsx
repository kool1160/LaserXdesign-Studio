import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  onClose: () => void;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * `Suspense` catches a *pending* dynamic import, but not a *rejected* one --
 * a missing or corrupt preview chunk, or any runtime error while rendering
 * the scene, throws during render and would otherwise propagate to the
 * app's root `ErrorBoundary`, replacing the entire editor with its fatal
 * "restart the application" shell over a failure that only ever affects the
 * optional 3D preview.
 *
 * This boundary is local to the physical preview subtree: a failure here
 * only closes the preview. Normal 2D editing and saving remain available,
 * and nothing in the project is touched.
 */
export class PhysicalPreviewErrorBoundary extends Component<Props, State> {
  public override state: State = { failed: false };

  public static getDerivedStateFromError(): State {
    return { failed: true };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Physical preview error boundary", error.message, info.componentStack);
  }

  public override render(): ReactNode {
    if (this.state.failed) {
      return (
        <div className="physical-preview-fallback" role="alert" data-testid="physical-preview-crashed">
          <h2>3D preview could not load</h2>
          <p>
            The physical preview chunk failed to load or render. Nothing in
            the project was changed, and normal editing and saving remain
            available.
          </p>
          <button type="button" onClick={this.props.onClose}>
            Close preview
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
