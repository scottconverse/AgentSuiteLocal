import React from "react";

/**
 * A-5: React ErrorBoundary — catches unhandled exceptions in child components
 * and shows a recovery UI instead of blanking the entire screen.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeView />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component {
  state = { error: null, info: null };

  static getDerivedStateFromError(err) {
    return { error: err };
  }

  componentDidCatch(err, info) {
    console.error("AgentSuiteLocal UI Error:", err, info?.componentStack);
    this.setState({ info });
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 16,
          padding: 32,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-3)", maxWidth: 400, lineHeight: 1.6 }}>
            {this.state.error?.message || "An unexpected error occurred in this view."}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-sm btn-accent"
              onClick={() => this.setState({ error: null, info: null })}
            >
              Retry
            </button>
            <button
              className="btn btn-sm"
              onClick={() => window.location.reload()}
            >
              Reload app
            </button>
          </div>
          {import.meta.env?.DEV && this.state.info && (
            <details style={{ marginTop: 16, textAlign: "left", maxWidth: 600, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}>
              <summary style={{ cursor: "pointer", marginBottom: 6 }}>Stack trace (dev only)</summary>
              <pre style={{ overflow: "auto", maxHeight: 200, padding: 8, background: "var(--bg-tint)", borderRadius: 6 }}>
                {this.state.info.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
