import type { Metadata } from "next";
import Link from "next/link";
import { CHIP_ORDER, CHIP_META } from "@/lib/rankings";
import { getSiteConfig } from "@/lib/siteConfig";

export async function generateMetadata(): Promise<Metadata> {
  const { branding } = await getSiteConfig();
  const site = branding.siteName || "Coach Hayes Football";
  const title = "How the rankings work — the four-chip grading system";
  const description = `How ${site} grades high school football recruits: the four-chip system (Blue, Gold, Silver, Bronze), what each chip means, how film is evaluated, and how players get reviewed.`;
  return {
    title, description,
    alternates: { canonical: "/rankings/how-it-works" },
    openGraph: { title, description, type: "article", url: "/rankings/how-it-works" },
    twitter: { card: "summary_large_image", title, description },
  };
}

const STEPS = [
  { n: "01", h: "Film first", p: "Every grade starts with the tape. We watch the full highlight reel and, when available, game film — not camp numbers, not offer lists, not recruiting-site buzz." },
  { n: "02", h: "Evaluate the traits", p: "We grade what shows up on film: athleticism, technique, football IQ, competitiveness, and how the player finishes. Position-specific traits carry the most weight." },
  { n: "03", h: "Assign a chip", p: "Each recruit earns one of four chips based on projected level. The chip is the grade — it's honest, and it can move up as new film comes in." },
  { n: "04", h: "Rank the board", p: "Players sort by chip, then by evaluation. Coach can bump a player up or down when the film warrants it. The board updates as new grades land." },
];

export default async function HowItWorksPage() {
  const { branding } = await getSiteConfig();
  const site = branding.siteName || "Coach Hayes Football";

  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      { "@type": "Question", name: "How are football recruits ranked?", acceptedAnswer: { "@type": "Answer", text: "Every recruit is graded on film and assigned one of four chips — Blue (elite), Gold, Silver, or Bronze. Players sort by chip, then by evaluation. No stars, no camp buzz, no offer counting." } },
      { "@type": "Question", name: "What do the four chips mean?", acceptedAnswer: { "@type": "Answer", text: CHIP_ORDER.map((c) => `${CHIP_META[c].label}: ${CHIP_META[c].blurb}`).join(" ") } },
      { "@type": "Question", name: "Can a player's chip change?", acceptedAnswer: { "@type": "Answer", text: "Yes. The grade reflects the film. As a player develops and sends new tape, the chip can move up." } },
      { "@type": "Question", name: "How do I get my film reviewed?", acceptedAnswer: { "@type": "Answer", text: "Submit a highlight link and a short profile on the Rankings page. Every submission gets a yes or a no." } },
      { "@type": "Question", name: "How do I request removal?", acceptedAnswer: { "@type": "Answer", text: "Players and parents can request removal at any time. We only ever publish position, school, and class year — never contact information." } },
    ],
  };

  return (
    <div className="wide" style={{ paddingTop: 30, paddingBottom: 56, maxWidth: 860 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />

      <p className="rkkick">{site} · Methodology</p>
      <h1 style={{ fontSize: "clamp(28px,4.5vw,46px)", letterSpacing: "-.03em", lineHeight: 1.06, margin: "6px 0 14px" }}>
        How the grade works.
      </h1>
      <p className="rkdek" style={{ maxWidth: "60ch" }}>
        One coach, one standard, one grade per player. Here's exactly how {site} evaluates high
        school football recruits — so you know what a chip means before you chase one.
      </p>

      <div className="chiplegend" style={{ marginTop: 26 }}>
        {CHIP_ORDER.map((c) => (
          <div className="cl" key={c}>
            <span style={{ background: CHIP_META[c].ring, border: `2px solid ${CHIP_META[c].ring}`, width: 34, height: 34, borderRadius: "50%", display: "inline-block" }} />
            <div><b>{CHIP_META[c].label}</b><span>{CHIP_META[c].blurb}</span></div>
          </div>
        ))}
      </div>

      <div className="stepgrid" style={{ marginTop: 30 }}>
        {STEPS.map((s) => (
          <div className="card" key={s.n}>
            <div className="stepn">{s.n}</div>
            <h3 style={{ margin: "8px 0 6px" }}>{s.h}</h3>
            <p style={{ color: "var(--sub)", margin: 0 }}>{s.p}</p>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 26 }}>
        <h3 style={{ marginTop: 0 }}>What we publish — and what we don't</h3>
        <p style={{ color: "var(--sub)" }}>
          Rankings feature high school athletes, many of them minors. We only ever publish a
          player's name, position, high school, class year, chip grade, and highlight film.
          We never publish contact details, home address, or private information. Parents and
          players can request removal at any time and we'll honor it.
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 26, flexWrap: "wrap" }}>
        <Link className="pill" href="/rankings/submit">Submit your film</Link>
        <Link className="link" href="/rankings">See the board ›</Link>
      </div>
    </div>
  );
}
