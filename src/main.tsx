import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import "./styles.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL || import.meta.env.CONVEX_URL;
if (!convexUrl) {
  // eslint-disable-next-line no-console
  console.error(
    "Missing CONVEX_URL. Ensure .env.local contains CONVEX_URL and is loaded as VITE_CONVEX_URL or CONVEX_URL.",
  );
}

const client = new ConvexReactClient(
  (convexUrl as string) || "https://example.invalid",
);

// Show unhandled errors on screen (helps remote debugging).
window.addEventListener("error", (e) => {
  // eslint-disable-next-line no-console
  console.error("window.error", e.error || e.message);
});
window.addEventListener("unhandledrejection", (e) => {
  // eslint-disable-next-line no-console
  console.error("unhandledrejection", e.reason);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexProvider client={client}>
      <BrowserRouter>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </BrowserRouter>
    </ConvexProvider>
  </React.StrictMode>,
);
