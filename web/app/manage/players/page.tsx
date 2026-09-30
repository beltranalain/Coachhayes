"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/hayes/admin/Shell";
import { getIdToken } from "@/lib/firebase";

// Players — a REAL, at-a-glance summary of the roster. All numbers and rows below
// are computed from live data (/api/admin/players + /api/admin/submissions); there
// is no sample data here. Full grading (AI scout, chip editing, publishing, the
// board) lives in Rankings (/manage/rankings) — this page just links there.
type Player = { id: string; name: string; position?: string; school?: string; classYear?: string; chip?: string; published?: boolean; slug?: string };
type Sub = { id: string; playerName?: string; position?: string; classYear?: string; videoUrl?: string; status?: string };

const CHIP_RING: Record<string, string> = { blue: "#2D6BFF", gold: "#F5C542", silver: "#A9B2BD", bronze: "#C98A5E" };
const ring = (c?: string) => CHIP_RING[c || ""] || CHIP_RING.bronze;

export default function PlayersAdmin() {
  const [brand, setBrand] = useState({ name: "Coach Hayes Football", logo: "" });
  const [players, setPlayers] = useState<Player[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/site-config", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (d?.branding) setBrand({ name: d.branding.siteName || "Coach Hayes Football", logo: d.branding.logo || "" }); }).catch(() => {});
    (async () => {
      try {
        const t = await getIdToken();
        const headers: Record<string, string> = t ? { Authorization: `Bearer ${t}` } : {};
        const [ps, ss] = await Promise.all([
          fetch("/api/admin/players", { headers, cache: "no-store" }).then((r) => r.json()),
          fetch("/api/admin/submissions", { headers, cache: "no-store" }).then((r) => r.json()),
        ]);
        setPlayers(Array.isArray(ps.players) ? ps.players : []);
        setSubs(Array.isArray(ss.submissions) ? ss.submissions : []);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const pending = subs.filter((s) => s.status === "new" || s.status === "reviewing");
  const published = players.filter((p) => p.published !== false);
  const blue = players.filter((p) => p.chip === "blue");
  const board = players.slice(0, 6);

  return (
    <Shell title="Players" sub={`${players.length} graded · ${pending.length} awaiting review`} brandName={brand.name} logo={brand.logo}>
      <div className="note" style={{ marginBottom: 14 }}>Players is your quick summary. The full editor — AI scout, chip grading, publishing, and reordering — lives in <Link className="link" href="/manage/rankings">Rankings</Link>.</div>

      <div className="row4">
        <div className="card kpi"><b>{players.length}</b><span>Players graded</span><div className="d">On the board</div></div>
        <div className="card kpi"><b>{pending.length}</b><span>Awaiting review</span><div className="d">Film in the queue</div></div>
        <div className="card kpi"><b>{blue.length}</b><span>Blue chips</span><div className="d">Top of the board</div></div>
        <div className="card kpi"><b>{published.length}</b><span>Published pages</span><div className="d">Live &amp; findable</div></div>
      </div>

      <div className="card">
        <h3>Film submissions</h3>
        <p className="cs">New film waiting for a grade. Open Rankings to run the AI scout and publish.</p>
        {loading ? (
          <div className="note" style={{ margin: 0 }}>Loading…</div>
        ) : pending.length === 0 ? (
          <div className="note" style={{ margin: 0 }}>No submissions waiting. They arrive from the public Rankings page.</div>
        ) : (
          <div className="rows">
            {pending.map((s) => (
              <div className="r" key={s.id}>
                <span className="nm"><b>{s.playerName || "Unnamed player"}</b><span>{[s.position, s.classYear].filter(Boolean).join(" · ") || "—"}{s.videoUrl ? <> · <a className="link" href={s.videoUrl} target="_blank" rel="noreferrer">film ›</a></> : null}</span></span>
                <span className="act"><Link className="btn sm acc" href="/manage/rankings">Grade in Rankings</Link></span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3>The board</h3>
        <p className="cs">Your top graded players. Each has a public page — that page is how strangers find this site.</p>
        {loading ? (
          <div className="note" style={{ margin: 0 }}>Loading…</div>
        ) : players.length === 0 ? (
          <div className="note" style={{ margin: 0 }}>No players graded yet. Add one from <Link className="link" href="/manage/rankings">Rankings</Link>.</div>
        ) : (
          <div className="rows">
            {board.map((p, i) => (
              <div className="r" key={p.id}>
                <span className="nm">
                  <b><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: ring(p.chip), marginRight: 8, verticalAlign: "middle" }} />{i + 1}. {p.name}</b>
                  <span>{[p.position, p.school, p.classYear].filter(Boolean).join(" · ") || "—"}</span>
                </span>
                <span className="act">{p.published !== false ? <span className="pill ok">Published</span> : <span className="pill warn">Draft</span>}</span>
              </div>
            ))}
          </div>
        )}
        <p style={{ marginTop: 14 }}><Link className="btn acc" href="/manage/rankings">Open the full board</Link></p>
      </div>
    </Shell>
  );
}
