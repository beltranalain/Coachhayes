"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/hayes/admin/Shell";

// Merch — print-on-demand isn't built yet. No fake products, prices, or orders:
// an honest placeholder that the catalog populates from the POD provider once
// it's connected. Links to the public /shop page.
export default function MerchAdmin() {
  const [brand, setBrand] = useState({ name: "Coach Hayes Football", logo: "" });

  useEffect(() => {
    fetch("/api/site-config", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (d?.branding) setBrand({ name: d.branding.siteName || "Coach Hayes Football", logo: d.branding.logo || "" }); }).catch(() => {});
  }, []);

  return (
    <Shell title="Merch" sub="Print on demand — not connected yet" brandName={brand.name} logo={brand.logo}>
      <div className="card">
        <h3>Products & orders</h3>
        <p className="cs">Printed on demand, checked out on your own domain, with the customer’s email kept by you.</p>
        <div className="note" style={{ margin: 0, borderLeftColor: "var(--amber)" }}>
          <b>The shop isn’t connected yet.</b> Once a print-on-demand provider is linked, your products, pricing, and incoming orders will populate here automatically — nothing is entered by hand. No products, prices, or orders are shown until then.
        </div>
        <Link href="/shop" target="_blank" className="link" style={{ marginTop: 14, display: "inline-block" }}>View the public shop page →</Link>
      </div>
    </Shell>
  );
}
