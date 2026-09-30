"use client";

import { useEffect, useState, type ReactNode } from "react";
import Shell from "./Shell";

// Thin wrapper: fetches branding for the sidebar and renders the Control Room
// shell. Pages pass the mock's markup as children. Interactivity/data wiring is
// added per page after the visuals match the mock.
export default function AdminPage({ title, sub, actions, children }: { title: string; sub?: string; actions?: ReactNode; children: ReactNode }) {
  const [brand, setBrand] = useState({ name: "Coach Hayes Football", logo: "" });
  useEffect(() => {
    fetch("/api/site-config", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d?.branding) setBrand({ name: d.branding.siteName || "Coach Hayes Football", logo: d.branding.logo || "" }); })
      .catch(() => {});
  }, []);
  return <Shell title={title} sub={sub} actions={actions} brandName={brand.name} logo={brand.logo}>{children}</Shell>;
}
