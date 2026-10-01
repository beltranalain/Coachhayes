"use client";

// Root error boundary — catches errors in the root layout itself. Must render
// its own <html>/<body>. Prevents the blank "missing required error components".
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0b0b0c", color: "#f4f4f5" }}>
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          <div style={{ maxWidth: 440 }}>
            <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ opacity: 0.7, marginBottom: 20 }}>The app hit an unexpected error. Please try again.</p>
            <button onClick={() => reset()} style={{ background: "#C8A96B", color: "#1a1205", border: "none", borderRadius: 980, padding: "10px 22px", fontWeight: 600, cursor: "pointer" }}>
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
