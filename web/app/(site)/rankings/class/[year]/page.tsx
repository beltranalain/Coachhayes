import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedPlayers, getRankingFacets, CHIP_META } from "@/lib/rankings";
import { getSiteConfig } from "@/lib/siteConfig";
import RankingsBoard from "@/components/hayes/RankingsBoard";

export const dynamic = "force-dynamic";

const isYear = (y: string) => /^\d{4}$/.test(y);

export async function generateMetadata({ params }: { params: Promise<{ year: string }> }): Promise<Metadata> {
  const { year } = await params;
  const { branding } = await getSiteConfig();
  const site = branding.siteName || "Coach Hayes Football";
  const title = `Class of ${year} Football Recruiting Rankings`;
  const description = `${site} rankings for the class of ${year}: high school football recruits graded on film with the four-chip system (Blue, Gold, Silver, Bronze).`;
  return {
    title, description,
    alternates: { canonical: `/rankings/class/${year}` },
    openGraph: { title, description, type: "website", url: `/rankings/class/${year}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ClassYearPage({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  if (!isYear(year)) notFound();

  const [all, facets, { branding }] = await Promise.all([getPublishedPlayers(), getRankingFacets(), getSiteConfig()]);
  const site = branding.siteName || "Coach Hayes Football";
  const players = all.filter((p) => p.classYear === year);

  const rows = players.map((p) => ({
    slug: p.slug, rank: 0, name: p.name, position: p.position, school: p.school,
    state: p.state, classYear: p.classYear, chip: p.chip,
    chipLabel: CHIP_META[p.chip].label, chipRing: CHIP_META[p.chip].ring,
  }));

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${site} Class of ${year} Football Recruiting Rankings`,
    numberOfItems: players.length,
    itemListElement: players.slice(0, 100).map((p, i) => ({
      "@type": "ListItem", position: i + 1,
      item: { "@type": "Person", name: p.name, url: `/rankings/${p.slug}`, jobTitle: `${p.position} · Class of ${p.classYear}`, affiliation: { "@type": "HighSchool", name: p.school } },
    })),
  };

  return (
    <div className="wide" style={{ paddingTop: 26, paddingBottom: 40 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />

      <p className="rkkick"><Link className="link" href="/rankings">Rankings</Link> · Class of {year}</p>
      <h1 style={{ fontSize: "clamp(28px,4.5vw,46px)", letterSpacing: "-.03em", lineHeight: 1.06, margin: "6px 0 12px" }}>
        Class of {year}.
      </h1>
      <p className="rkdek" style={{ maxWidth: "58ch" }}>
        {players.length > 0
          ? `${players.length} recruit${players.length === 1 ? "" : "s"} in the ${year} class, graded on film by Coach Hayes.`
          : `No ${year} recruits are graded yet. Submit your film to be first on the board.`}
      </p>

      {facets.years.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0 4px" }}>
          {facets.years.map((y) => (
            <Link key={y} href={`/rankings/class/${y}`} className={`yr${y === year ? " on" : ""}`}
              style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid var(--hair)", fontSize: 13, fontWeight: 600, background: y === year ? "var(--ink)" : "transparent", color: y === year ? "var(--bg)" : "var(--ink)" }}>
              {y}
            </Link>
          ))}
        </div>
      )}

      {players.length > 0 ? (
        <RankingsBoard players={rows} years={[]} positions={facets.positions} />
      ) : (
        <div className="rklist">
          <div className="card" style={{ textAlign: "center", padding: "48px 30px" }}>
            <h3 style={{ marginBottom: 8 }}>No {year} grades yet</h3>
            <p style={{ color: "var(--sub)", maxWidth: "46ch", margin: "0 auto" }}>Coach is grading now. Submit your film — every submission gets a yes or a no.</p>
            <Link className="pill" href="/rankings/submit" style={{ marginTop: 18 }}>Submit your film</Link>
          </div>
        </div>
      )}
    </div>
  );
}
