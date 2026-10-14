import type { Metadata } from "next";
import Link from "next/link";
import { getSiteConfig } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "About Coach Hayes",
  description: "Coach Kyle Hayes: 20+ years coaching high school and college football, a Florida state championship, and a network from youth ball to the NFL. Film-first recruiting evaluation.",
  alternates: { canonical: "/about" },
};

const Arrow = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 8h11M9 4l4 4-4 4" /></svg>
);

export default async function AboutPage() {
  const { content, branding } = await getSiteConfig();
  const site = branding.siteName || "Coach Hayes Football";
  const base = `https://${(branding.domain || "coachhayesfootball.com").replace(/^https?:\/\//, "")}`;
  const paras = content.aboutText.split(/\n\s*\n/).filter(Boolean);

  // Person schema — the E-E-A-T signal the rankings depend on.
  const person = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${base}#coach`,
    name: "Coach Kyle Hayes",
    url: `${base}/about`,
    description: content.aboutText.replace(/\n+/g, " "),
    jobTitle: "Football coach and recruiting analyst",
    knowsAbout: ["High school football", "College football recruiting", "Football film evaluation", "Coaching", "Player development"],
    worksFor: { "@type": "Organization", name: site, url: base },
    award: "Florida State Championship",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(person) }} />

      <section className="page-hero">
        <div className="wrap">
          <span className="eyebrow">{content.aboutEyebrow}</span>
          <h1 className="anton">{content.aboutTitle1}<br /><span className="or">{content.aboutTitle2}</span></h1>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 56 }}>
        <div className="wrap">
          <div className="about">
            <div>
              {content.portrait && <img src={content.portrait} alt="Coach Kyle Hayes" className="about-portrait" />}
              <div className="astat"><div className="n">20+</div><div className="c">Years coaching</div></div>
              <div className="astat"><div className="n">1</div><div className="c">State championship</div></div>
            </div>
            <div className="abouttext">
              {paras.map((p, i) => (
                <p key={i} className={i > 0 ? "dim" : ""}>{p}</p>
              ))}
              {content.aboutClosingText && (
                <blockquote style={{ borderLeft: "3px solid var(--acc)", paddingLeft: 16, margin: "22px 0 4px", color: "var(--ink)", fontSize: 18, lineHeight: 1.5, fontStyle: "italic" }}>
                  {content.aboutClosingText}
                </blockquote>
              )}
              <Link className="pillbtn" href="/rankings">
                See the rankings <span className="arw"><Arrow /></span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
