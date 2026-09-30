"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/hayes/admin/Shell";

// Members — read-only view of the REAL configured membership tiers from
// /api/hayes-content (content.membership). Live member counts / MRR / churn need
// Stripe subscriptions, which aren't connected yet, so we show an honest amber
// note instead of any fake KPI numbers.
type Tier = {
  key: string;
  name: string;
  who: string;
  price: string;
  priceSuffix: string;
  feeline: string;
  features: string[];
  highlight: boolean;
  disabled: boolean;
};
type Membership = { heading: string; intro: string; tiers: Tier[] };

export default function MembersAdmin() {
  const [brand, setBrand] = useState({ name: "Coach Hayes Football", logo: "" });
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/site-config", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (d?.branding) setBrand({ name: d.branding.siteName || "Coach Hayes Football", logo: d.branding.logo || "" }); }).catch(() => {});
    fetch("/api/hayes-content", { cache: "no-store" }).then((r) => r.json()).then((d) => { setMembership(d?.content?.membership || null); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const tiers = membership?.tiers ?? [];

  return (
    <Shell title="Members" sub={tiers.length ? `${tiers.length} tier${tiers.length === 1 ? "" : "s"} configured` : "Configured in Content"} brandName={brand.name} logo={brand.logo}>
      <div className="card">
        <h3>Membership tiers</h3>
        <p className="cs">The tiers shown on the public site, read from your Content settings.</p>
        {loading ? (
          <div className="note" style={{ margin: 0 }}>Loading…</div>
        ) : tiers.length === 0 ? (
          <div className="note" style={{ margin: 0 }}>No membership tiers configured yet. Set them up in Content and they’ll appear here and on the public page.</div>
        ) : (
          <div className="tbwrap" style={{ marginTop: 12 }}><table>
            <thead><tr><th>Tier</th><th>Price</th><th>Who it’s for</th><th>What’s included</th><th>Status</th></tr></thead>
            <tbody>
              {tiers.map((t) => (
                <tr key={t.key}>
                  <td><b>{t.name}</b>{t.highlight && <span className="pill ok" style={{ marginLeft: 8 }}>Featured</span>}</td>
                  <td>{t.price}{t.priceSuffix ? <span className="muted"> {t.priceSuffix}</span> : null}</td>
                  <td className="muted">{t.who}</td>
                  <td className="muted">{(t.features || []).length} feature{(t.features || []).length === 1 ? "" : "s"}</td>
                  <td>{t.disabled ? <span className="pill warn">Checkout off</span> : <span className="pill ok">Live</span>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      <div className="card">
        <h3>Member counts & revenue</h3>
        <p className="cs">This is where paying-member counts, monthly recurring revenue, and churn will live.</p>
        <div className="note" style={{ margin: 0, borderLeftColor: "var(--amber)" }}>
          <b>Stripe isn’t connected yet.</b> Live member counts, MRR, and churn appear here once Stripe subscriptions are connected. No member numbers are shown until then.
        </div>
        <Link href="/membership" target="_blank" className="link" style={{ marginTop: 14, display: "inline-block" }}>View the public membership page →</Link>
      </div>
    </Shell>
  );
}
