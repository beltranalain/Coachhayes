import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayerBySlug, getPublishedPlayers, CHIP_META, CATEGORIES, recommendedOverall, type CategoryKey } from "@/lib/rankings";
import { getSiteConfig } from "@/lib/siteConfig";
import { CategoryIcon } from "@/components/hayes/CategoryChips";

export const dynamic = "force-dynamic";

function ytId(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// The seeded default bio is a placeholder, NOT coach-written analysis. Treat it
// as empty everywhere (no render, no metadata, no schema) — standing rule:
// never publish analysis Coach did not write. (P1-4)
const PLACEHOLDER_BIO = /highlight film under review|grade pending/i;
const hasRealBio = (bio: string) => bio.trim().length > 0 && !PLACEHOLDER_BIO.test(bio);

const heightStr = (inches?: number) => (inches ? `${Math.floor(inches / 12)}'${inches % 12}"` : "");
const attrQuestion = (label: string, first: string) => `How does ${first} grade for ${label}?`;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPlayerBySlug(slug);
  const { branding } = await getSiteConfig();
  const site = branding.siteName || "Coach Hayes Football";
  if (!p) return { title: "Player not found" };
  const chip = CHIP_META[p.chip];
  const score = p.categories && Object.keys(p.categories).length ? recommendedOverall(p.categories).avg.toFixed(1) : "";
  // Ignore seed-generated SEO fields (seed title ends "| Coach Hayes Football
  // Rankings"; seed description is the "grade pending" placeholder) so the brief
  // format wins — but still respect a genuine custom override. (P1-2, P1-4)
  const customTitle = p.seoTitle && !/\|\s*Coach Hayes Football Rankings\s*$/i.test(p.seoTitle) ? p.seoTitle : "";
  const customDesc = p.seoDescription && !PLACEHOLDER_BIO.test(p.seoDescription) ? p.seoDescription : "";
  const titleMeta = [p.position, p.school].filter(Boolean).join(", ");
  const title = customTitle || `${p.name}${titleMeta ? ` — ${titleMeta}` : ""}${p.classYear ? ` ${p.classYear}` : ""} | Coach Hayes film grade`;
  const description = customDesc
    || `Coach Hayes grades ${p.name}${p.position ? `, ${p.position}` : ""}${p.school ? ` from ${p.school}` : ""}, at ${chip.label}${score ? ` (${score}/4)` : ""} on film. Power, Speed, Motor, Technique and Football IQ, broken down play by play.`;
  const url = `/rankings/${p.slug}`;
  const ogImg = `/rankings/${p.slug}/opengraph-image`;
  return {
    // Absolute so the layout's "- Coach Hayes Football" suffix isn't appended
    // (the title already carries the brand). Matches the brief format exactly.
    title: { absolute: title },
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
  const base = `https://${(branding.domain || "coachhayesfootball.com").replace(/^https?:\/\//, "")}`;
  const chip = CHIP_META[p.chip];
  const vid = ytId(p.videoUrl);
  const first = p.name.split(" ")[0] || p.name;
  const hasCats = Boolean(p.categories && Object.keys(p.categories).length);
  const score = hasCats ? recommendedOverall(p.categories!).avg.toFixed(1) : "";
  const showBio = hasRealBio(p.bio);
  const meta = [p.position, p.school ? `${p.school}${p.state ? `, ${p.state}` : ""}` : "", p.classYear ? `Class of ${p.classYear}` : ""].filter(Boolean).join(" · ");

  // Factual one-paragraph summary from the grade — restates the grade, never
  // invents reasoning. (P1-1 §3)
  const summary = `${p.name} is a ${p.position || "prospect"}${p.school ? ` from ${p.school}` : ""}${p.classYear ? ` in the class of ${p.classYear}` : ""}, graded ${chip.label.toLowerCase()}${score ? ` (${score} out of 4)` : ""} by ${site}. The grade comes only from film across five attributes — Power, Speed, Motor, Technique and Football IQ.`;

  // Other published players in the same class (Related). (P1-1 §9)
  const related = (await getPublishedPlayers())
    .filter((o) => o.slug !== p.slug && o.classYear === p.classYear)
    .slice(0, 6);

  // Factual FAQ built from data — no fabricated analysis. (P1-1 §7)
  const faqItems: { q: string; a: string }[] = [
    { q: `What is ${p.name}'s Coach Hayes grade?`, a: `${p.name} grades as a ${chip.label.toLowerCase()}${score ? ` with an overall film score of ${score} out of 4` : ""}, based on Power, Speed, Motor, Technique and Football IQ.` },
    ...(p.position || p.school ? [{ q: `What position does ${p.name} play and where?`, a: `${p.name} is a ${p.position || "football player"}${p.school ? ` at ${p.school}` : ""}${p.classYear ? `, class of ${p.classYear}` : ""}.` }] : []),
    { q: `How are these recruiting grades decided?`, a: `Coach Hayes grades five attributes from game tape and assigns each a chip; the five scores average into the overall chip. Grades come only from film — not stars, offers or camps.` },
  ];

  // ---- Structured data: one @graph (Person + Video + FAQ + Breadcrumb) ---- (P1-3)
  const pid = `${base}/rankings/${p.slug}`;
  const graph: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": `${pid}#player`,
        name: p.name,
        url: pid,
        jobTitle: `${p.position}${p.classYear ? ` · Class of ${p.classYear}` : ""}`,
        ...(p.school ? { affiliation: { "@type": "HighSchool", name: p.school, ...(p.state ? { address: { "@type": "PostalAddress", addressRegion: p.state } } : {}) } } : {}),
        ...(p.heightIn ? { height: { "@type": "QuantitativeValue", value: p.heightIn, unitCode: "INH" } } : {}),
        ...(p.weightLb ? { weight: { "@type": "QuantitativeValue", value: p.weightLb, unitCode: "LBR" } } : {}),
        ...(showBio ? { description: p.bio } : {}),
        ...(vid ? { subjectOf: { "@id": `${pid}#film` } } : {}),
        additionalProperty: [
          { "@type": "PropertyValue", name: "Overall chip grade", value: chip.label },
          ...(score ? [{ "@type": "PropertyValue", name: "Overall film score", value: `${score}/4` }] : []),
          ...CATEGORIES.filter((c) => p.categories?.[c.key]).map((c) => ({ "@type": "PropertyValue", name: c.label, value: CHIP_META[p.categories![c.key]!].label })),
        ],
      },
      ...(vid ? [{
        "@type": "VideoObject",
        "@id": `${pid}#film`,
        name: `${p.name} highlight film`,
        description: `Highlight film for ${p.name}, graded on tape by ${site}.`,
        thumbnailUrl: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
        uploadDate: new Date(p.createdAt || Date.now()).toISOString(),
        embedUrl: `https://www.youtube.com/embed/${vid}`,
        contentUrl: p.videoUrl,
      }] : []),
      { "@type": "FAQPage", "@id": `${pid}#faq`, mainEntity: faqItems.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Rankings", item: `${base}/rankings` },
          ...(p.classYear ? [{ "@type": "ListItem", position: 2, name: `Class of ${p.classYear}`, item: `${base}/rankings/class/${p.classYear}` }] : []),
          { "@type": "ListItem", position: p.classYear ? 3 : 2, name: p.name, item: pid },
        ],
      },
    ],
  };

  return (
    <article className="wide" style={{ paddingTop: 26, paddingBottom: 48, maxWidth: 900 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />

      {/* 1 · H1 — name only */}
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 6, marginTop: 8 }}>
        <span className="chip lg" style={{ background: chip.ring, border: `3px solid ${chip.ring}`, width: 54, height: 54, borderRadius: "50%", display: "inline-block", flexShrink: 0 }} />
        <div>
          <h1 style={{ fontSize: "clamp(30px,5vw,48px)", letterSpacing: "-.03em", lineHeight: 1.05 }}>{p.name}</h1>
          {meta && <p style={{ color: "var(--sub)", fontSize: 17, marginTop: 4 }}>{meta}</p>}
        </div>
      </div>

      {/* 2 · Fact block */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="g4">
          <div className="stat"><b>{chip.label}</b><span>Overall grade</span></div>
          {score ? <div className="stat"><b>{score}/4</b><span>Film score</span></div> : null}
          {p.position ? <div className="stat"><b>{p.position}</b><span>Position</span></div> : null}
          {p.classYear ? <div className="stat"><b>{p.classYear}</b><span>Class</span></div> : null}
          {heightStr(p.heightIn) ? <div className="stat"><b>{heightStr(p.heightIn)}</b><span>Height</span></div> : null}
          {p.weightLb ? <div className="stat"><b>{p.weightLb}</b><span>Weight (lb)</span></div> : null}
          {p.fortyYd ? <div className="stat"><b>{p.fortyYd}</b><span>40 yard</span></div> : null}
          {p.school ? <div className="stat"><b style={{ fontSize: 16 }}>{p.school}</b><span>High school</span></div> : null}
        </div>
        <p style={{ color: "var(--dim)", fontSize: 12.5, marginTop: 12 }}>
          Graded on film by {site} · Updated {new Date(p.updatedAt || p.createdAt || Date.now()).toLocaleDateString("en-US", { dateStyle: "medium" })}
          {" · "}<Link className="link" href="/contact" style={{ fontSize: 12.5 }}>Request removal of this profile</Link>
        </p>
      </div>

      {/* 3 · Summary */}
      <div className="card" style={{ marginTop: 16 }}>
        <p style={{ lineHeight: 1.7, fontSize: 16.5, margin: 0 }}>{summary}</p>
      </div>

      {/* 4 · Video */}
      {vid && (
        <div className="playerwell" style={{ marginTop: 16, position: "relative", aspectRatio: "16/9", borderRadius: 16, overflow: "hidden", background: "#000" }}>
          <iframe src={`https://www.youtube.com/embed/${vid}`} title={`${p.name} highlights`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
        </div>
      )}

      {/* 5 · Attribute sections — question headings; reasoning only when Coach wrote it */}
      {hasCats && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 22, letterSpacing: "-.02em", marginBottom: 4 }}>How does {first} grade on film?</h2>
          <div style={{ marginTop: 8 }}>
            {CATEGORIES.map((cat) => {
              const t = p.categories?.[cat.key as CategoryKey];
              if (!t) return null;
              const note = p.categoryNotes?.[cat.key as CategoryKey];
              return (
                <div key={cat.key} style={{ display: "flex", gap: 16, alignItems: "flex-start", padding: "16px 0", borderTop: "1px solid var(--hair2)" }}>
                  <CategoryIcon category={cat.key} chip={t} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: 16, margin: 0 }}>{attrQuestion(cat.label, first)}</h3>
                    <p style={{ marginTop: 4, lineHeight: 1.55 }}>
                      <span style={{ fontWeight: 700, color: CHIP_META[t].ring }}>{CHIP_META[t].label}.</span>
                      {note ? ` ${note}` : ""}
                    </p>
                  </div>
                </div>
              );
            })}
            <div style={{ display: "flex", gap: 16, alignItems: "center", padding: "18px 0 2px", borderTop: "2px solid var(--hair)" }}>
              <span style={{ background: chip.ring, boxShadow: `0 0 0 4px color-mix(in srgb, ${chip.ring} 35%, transparent)`, width: 46, height: 46, borderRadius: "50%", flexShrink: 0 }} />
              <div>
                <p className="rkkick" style={{ color: chip.ring, marginBottom: 2 }}>Overall ranking</p>
                <b style={{ fontSize: 24, letterSpacing: "-.02em" }}>{chip.label}</b>
                {score && <span style={{ color: "var(--sub)", marginLeft: 10 }}>Score {score}</span>}
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

      {/* 6 · What the film shows — Coach's writeup, only when real */}
      {showBio && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 20, letterSpacing: "-.02em", marginBottom: 6 }}>What the film shows</h2>
          <p style={{ whiteSpace: "pre-line", lineHeight: 1.7, fontSize: 16 }}>{p.bio}</p>
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
          {p.traits && p.traits.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
              {p.traits.map((t, i) => <span className="tagp" key={i}>{t}</span>)}
            </div>
          )}
        </div>
      )}

      {/* 7 · FAQ (open in HTML, matches FAQPage schema) */}
      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 20, letterSpacing: "-.02em", marginBottom: 8 }}>Frequently asked</h2>
        {faqItems.map((f, i) => (
          <div key={i} style={{ padding: "12px 0", borderTop: i ? "1px solid var(--hair2)" : "none" }}>
            <h3 style={{ fontSize: 15.5, margin: "0 0 4px" }}>{f.q}</h3>
            <p style={{ color: "var(--sub)", margin: 0, lineHeight: 1.6 }}>{f.a}</p>
          </div>
        ))}
      </div>

      {/* 8 · Byline */}
      <div className="card" style={{ marginTop: 16, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        {branding.logo ? <img src={branding.logo} alt="" style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover" }} /> : <span style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--acc)", flexShrink: 0 }} />}
        <div>
          <b>Graded by Coach Kyle Hayes</b>
          <p style={{ color: "var(--sub)", fontSize: 13.5, margin: "2px 0 0" }}>Film-first recruiting evaluation. One coach, one standard, one grade per player. <Link className="link" href="/rankings/how-it-works">How the grade works ›</Link></p>
        </div>
      </div>

      {/* 9 · Related */}
      {related.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 18, marginBottom: 10 }}>More from the Class of {p.classYear}</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {related.map((o) => (
              <Link key={o.slug} href={`/rankings/${o.slug}`} className="tagp" style={{ textDecoration: "none" }}>
                {o.name} · {CHIP_META[o.chip].label}
              </Link>
            ))}
          </div>
          <p style={{ marginTop: 12 }}>
            <Link className="link" href={`/rankings/class/${p.classYear}`}>See the full Class of {p.classYear} board ›</Link>
          </p>
        </div>
      )}

      {/* 10 · Removal + CTA */}
      <div className="card" style={{ marginTop: 16, textAlign: "center" }}>
        <p style={{ color: "var(--sub)", marginBottom: 12 }}>Graded on film by {site}. Players and parents can request removal at any time.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link className="pill" href="/rankings/submit">Submit your film</Link>
          <Link className="link" href="/contact">Request removal</Link>
        </div>
      </div>
    </article>
  );
}
