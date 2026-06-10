import React from "react";

interface State {
  error: Error | null;
}

/**
 * Catches render-time errors so a thrown exception shows a readable message
 * inside the panel instead of blanking the whole webview (which previously
 * forced an unload/reload). Also surfaces the error text for debugging.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Brand Layout crashed:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="crash">
          <div className="crash-title">Something went wrong</div>
          <pre className="crash-msg">{this.state.error.message}</pre>
          <button
            className="btn-secondary"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
