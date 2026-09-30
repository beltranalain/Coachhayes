"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/hayes/admin/Shell";
import { getIdToken } from "@/lib/firebase";

// Tips — real data from the Firestore `tips` collection via /api/admin/tips.
// No hardcoded amounts: everything below is computed from actual tips.
type Tip = { id?: string; name?: string; amount: number; ts?: number; method?: string; show?: string; note?: string };

export default function TipsAdmin() {
  const [brand, setBrand] = useState({ name: "Coach Hayes Football", logo: "" });
  const [tips, setTips] = useState<Tip[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/site-config", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (d?.branding) setBrand({ name: d.branding.siteName || "Coach Hayes Football", logo: d.branding.logo || "" }); }).catch(() => {});
    (async () => {
      try {
        const t = await getIdToken();
        const r = await fetch("/api/admin/tips", { headers: t ? { Authorization: `Bearer ${t}` } : {}, cache: "no-store" });
        const d = await r.json();
        setTips(Array.isArray(d.tips) ? d.tips : []);
        setConfigured(d.configured !== false);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const sum = (xs: Tip[]) => xs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const today = tips.filter((t) => (t.ts || 0) >= dayStart.getTime());
  const month = tips.filter((t) => (t.ts || 0) >= monthStart.getTime());
  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const when = (ts?: number) => { if (!ts) return ""; const d = new Date(ts); return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); };

  return (
    <Shell title="Tips" sub={configured ? `${fmt(sum(today))} today · straight to your account` : "Connect Stripe to accept tips"} brandName={brand.name} logo={brand.logo}>
      <div className="row4">
        <div className="card kpi"><b>{fmt(sum(today))}</b><span>Today</span><div className="d">{today.length} supporter{today.length === 1 ? "" : "s"}</div></div>
        <div className="card kpi"><b>{fmt(sum(month))}</b><span>This month</span><div className="d">{month.length} tip{month.length === 1 ? "" : "s"}</div></div>
        <div className="card kpi"><b>{tips.length}</b><span>Recent tips</span><div className="d">Last 200</div></div>
        <div className="card kpi"><b>{tips.length ? fmt(sum(tips) / tips.length) : "$0.00"}</b><span>Average tip</span><div className="d">Across recent</div></div>
      </div>

      <div className="card">
        <h3>Recent tips</h3>
        <p className="cs">Every tip goes straight to your Stripe account — you are the merchant of record.</p>
        {!configured ? (
          <div className="note" style={{ margin: 0, borderLeftColor: "var(--amber)" }}><b>Stripe not connected.</b> Set your Stripe keys on the server to accept tips; they’ll appear here in real time.</div>
        ) : loading ? (
          <div className="note" style={{ margin: 0 }}>Loading…</div>
        ) : tips.length === 0 ? (
          <div className="note" style={{ margin: 0 }}>No tips yet. When viewers tip during a stream, they show up here instantly.</div>
        ) : (
          <div className="tbwrap" style={{ marginTop: 12 }}><table>
            <thead><tr><th>From</th><th>Amount</th><th>Method</th><th>Show</th><th>Note</th><th>When</th></tr></thead>
            <tbody>
              {tips.map((t, i) => (
                <tr key={t.id || i}>
                  <td><b>{t.name || "Anonymous"}</b></td>
                  <td><b style={{ color: "var(--green)" }}>{fmt(Number(t.amount) || 0)}</b></td>
                  <td className="muted">{t.method || "Card"}</td>
                  <td className="muted">{t.show || "—"}</td>
                  <td className="muted">{t.note || "—"}</td>
                  <td className="muted">{when(t.ts)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </Shell>
  );
}
