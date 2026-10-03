import type { Metadata } from "next";
import Link from "next/link";
import { getHayesContent } from "@/lib/siteConfig";
import { stripeConfigured, MEMBERSHIP_PRICES } from "@/lib/stripe";
import MembershipJoin from "@/components/MembershipJoin";

export const metadata: Metadata = {
  title: "Membership",
  description: "Membership tiers on Coach Hayes Football — support the show and keep more of it with Coach.",
};

// All copy, prices and features come from content.membership (admin-editable).
// Prices are unconfirmed in the brief; the tier `disabled` flag keeps checkout
// off until the membership phase wires Stripe subscriptions.
export default async function MembershipPage() {
  const { membership: c } = await getHayesContent();
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
              // Paid tiers: on-site Stripe Payment Element checkout (no redirect).
              // `enabled` only when Stripe + this tier's price are configured.
              <MembershipJoin tier={tier.key} tierName={tier.name} price={`${tier.price}${tier.priceSuffix ? " " + tier.priceSuffix : ""}`} cta={tier.cta} highlight={tier.highlight} enabled={stripeConfigured && !!MEMBERSHIP_PRICES[tier.key]} />
            )}
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 22 }}>
        <h3 style={{ fontSize: 18, marginBottom: 8 }}>{c.ytCardTitle}</h3>
        <p style={{ fontSize: 14.5, color: "var(--sub)", marginBottom: 16 }}>{c.ytCardText}</p>
        <span className="pill sm soft" aria-disabled title="Coming in the membership phase">{c.ytCardCta}</span>
      </div>
    </div>
  );
}
