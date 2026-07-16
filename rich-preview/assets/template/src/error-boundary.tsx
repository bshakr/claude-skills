import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="preview-shell">
          <div className="hub-error">
            <p className="eyebrow">Rich Preview</p>
            <h1>This report failed to render</h1>
            <pre>{this.state.error.message}</pre>
            <a href="/">Back to all reports</a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
