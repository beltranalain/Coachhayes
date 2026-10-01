"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/hayes/admin/Shell";
import { getIdToken } from "@/lib/firebase";

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
type Member = { uid: string; email: string; name: string; tier: string | null; status: string | null; source: string; createdAt: number };

const TIER_LABEL: Record<string, string> = { coordinator: "The Coordinator", timmy: "Po’ Lil Timmy" };

export default function MembersAdmin() {
  const [brand, setBrand] = useState({ name: "Coach Hayes Football", logo: "" });
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);

  // Manual comp grants (Stripe not connected yet).
  const [members, setMembers] = useState<Member[]>([]);
  const [gEmail, setGEmail] = useState("");
  const [gTier, setGTier] = useState("coordinator");
  const [gBusy, setGBusy] = useState(false);
  const [gMsg, setGMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const authH = async (): Promise<Record<string, string>> => { const t = await getIdToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };
  const loadMembers = useCallback(async () => {
    try { const r = await fetch("/api/admin/members", { headers: await authH(), cache: "no-store" }); const d = await r.json(); setMembers(d.members || []); } catch {}
  }, []);

  useEffect(() => {
    fetch("/api/site-config", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (d?.branding) setBrand({ name: d.branding.siteName || "Coach Hayes Football", logo: d.branding.logo || "" }); }).catch(() => {});
    fetch("/api/hayes-content", { cache: "no-store" }).then((r) => r.json()).then((d) => { setMembership(d?.content?.membership || null); }).catch(() => {}).finally(() => setLoading(false));
    loadMembers();
  }, [loadMembers]);

  async function grant(revoke = false, email = gEmail) {
    if (!email.trim()) { setGMsg({ ok: false, text: "Enter the member’s email." }); return; }
    setGBusy(true); setGMsg(null);
    try {
      const r = await fetch("/api/admin/members", { method: "POST", headers: { "Content-Type": "application/json", ...(await authH()) }, body: JSON.stringify({ email: email.trim(), tier: revoke ? "none" : gTier }) });
      const d = await r.json();
      if (d.ok) { setGMsg({ ok: true, text: revoke ? `Revoked ${email}.` : `${email} is now ${TIER_LABEL[gTier] || gTier}.` }); if (!revoke) setGEmail(""); loadMembers(); }
      else setGMsg({ ok: false, text: d.error || "Could not update." });
    } catch { setGMsg({ ok: false, text: "Could not update." }); } finally { setGBusy(false); }
  }

  const tiers = membership?.tiers ?? [];
  const active = members.filter((m) => m.status === "active");

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
        <h3>Grant a membership</h3>
        <p className="cs">Comp a member into a paid tier by email — this unlocks gated rooms like the Film Room straight away, no card needed. The account must already exist (they’ve signed up). When Stripe is connected, paid subscriptions fill this in automatically.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
          <input className="acc-in" style={{ flex: "1 1 240px", minWidth: 200 }} type="email" placeholder="member@email.com" value={gEmail} onChange={(e) => setGEmail(e.target.value)} />
          <select className="acc-in" style={{ flex: "0 0 auto", width: 180 }} value={gTier} onChange={(e) => setGTier(e.target.value)}>
            <option value="coordinator">The Coordinator</option>
            <option value="timmy">Po’ Lil Timmy</option>
          </select>
          <button className="pill" onClick={() => grant(false)} disabled={gBusy}>{gBusy ? "…" : "Grant"}</button>
        </div>
        {gMsg && <p style={{ color: gMsg.ok ? "var(--green)" : "var(--live)", fontSize: 13, marginTop: 10 }}>{gMsg.text}</p>}
      </div>

      <div className="card">
        <h3>Members</h3>
        <p className="cs">Active members and comps. {active.length ? `${active.length} active.` : "None yet."}</p>
        <div className="note" style={{ margin: "0 0 12px", borderLeftColor: "var(--amber)" }}>
          <b>Stripe isn’t connected yet.</b> Live MRR and churn appear here once subscriptions are connected. Comps you grant above show up in this list.
        </div>
        {members.length > 0 && (
          <div className="tbwrap"><table>
            <thead><tr><th>Member</th><th>Tier</th><th>Status</th><th>Source</th><th></th></tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.uid}>
                  <td><b>{m.name || m.email.split("@")[0]}</b><div className="muted" style={{ fontSize: 12 }}>{m.email}</div></td>
                  <td>{m.tier ? (TIER_LABEL[m.tier] || m.tier) : <span className="muted">—</span>}</td>
                  <td>{m.status === "active" ? <span className="pill ok">Active</span> : <span className="pill warn">{m.status || "—"}</span>}</td>
                  <td className="muted">{m.source === "comp" ? "Comp" : "Stripe"}</td>
                  <td style={{ textAlign: "right" }}>{m.status === "active" && <button className="link" onClick={() => grant(true, m.email)}>Revoke</button>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        <Link href="/membership" target="_blank" className="link" style={{ marginTop: 14, display: "inline-block" }}>View the public membership page →</Link>
      </div>
    </Shell>
  );
}
