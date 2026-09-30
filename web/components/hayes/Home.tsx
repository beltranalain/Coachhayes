"use client";

import Link from "next/link";
import type { HomeContent } from "@/lib/hayesContent";
import { useLiveStatus } from "@/components/hayes/useLiveStatus";

type ScheduleRow = { when: string; title: string; note?: string };

// Home renders entirely from data: `tagline` (branding), `content`
// (admin-editable), live status, and the schedule. No hardcoded copy/numbers.
export default function Home({
  tagline,
  logo,
  content,
  live,
  playerSrc,
  schedule,
}: {
  tagline: string;
  logo?: string;
  content: HomeContent;
  live: { live: boolean; viewers?: number };
  playerSrc?: string;
  schedule: ScheduleRow[];
}) {
  const week = schedule.slice(0, 5);
  // Reflect the Studio going live automatically (polls Cloudflare status).
  const isLive = useLiveStatus(live.live);
  return (
    <>
      {/* ============ HERO ============ */}
      <header className="hero center">
        <div className="wrap">
          <h1>{tagline}</h1>
          <p className="tag">{content.heroTag}</p>
          <div className="hl">
            <Link className="pill" href="/live">{content.ctaPrimary}</Link>
            <Link className="link" href="/community">{content.ctaSecondary}</Link>
          </div>
        </div>

        <div className="wide">
          {isLive && playerSrc ? (
            // Live: play the real stream inline (same feed as the Live page).
            <div className="stage" style={{ background: "#000" }}>
              <span className="lv" style={{ zIndex: 4 }}>
                <i />
                {`Live now${typeof live.viewers === "number" ? ` · ${live.viewers.toLocaleString()} watching` : ""}`}
              </span>
              <iframe
                src={`${playerSrc}${playerSrc.includes("?") ? "&" : "?"}autoplay=true&muted=true`}
                title="Coach Hayes Football live"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, zIndex: 3 }}
              />
              <Link href="/live" className="pill sm" style={{ position: "absolute", right: 16, bottom: 16, zIndex: 4 }}>
                Full screen + chat ›
              </Link>
            </div>
          ) : (
            <Link href="/live" className="stage" style={{ display: "block" }}>
              {/* Off air: a real placeholder with the animated brand mark
                  (the logo once uploaded in admin; a branded chip until then). */}
              <div className="stage-soon">
                <span className={`soon-mark${logo ? " has-logo" : ""}`}>
                  {logo ? <img src={logo} alt="" /> : null}
                </span>
                <b>{content.comingSoonTitle}</b>
                <span>{content.stageSub}</span>
              </div>
            </Link>
          )}

          {content.statsEnabled && content.stats.length > 0 && (
            <div className="stats">
              {content.stats.map((s, i) => (
                <div className="stat" key={i}>
                  <b>{s.value}</b>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ============ FEATURE TILES ============ */}
      <section className="sec">
        <div className="wide">
          <div className="hd center">
            <h2>{content.tilesHeading}</h2>
            <p>{content.tilesIntro}</p>
          </div>
          <div className="g2">
            {content.tiles.map((t) => (
              <Link
                className={`tile ${t.image ? "tile-img" : t.art}`}
                href={t.href}
                key={t.key}
                style={t.image ? { backgroundImage: `url(${t.image})` } : undefined}
              >
                <span className="k">{t.kicker}</span>
                <h3>{t.title}</h3>
                <p>{t.blurb}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============ THE WEEK ============ */}
      <section className="sec">
        <div className="wide">
          <div className="hd center">
            <h2>{content.weekHeading}</h2>
            <p>{content.weekIntro}</p>
          </div>
          <div className="lineup">
            {week.length > 0 ? (
              week.map((row, i) => (
                <div className={`lr${isLive && i === 0 ? " cap" : ""}`} key={`${row.when}-${i}`}>
                  <span className="pos">{row.when}</span>
                  <div>
                    <b>{row.title}</b>
                    <span>{isLive && i === 0 ? content.onAirCaption : row.note || ""}</span>
                  </div>
                  <span className="pts">
                    <Link className="link" href="/live">{isLive && i === 0 ? "Watch" : "Remind"}</Link>
                  </span>
                </div>
              ))
            ) : (
              <div className="lr">
                <span className="pos">SOON</span>
                <div>
                  <b>Schedule coming</b>
                  <span>Show times appear here once they’re added in the admin</span>
                </div>
                <span className="pts" />
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
