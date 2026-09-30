"use client";

import { useEffect, useState } from "react";
import Shell from "./Shell";

// Temporary page for admin sections still being built to the mock. Renders in
// the real Control Room shell so the nav + design stay consistent.
export default function Placeholder({ title, note }: { title: string; note?: string }) {
  const [brand, setBrand] = useState<{ name: string; logo: string }>({ name: "Coach Hayes Football", logo: "" });
  useEffect(() => {
    fetch("/api/site-config", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d?.branding) setBrand({ name: d.branding.siteName || "Coach Hayes Football", logo: d.branding.logo || "" }); })
      .catch(() => {});
  }, []);
  return (
    <Shell title={title} sub="Building this section to the approved mock." brandName={brand.name} logo={brand.logo}>
      <div className="card" style={{ textAlign: "center", padding: "56px 30px" }}>
        <h3 style={{ marginBottom: 8 }}>{title} is next</h3>
        <p style={{ color: "var(--sub)", maxWidth: "48ch", margin: "0 auto" }}>
          {note || "This page is being rebuilt to match the admin mock, wired to the real engine. The nav and design are already in place."}
        </p>
      </div>
    </Shell>
  );
}
