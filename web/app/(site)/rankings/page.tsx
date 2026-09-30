import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedPlayers, getRankingFacets, CHIP_META, CHIP_ORDER } from "@/lib/rankings";
import { getSiteConfig } from "@/lib/siteConfig";
import RankingsBoard from "@/components/hayes/RankingsBoard";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { branding } = await getSiteConfig();
  const site = branding.siteName || "Coach Hayes Football";
  const title = "Football Recruiting Rankings — graded on film";
  const description = `${site} player rankings: high school football recruits graded on film with the four-chip system (Blue, Gold, Silver, Bronze). Updated by Coach Hayes.`;
  return {
    title,
    description,
    alternates: { canonical: "/rankings" },
    openGraph: { title, description, type: "website", url: "/rankings" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function RankingsPage() {
  const [players, facets, { branding }] = await Promise.all([getPublishedPlayers(), getRankingFacets(), getSiteConfig()]);
  const site = branding.siteName || "Coach Hayes Football";

  const rows = players.map((p) => ({
    slug: p.slug, rank: 0, name: p.name, position: p.position, school: p.school,
    state: p.state, classYear: p.classYear, chip: p.chip,
    chipLabel: CHIP_META[p.chip].label, chipRing: CHIP_META[p.chip].ring,
    categories: p.categories, videoUrl: p.videoUrl, commit: p.commit, commitLogo: p.commitLogo,
  }));

  // JSON-LD: the board as an ItemList of Person entities (SEO + AI extraction).
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${site} Football Recruiting Rankings`,
    description: "High school football recruits graded on film with the four-chip system.",
    numberOfItems: players.length,
    itemListElement: players.slice(0, 100).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Person",
        name: p.name,
        url: `/rankings/${p.slug}`,
        jobTitle: `${p.position} · Class of ${p.classYear}`,
        affiliation: { "@type": "HighSchool", name: p.school },
      },
    })),
  };
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      { "@type": "Question", name: "How are players ranked?", acceptedAnswer: { "@type": "Answer", text: "Every recruit is graded on film by Coach Hayes and assigned one of four chips — Blue (elite), Gold, Silver, or Bronze — then ranked. No stars, no camp buzz, no offer counting." } },
      { "@type": "Question", name: "What is a blue-chip prospect?", acceptedAnswer: { "@type": "Answer", text: "A Blue chip is the top grade: high-major, program-changing talent evaluated on film." } },
      { "@type": "Question", name: "How do I get my film reviewed?", acceptedAnswer: { "@type": "Answer", text: "Submit a highlight link and a short profile on the Rankings page. Every submission gets a yes or a no." } },
    ],
  };

  return (
    <div className="wide" style={{ paddingTop: 26, paddingBottom: 40 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />

      <div className="rkhero">
        <div>
          <p className="rkkick">{site} · Player Rankings</p>
          <h1 style={{ fontSize: "clamp(30px,5vw,52px)", letterSpacing: "-.03em", lineHeight: 1.05 }}>
            Four chips. One grade.<br />Earned on film.
          </h1>
          <p className="rkdek">
            Every recruit is graded on film and given one chip — Blue, Gold, Silver or Bronze — then ranked.
            No stars, no camp buzz, no offer counting. Graded by Coach Hayes.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            <Link className="pill" href="/rankings/submit">Submit your film</Link>
            <Link className="link" href="/rankings/how-it-works">How the grade works ›</Link>
          </div>
        </div>
        <div className="rkstats">
          <div><b>{players.length}</b><span>Players graded</span></div>
          <div><b>4</b><span>Chip tiers</span></div>
        </div>
      </div>

      <div className="chiplegend">
        {CHIP_ORDER.map((c) => (
          <div className="cl" key={c}>
            <span className="chip lg" style={{ background: CHIP_META[c].ring, border: `2px solid ${CHIP_META[c].ring}`, width: 34, height: 34, borderRadius: "50%", display: "inline-block" }} />
            <div><b>{CHIP_META[c].label}</b><span>{CHIP_META[c].blurb}</span></div>
          </div>
        ))}
      </div>

      {players.length > 0 ? (
        <RankingsBoard players={rows} years={facets.years} positions={facets.positions} />
      ) : (
        <div className="rklist">
          <div className="card" style={{ textAlign: "center", padding: "48px 30px" }}>
            <h3 style={{ marginBottom: 8 }}>The board is opening soon</h3>
            <p style={{ color: "var(--sub)", maxWidth: "46ch", margin: "0 auto" }}>
              Coach is grading the first class now. Submit your film to be considered — every submission gets a yes or a no.
            </p>
            <Link className="pill" href="/rankings/submit" style={{ marginTop: 18 }}>Submit your film</Link>
          </div>
        </div>
      )}
    </div>
  );
}
