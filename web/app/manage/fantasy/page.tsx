"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/hayes/admin/Shell";

// Fantasy — read-only view of the REAL configured levels/config from
// /api/hayes-content (content.fantasy). Live entrant + payment tracking (the
// Fantrax flow) isn't connected yet, so we show an honest note instead of any
// fake entrant names or payment statuses.
type Level = { key: string; entry: number; prize: number; seats: number; filled: number; highlight: boolean };
type Step = { n: string; text: string };
type Fantasy = {
  leagueName: string;
  heading: string;
  levelsHeading: string;
  levelsIntro: string;
  seasonNote: string;
  levels: Level[];
  legal: string;
  freeGameTitle: string;
  freeGameText: string;
  freeGameCta: string;
};

export default function FantasyAdmin() {
  const [brand, setBrand] = useState({ name: "Coach Hayes Football", logo: "" });
  const [fantasy, setFantasy] = useState<Fantasy | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/site-config", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (d?.branding) setBrand({ name: d.branding.siteName || "Coach Hayes Football", logo: d.branding.logo || "" }); }).catch(() => {});
    fetch("/api/hayes-content", { cache: "no-store" }).then((r) => r.json()).then((d) => { setFantasy(d?.content?.fantasy || null); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const levels = fantasy?.levels ?? [];
  const fmt = (n: number) => `$${Number(n || 0).toLocaleString()}`;

  return (
    <Shell title="Fantasy" sub={levels.length ? `${levels.length} level${levels.length === 1 ? "" : "s"} configured` : "Configured in Content"} brandName={brand.name} logo={brand.logo}>
      <div className="card">
        <h3>{fantasy?.levelsHeading || "Levels"}</h3>
        <p className="cs">{fantasy?.levelsIntro || "The fantasy levels shown on the public site, read from your Content settings."}</p>
        {loading ? (
          <div className="note" style={{ margin: 0 }}>Loading…</div>
        ) : levels.length === 0 ? (
          <div className="note" style={{ margin: 0 }}>No fantasy levels configured yet. Set them up in Content and they’ll appear here and on the public page.</div>
        ) : (
          <div className="tbwrap" style={{ marginTop: 12 }}><table>
            <thead><tr><th>Level</th><th>Entry</th><th>Winner takes</th><th>Seats</th></tr></thead>
            <tbody>
              {levels.map((l) => (
                <tr key={l.key}>
                  <td><b>{fmt(l.entry)} level</b>{l.highlight && <span className="pill ok" style={{ marginLeft: 8 }}>Featured</span>}</td>
                  <td>{fmt(l.entry)}</td>
                  <td>{fmt(l.prize)}</td>
                  <td className="muted">{l.seats}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        {fantasy?.seasonNote && <p className="muted" style={{ marginTop: 12 }}>{fantasy.seasonNote}</p>}
      </div>

      <div className="card">
        <h3>Entrants & payments</h3>
        <p className="cs">This is where the live roster and payment status will live.</p>
        <div className="note" style={{ margin: 0, borderLeftColor: "var(--amber)" }}>
          <b>Entrant tracking isn’t connected yet.</b> Once the Fantrax flow is wired up, real entrants, their payment status, and automatic invites will appear here in real time. No entrant names or payment statuses are shown until then.
        </div>
        {fantasy?.legal && (
          <div className="note" style={{ marginTop: 14, borderLeftColor: "var(--amber)" }}>
            <b>Before entry fees ever run through this site,</b> {fantasy.legal}
          </div>
        )}
        <Link href="/fantasy" target="_blank" className="link" style={{ marginTop: 14, display: "inline-block" }}>View the public fantasy page →</Link>
      </div>
    </Shell>
  );
}
