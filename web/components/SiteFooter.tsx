import Link from "next/link";
import { BRAND, SERIES, visibleSeries, normalizeHref, type Series } from "@/lib/siteData";
import { CHANNELS, type Channel } from "@/lib/channels";

export default function SiteFooter({
  brand = { name: BRAND.name, tagline: BRAND.tagline },
  series = SERIES,
  channels = CHANNELS,
}: {
  brand?: { name: string; tagline: string };
  series?: Series[];
  channels?: Channel[];
}) {
  const year = new Date().getFullYear();
  const shows = visibleSeries(series);
  const links = channels.length ? channels : CHANNELS;
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="footgrid">
          <div>
            <h3 className="anton">Roll tape<br /><span className="or">every week</span></h3>
            <p className="sub">
              Pick the productions you want and get one note an hour before each goes live.
            </p>
          </div>
          <div className="footcol">
            <h4>Watch</h4>
            <Link href="/live">Live now</Link>
            <Link href="/shows">The slate</Link>
            <Link href="/library">Archive</Link>
            <Link href="/live">Schedule</Link>
          </div>
          <div className="footcol">
            <h4>Shows</h4>
            {shows.map((s) => {
              const link = normalizeHref(s.href);
              return link.external
                ? <a key={s.key} href={link.url} target="_blank" rel="noopener noreferrer">{s.title}</a>
                : <Link key={s.key} href={link.url}>{s.title}</Link>;
            })}
          </div>
          <div className="footcol">
            <h4>Elsewhere</h4>
            {links.map((c) => (
              <a key={c.key} href={c.url} target="_blank" rel="noopener noreferrer">
                {c.name}
              </a>
            ))}
            <Link href="/contact">Contact</Link>
          </div>
        </div>

        <div className="legal">
          <span>Copyright {year} {brand.name}. All rights reserved.</span>
        </div>

        <div className="megamark" aria-hidden="true">
          <span>{brand.name}</span>
        </div>
      </div>
    </footer>
  );
}
