"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import CategoryChips from "@/components/hayes/CategoryChips";
import type { Chip, Categories } from "@/lib/chips";

// Client filter over the server-rendered board. Chip colors passed from server.
type Row = {
  slug: string; rank: number; name: string; position: string; school: string;
  state?: string; classYear: string; chip: string; chipLabel: string; chipRing: string;
  categories?: Categories; videoUrl?: string; commit?: string; commitLogo?: string;
};

function ytId(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export default function RankingsBoard({ players, years, positions }: { players: Row[]; years: string[]; positions: string[] }) {
  const [year, setYear] = useState<string>("all");
  const [pos, setPos] = useState<string>("all");
  const [playing, setPlaying] = useState<{ id: string; name: string } | null>(null);

  const rows = useMemo(
    () => players.filter((p) => (year === "all" || p.classYear === year) && (pos === "all" || p.position === pos)),
    [players, year, pos]
  );

  return (
    <>
      <div className="rkbar">
        <div className="hchips2">
          <button className={`hchip2${pos === "all" ? " on" : ""}`} onClick={() => setPos("all")}>All</button>
          {positions.map((p) => (
            <button key={p} className={`hchip2${pos === p ? " on" : ""}`} onClick={() => setPos(p)}>{p}</button>
          ))}
        </div>
        <div className="hchips2">
          <button className={`hchip2${year === "all" ? " on" : ""}`} onClick={() => setYear("all")}>All years</button>
          {years.map((y) => (
            <button key={y} className={`hchip2${year === y ? " on" : ""}`} onClick={() => setYear(y)}>{y}</button>
          ))}
        </div>
      </div>

      <div className="rklist">
        <div className="rkhead"><span>Rank</span><span>Player</span><span>Pos</span><span>State</span><span>Film</span><span>Chips</span><span>Commit</span><span /></div>
        {rows.length > 0 ? (
          rows.map((p, i) => {
            const vid = ytId(p.videoUrl);
            return (
              <div className="rkrow" key={p.slug}>
                <span className="rknum">{i + 1}</span>
                <span className="rkwho">
                  <Link href={`/rankings/${p.slug}`} className="rkname">{p.name}</Link>
                  <em>{[p.school, p.classYear].filter(Boolean).join(" · ")}</em>
                </span>
                <span className="rkpos">{p.position || "—"}</span>
                <span className="rkstate">{p.state || "—"}</span>
                <span className="rkfilm">
                  {vid ? (
                    <button className="rkthumb" onClick={() => setPlaying({ id: vid, name: p.name })} aria-label={`Play ${p.name} highlights`}>
                      <img src={`https://i.ytimg.com/vi/${vid}/mqdefault.jpg`} alt="" loading="lazy" />
                      <span className="rkplay"><svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg></span>
                    </button>
                  ) : (
                    <span className="rkfilm-none">No film</span>
                  )}
                </span>
                <span className="rkchips">
                  <CategoryChips categories={p.categories} overall={p.chip as Chip} size={30} />
                  <b style={{ marginLeft: 12, fontSize: 13 }}>{p.chipLabel}</b>
                </span>
                <span className="rkcommit">
                  {p.commitLogo ? <img src={p.commitLogo} alt={p.commit || ""} title={p.commit ? `Committed to ${p.commit}` : ""} /> : <span className="rkcommit-none">—</span>}
                </span>
                <Link className="rkgo" href={`/rankings/${p.slug}`}>View ›</Link>
              </div>
            );
          })
        ) : (
          <div className="card" style={{ textAlign: "center", padding: "44px 30px", marginTop: 8 }}>
            <h3 style={{ marginBottom: 8 }}>No players match that filter yet</h3>
            <p style={{ color: "var(--sub)" }}>Try another year or position — or submit film to get on the board.</p>
          </div>
        )}
      </div>

      {playing && (
        <div className="rkvidmodal" onClick={(e) => { if (e.target === e.currentTarget) setPlaying(null); }}>
          <div className="rkvidbox">
            <button className="rkvidclose" onClick={() => setPlaying(null)} aria-label="Close">✕</button>
            <div className="rkvidframe">
              <iframe src={`https://www.youtube.com/embed/${playing.id}?autoplay=1`} title={`${playing.name} highlights`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
            <p className="rkvidname">{playing.name}</p>
          </div>
        </div>
      )}
    </>
  );
}
