import type { Metadata } from "next";
import Link from "next/link";
import { visibleSeries, normalizeHref } from "@/lib/siteData";
import { getSiteConfig } from "@/lib/siteConfig";
import Countdown from "@/components/Countdown";

export const metadata: Metadata = { title: "Shows" };

export default async function ShowsPage() {
  const { schedule, content } = await getSiteConfig();
  const series = visibleSeries(content.series);
  // Only broadcasts still in the future, soonest first.
  const upcoming = [...schedule]
    .sort((a, b) => (a.startsAt ?? 0) - (b.startsAt ?? 0))
    .filter((x) => (x.startsAt ?? 0) > Date.now());

  return (
    <>
      <section className="page-hero">
        <div className="wrap">
          <span className="eyebrow">{content.showsEyebrow}</span>
          <h1 className="anton">{content.showsTitle1}<br /><span className="or">{content.showsTitle2}</span></h1>
          <p>{content.showsIntro}</p>
        </div>
      </section>

      {upcoming.length > 0 && (
        <section className="sec" style={{ paddingTop: 56 }}>
          <div className="wrap">
            <span className="eyebrow">Upcoming live</span>
            <h2 className="anton big">On the <span className="or">schedule</span></h2>
            <div className="grid grid-3" style={{ marginTop: 32 }}>
              {upcoming.map((s, i) => (
                <Link key={i} className="tile" href="/live">
                  <div className="timg" style={s.cover ? { backgroundImage: `url(${s.cover})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
                    {!s.cover && <div className="art a1" style={{ position: "absolute", inset: 0 }} />}
                    <span className="lbl">Live</span>
                  </div>
                  <div className="tb">
                    <h3>{s.title}</h3>
                    <p>{s.when}{s.startsAt ? <> · <Countdown startsAt={s.startsAt} className="or" /></> : null}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="sec" style={{ paddingTop: 56 }}>
        <div className="wrap">
          <div className="grid grid-3">
            {series.map((s) => {
              const link = normalizeHref(s.href);
              const inner = (
                <>
                  <div className={`timg${s.image ? "" : ` art ${s.art}`}`} style={s.image ? { backgroundImage: `url(${s.image})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
                    <span className="lbl">{s.badge}</span>
                  </div>
                  <div className="tb">
                    <h3>{s.title}</h3>
                    <p>{s.blurb}</p>
                  </div>
                </>
              );
              return link.external ? (
                <a key={s.key} className="tile" href={link.url} target="_blank" rel="noopener noreferrer">{inner}</a>
              ) : (
                <Link key={s.key} className="tile" href={link.url}>{inner}</Link>
              );
            })}
            <Link className="tile" href="/library">
              <div className="timg art a1"><span className="lbl">Archive</span></div>
              <div className="tb">
                <h3>The full archive</h3>
                <p>Every episode across every series, organized and searchable in one place.</p>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
