"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/hayes/admin/Shell";

// Email list — no email backend yet. No fake subscriber counts: an honest
// placeholder that the list and go-live reminders populate once an email
// provider is connected.
export default function EmailAdmin() {
  const [brand, setBrand] = useState({ name: "Coach Hayes Football", logo: "" });

  useEffect(() => {
    fetch("/api/site-config", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (d?.branding) setBrand({ name: d.branding.siteName || "Coach Hayes Football", logo: d.branding.logo || "" }); }).catch(() => {});
  }, []);

  return (
    <Shell title="Email list" sub="Not connected yet" brandName={brand.name} logo={brand.logo}>
      <div className="card">
        <h3>The list you own</h3>
        <p className="cs">A subscriber list you own outright, plus go-live reminders sent to the people following each show.</p>
        <div className="note" style={{ margin: 0, borderLeftColor: "var(--amber)" }}>
          <b>No email provider connected yet.</b> Once one is linked, your subscriber list and per-show go-live reminders will populate here. No subscriber numbers are shown until then.
        </div>
      </div>
    </Shell>
  );
}
