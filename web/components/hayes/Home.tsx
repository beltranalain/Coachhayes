"use client";

import Link from "next/link";
import { useState } from "react";
import type { HomeContent } from "@/lib/hayesContent";
import { useLiveStatus } from "@/components/hayes/useLiveStatus";
import CategoryChips from "@/components/hayes/CategoryChips";
import type { Chip, Categories } from "@/lib/chips";

type ScheduleRow = { when: string; title: string; note?: string };

type RankRow = {
  slug: string; name: string; position: string; school: string; classYear: string;
  chip: string; chipLabel: string; categories?: Categories; commit?: string; commitLogo?: string;
  videoUrl?: string;
};

type PostCard = { slug: string; title: string; excerpt: string; coverImage: string; category: string; readMins: number; date: string };

// Pull the 11-char YouTube id out of a watch/embed/share/live URL.
function ytId(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// Home renders entirely from data: `tagline` (branding), `content`
// (admin-editable), live status, and the schedule. No hardcoded copy/numbers.
export default function Home({
  tagline,
  logo,
  content,
  live,
  playerSrc,
  schedule,
  rankings,
  posts,
}: {
  tagline: string;
  logo?: string;
  content: HomeContent;
  live: { live: boolean; viewers?: number };
  playerSrc?: string;
  schedule: ScheduleRow[];
  rankings: { total: number; top: RankRow[] };
  posts: PostCard[];
}) {
  const week = schedule.slice(0, 5);
  // Reflect the Studio going live automatically (polls Cloudflare status).
  const isLive = useLiveStatus(live.live);
  // Film highlight playing in the rankings-preview modal.
  const [playing, setPlaying] = useState<{ id: string; name: string } | null>(null);
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

      {/* ============ TOP OF THE BOARD (rankings preview) ============ */}
      <section className="sec">
        <div className="wide">
          <div className="hd center">
            <h2>Top of the board</h2>
            <p>Every recruit graded on film — Blue, Gold, Silver, Bronze. Here&apos;s who&apos;s leading.</p>
          </div>

          {rankings.top.length > 0 ? (
            <>
              <div className="rkprev">
                {rankings.top.map((p, i) => {
                  const vid = ytId(p.videoUrl);
                  return (
                    <div className="rkprev-row" key={p.slug}>
                      <span className="rkprev-num">{i + 1}</span>
                      <span className="rkprev-who">
                        <Link className="rkprev-name" href={`/rankings/${p.slug}`}>{p.name}</Link>
                        <em>{[p.school, p.position, p.classYear].filter(Boolean).join(" · ")}</em>
                      </span>
                      {vid ? (
                        <button
                          type="button"
                          className="rkprev-film"
                          aria-label={`Play ${p.name} highlights`}
                          onClick={() => setPlaying({ id: vid, name: p.name })}
                        >
                          <img src={`https://i.ytimg.com/vi/${vid}/mqdefault.jpg`} alt="" loading="lazy" />
                          <span className="rkprev-play"><svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg></span>
                        </button>
                      ) : (
                        <span className="rkprev-film rkprev-film-none">No film</span>
                      )}
                      <span className="rkprev-badges">
                        <CategoryChips categories={p.categories} overall={p.chip as Chip} size={26} />
                      </span>
                      <b className="rkprev-label">{p.chipLabel}</b>
                      {p.commitLogo ? (
                        <img className="rkprev-logo" src={p.commitLogo} alt={p.commit || ""} title={p.commit ? `Committed to ${p.commit}` : ""} />
                      ) : (
                        <span className="rkprev-logo rkprev-logo-none">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="center" style={{ marginTop: 22 }}>
                <Link className="pill" href="/rankings">See all {rankings.total} rankings ›</Link>
              </div>
            </>
          ) : (
            <div className="rkprev rkprev-empty">
              <h3>The board is opening soon</h3>
              <p>Coach is grading the first class now. Submit your film to be considered — every submission gets a yes or a no.</p>
              <Link className="pill" href="/rankings/submit">Submit your film</Link>
            </div>
          )}
        </div>
      </section>

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

      {/* ============ LATEST FROM THE BLOG ============ */}
      {posts.length > 0 && (
        <section className="sec">
          <div className="wide">
            <div className="hd center">
              <h2>Latest from the blog</h2>
              <p>Film breakdowns, recruiting notes, and the stories behind the game.</p>
            </div>
            <div className="bloggrid">
              {posts.map((p) => (
                <Link key={p.slug} href={`/blog/${p.slug}`} className="blogcard">
                  <div className={`blogcard-art${p.coverImage ? " has-img" : ""}`} style={p.coverImage ? { backgroundImage: `url(${p.coverImage})` } : undefined} />
                  <div className="blogcard-body">
                    {p.category && <span className="blogtag">{p.category}</span>}
                    <h3>{p.title}</h3>
                    {p.excerpt && <p>{p.excerpt}</p>}
                    <span className="blogmeta">{p.date}{p.date ? " · " : ""}{p.readMins} min read</span>
                  </div>
                </Link>
              ))}
            </div>
            <div className="center" style={{ marginTop: 22 }}>
              <Link className="pill" href="/blog">Read the blog ›</Link>
            </div>
          </div>
        </section>
      )}

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
