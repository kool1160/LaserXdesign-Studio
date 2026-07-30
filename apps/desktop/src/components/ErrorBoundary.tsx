import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = { failed: false };

  public static getDerivedStateFromError(): State {
    return { failed: true };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Renderer error boundary", error.message, info.componentStack);
  }

  public override render(): ReactNode {
    if (this.state.failed) {
      return (
        <main className="fatal-error" role="alert">
          <span className="eyebrow">LaserX Design Studio</span>
          <h1>The desktop shell could not render.</h1>
          <p>Your project files were not changed. Restart the application.</p>
        </main>
      );
    }
    return this.props.children;
  }
}
