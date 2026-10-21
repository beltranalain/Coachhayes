import type { Metadata } from "next";
import Link from "next/link";
import { getHayesContent, getSiteConfig } from "@/lib/siteConfig";
import { PRIMARY_CHANNEL } from "@/lib/channels";
import LinkYouTube from "@/components/LinkYouTube";

export const metadata: Metadata = {
  title: "Membership",
  description: "Membership tiers on Coach Hayes Football — become a member on YouTube and your perks carry over to the site, app and Discord.",
};

// Membership is YouTube-first: new members join on Coach's YouTube channel (where
// his tiers + billing already live), then link their account here so the perks
// carry over to the site, app, community and Discord. Copy/prices come from
// content.membership (admin-editable).
export default async function MembershipPage() {
  const [{ membership: c }, { channels }] = await Promise.all([getHayesContent(), getSiteConfig()]);
  const ch = channels[0] || PRIMARY_CHANNEL;
  const youtubeJoinUrl = `${(ch.url || "https://www.youtube.com/@CoachHayesFootball").replace(/\/$/, "")}/join`;
  return (
    <div className="wide" style={{ paddingTop: 34, paddingBottom: 40 }}>
      <div className="hd center">
        <h2>{c.heading}</h2>
        <p>{c.intro}</p>
      </div>

      <div className="g3">
        {c.tiers.map((tier) => (
          <div className={`tier${tier.highlight ? " on" : ""}`} key={tier.key}>
            <h3>{tier.name}</h3>
            <p className="who">{tier.who}</p>
            <div className="price">
              {tier.price} {tier.priceSuffix && <small>{tier.priceSuffix}</small>}
            </div>
            <p className="feeline">{tier.feeline}</p>
            <ul>
              {tier.features.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
            {tier.key === "free" ? (
              <Link className="link" href="/account">{tier.cta}</Link>
            ) : (
              // Paid tiers: become a member on YouTube (his tiers + billing live
              // there), then link back here for site/app/Discord perks.
              <a className={`pill${tier.highlight ? "" : " dark"}`} href={youtubeJoinUrl} target="_blank" rel="noopener noreferrer">{tier.cta}</a>
            )}
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 22 }}>
        <h3 style={{ fontSize: 18, marginBottom: 8 }}>{c.ytCardTitle}</h3>
        <p style={{ fontSize: 14.5, color: "var(--sub)", marginBottom: 16 }}>{c.ytCardText}</p>
        <LinkYouTube label={c.ytCardCta} />
      </div>
    </div>
  );
}
