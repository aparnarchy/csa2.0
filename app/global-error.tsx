"use client";

/**
 * Last-resort error page, for a crash in the root layout itself (every other
 * screen has app/(app)/error.tsx). It replaces the whole document, so it
 * carries its own <html>/<body> and plain inline styles — nothing here may
 * depend on the app's stylesheet or components having loaded.
 */
import { COPY } from "@/lib/copy";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const button = {
    display: "block",
    width: "100%",
    marginTop: 10,
    padding: "14px 0",
    borderRadius: 16,
    border: 0,
    fontSize: 14,
    fontWeight: 800,
    textAlign: "center" as const,
    textDecoration: "none",
    cursor: "pointer",
  };
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#eae8ff", fontFamily: "-apple-system, Helvetica, Arial, sans-serif" }}>
        <div style={{ maxWidth: 420, margin: "0 auto", minHeight: "100dvh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 24px", textAlign: "center" }}>
          <h1 style={{ color: "#7c6fff", fontSize: 24, fontWeight: 900, margin: 0 }}>{COPY.shared.errorTitle}</h1>
          <p style={{ color: "#7a7a96", fontSize: 14, lineHeight: 1.5, marginTop: 8 }}>{COPY.shared.errorBody}</p>
          <button type="button" onClick={reset} style={{ ...button, marginTop: 24, background: "#7c6fff", color: "#fff" }}>
            {COPY.shared.errorRetry}
          </button>
          <a href="/dashboard" style={{ ...button, background: "#f0eeff", color: "#7c6fff" }}>
            {COPY.shared.errorHome}
          </a>
        </div>
      </body>
    </html>
  );
}
