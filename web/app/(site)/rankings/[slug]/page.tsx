import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayerBySlug, CHIP_META, CATEGORIES, recommendedOverall } from "@/lib/rankings";
import { getSiteConfig } from "@/lib/siteConfig";
import { CategoryIcon } from "@/components/hayes/CategoryChips";

export const dynamic = "force-dynamic";

function ytId(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPlayerBySlug(slug);
  const { branding } = await getSiteConfig();
  const site = branding.siteName || "Coach Hayes Football";
  if (!p) return { title: "Player not found" };
  const title = p.seoTitle || `${p.name} — ${p.position}, ${p.school} (${p.classYear}) | ${CHIP_META[p.chip].label}`;
  const description = p.seoDescription || `${p.name}, ${p.position} from ${p.school}${p.state ? `, ${p.state}` : ""}, class of ${p.classYear}. ${CHIP_META[p.chip].label} recruiting grade from ${site}. ${p.bio.slice(0, 120)}`;
  const url = `/rankings/${p.slug}`;
  const ogImg = `/rankings/${p.slug}/opengraph-image`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, type: "profile", url, images: [ogImg] },
    twitter: { card: "summary_large_image", title, description, images: [ogImg] },
  };
}

export default async function PlayerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getPlayerBySlug(slug);
  if (!p) notFound();
  const { branding } = await getSiteConfig();
  const site = branding.siteName || "Coach Hayes Football";
  const chip = CHIP_META[p.chip];
  const vid = ytId(p.videoUrl);

  // JSON-LD: Person (minors-safe — no contact info) + breadcrumb.
  const person = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: p.name,
    jobTitle: `${p.position} · Class of ${p.classYear}`,
    affiliation: { "@type": "HighSchool", name: p.school, ...(p.state ? { address: { "@type": "PostalAddress", addressRegion: p.state } } : {}) },
    description: p.bio,
    ...(p.videoUrl ? { subjectOf: { "@type": "VideoObject", name: `${p.name} highlights`, url: p.videoUrl } } : {}),
    additionalProperty: [{ "@type": "PropertyValue", name: "Recruiting grade", value: chip.label }],
  };
  const crumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Rankings", item: "/rankings" },
      { "@type": "ListItem", position: 2, name: `Class of ${p.classYear}`, item: `/rankings/class/${p.classYear}` },
      { "@type": "ListItem", position: 3, name: p.name, item: `/rankings/${p.slug}` },
    ],
  };

  return (
    <div className="wide" style={{ paddingTop: 26, paddingBottom: 48, maxWidth: 900 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(person) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumb) }} />

      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 8, marginTop: 8 }}>
        <span className="chip lg" style={{ background: chip.ring, border: `3px solid ${chip.ring}`, width: 54, height: 54, borderRadius: "50%", display: "inline-block", flexShrink: 0 }} />
        <div>
          <h1 style={{ fontSize: "clamp(30px,5vw,48px)", letterSpacing: "-.03em", lineHeight: 1.05 }}>{p.name}</h1>
          <p style={{ color: "var(--sub)", fontSize: 17, marginTop: 4 }}>
            {[p.position, p.school ? `${p.school}${p.state ? `, ${p.state}` : ""}` : "", `Class of ${p.classYear}`].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      {vid && (
        <div className="playerwell" style={{ marginTop: 20, position: "relative", aspectRatio: "16/9", borderRadius: 16, overflow: "hidden", background: "#000" }}>
          <iframe src={`https://www.youtube.com/embed/${vid}`} title={`${p.name} highlights`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
        </div>
      )}

      {p.categories && Object.keys(p.categories).length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <p className="rkkick" style={{ color: chip.ring }}>The breakdown</p>
          <h2 style={{ fontSize: 22, letterSpacing: "-.02em", marginBottom: 4 }}>{p.name} — {p.position}, class of {p.classYear}</h2>
          <div style={{ marginTop: 12 }}>
            {CATEGORIES.map((cat) => {
              const t = p.categories?.[cat.key];
              const note = p.categoryNotes?.[cat.key];
              return (
                <div key={cat.key} style={{ display: "flex", gap: 16, alignItems: "flex-start", padding: "16px 0", borderTop: "1px solid var(--hair2)" }}>
                  <CategoryIcon category={cat.key} chip={t} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                      <b style={{ fontSize: 16 }}>{cat.label}</b>
                      {t && <span style={{ fontSize: 13, fontWeight: 700, color: CHIP_META[t].ring }}>{CHIP_META[t].label}</span>}
                    </div>
                    {note && <p style={{ color: "var(--sub)", marginTop: 4, lineHeight: 1.55 }}>{note}</p>}
                  </div>
                </div>
              );
            })}
            <div style={{ display: "flex", gap: 16, alignItems: "center", padding: "18px 0 2px", borderTop: "2px solid var(--hair)" }}>
              <span style={{ background: chip.ring, boxShadow: `0 0 0 4px color-mix(in srgb, ${chip.ring} 35%, transparent)`, width: 46, height: 46, borderRadius: "50%", flexShrink: 0 }} />
              <div>
                <p className="rkkick" style={{ color: chip.ring, marginBottom: 2 }}>Overall ranking</p>
                <b style={{ fontSize: 24, letterSpacing: "-.02em" }}>{chip.label}</b>
                <span style={{ color: "var(--sub)", marginLeft: 10 }}>Score {recommendedOverall(p.categories).avg.toFixed(1)}</span>
              </div>
            </div>
            {p.commitLogo && (
              <div className="pbcommitwrap">
                <img className="pbcommit xl" src={p.commitLogo} alt={p.commit || ""} title={p.commit || ""} />
              </div>
            )}
          </div>
        </div>
      )}

      {p.bio && (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="rkkick" style={{ color: chip.ring }}>The film says</p>
          <p style={{ whiteSpace: "pre-line", lineHeight: 1.7, fontSize: 16, marginTop: 6 }}>{p.bio}</p>
          {p.strengths && p.strengths.length > 0 && (
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 11, borderTop: "1px solid var(--hair2)", paddingTop: 16 }}>
              {p.strengths.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: chip.ring, marginTop: 7, flexShrink: 0 }} />
                  <span style={{ lineHeight: 1.5 }}>{s}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {Boolean(p.heightIn || p.weightLb || p.fortyYd || (p.traits && p.traits.length)) && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Measurables</h2>
          <div className="g4">
            {p.heightIn ? <div className="stat"><b>{Math.floor(p.heightIn / 12)}′{p.heightIn % 12}″</b><span>Height</span></div> : null}
            {p.weightLb ? <div className="stat"><b>{p.weightLb}</b><span>Weight (lb)</span></div> : null}
            {p.fortyYd ? <div className="stat"><b>{p.fortyYd}</b><span>40 yard</span></div> : null}
          </div>
          {p.traits && p.traits.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              {p.traits.map((t, i) => <span className="tagp" key={i}>{t}</span>)}
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ marginTop: 16, textAlign: "center" }}>
        <p style={{ color: "var(--sub)", marginBottom: 12 }}>Graded on film by {site}.</p>
        <Link className="pill" href="/rankings/submit">Submit your film</Link>
      </div>
    </div>
  );
}
