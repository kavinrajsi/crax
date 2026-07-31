"use client"

import { useEffect } from "react"

/**
 * Last resort — catches failures in the root layout itself, which the (app)
 * group's error.js sits inside of and therefore cannot catch. It replaces the
 * whole document, so it must render its own <html> and <body> and cannot use
 * any styling that depends on the root layout.
 */
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error("[app] global error", error?.digest ?? "", error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", minHeight: "100svh", gap: "1rem", margin: 0,
          fontFamily: "system-ui, sans-serif", background: "#0a0a0a", color: "#ededed",
        }}
      >
        <h1 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: "0.875rem", opacity: 0.7, margin: 0 }}>
          The application failed to start.
        </p>
        {error?.digest && (
          <p style={{ fontSize: "0.75rem", opacity: 0.4, margin: 0, fontFamily: "monospace" }}>
            ref: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            padding: "0.5rem 1rem", borderRadius: "0.5rem", border: "1px solid #333",
            background: "#ededed", color: "#0a0a0a", cursor: "pointer", fontSize: "0.875rem",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
