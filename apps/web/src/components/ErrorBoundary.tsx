import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Keeps an unexpected render error from blanking the whole page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("AfterCare hit an unexpected error:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "var(--sp8) var(--sp4)" }}>
        <h1>Something went wrong on this screen</h1>
        <p className="gloss measure">
          Your saved documents are safe. Reloading usually clears this up.
        </p>
        <div className="flex" style={{ marginTop: "var(--sp4)", flexWrap: "wrap" }}>
          <button className="btn btn-solid" onClick={() => window.location.reload()}>
            Reload
          </button>
          <button
            className="btn btn-outline"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            Go home
          </button>
        </div>
      </div>
    );
  }
}
