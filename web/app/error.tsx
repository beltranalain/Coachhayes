"use client";

import { useEffect } from "react";
import Link from "next/link";

// App-level error boundary. Without this, a runtime error in any route shows
// Next's cryptic "missing required error components" blank screen in dev.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="hz" style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: "60px 20px" }}>
      <div className="card center" style={{ maxWidth: 460 }}>
        <h2 style={{ marginBottom: 8 }}>Something went sideways</h2>
        <p style={{ color: "var(--sub)", marginBottom: 20 }}>
          This page hit an error. Try again — if it keeps happening, head back to the home page.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="pill" onClick={() => reset()}>Try again</button>
          <Link className="pill soft" href="/">Go home</Link>
        </div>
      </div>
    </div>
  );
}
