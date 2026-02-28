import React from "react";

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: undefined };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Mission Control UI error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, fontFamily: "system-ui" }}>
          <h2>Mission Control crashed</h2>
          <p style={{ opacity: 0.8 }}>
            Something went wrong in the UI. Refreshing may help.
          </p>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "#fff",
              border: "1px solid #e7dfd3",
              padding: 12,
              borderRadius: 12,
            }}
          >
            {String(
              `${this.state.error?.name || "Error"}: ${this.state.error?.message || "(no message)"}` +
                "\n\n" +
                (this.state.error?.stack || "(no stack)"),
            )}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}
