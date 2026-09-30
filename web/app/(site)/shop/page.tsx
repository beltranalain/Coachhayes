import type { Metadata } from "next";
import Link from "next/link";
import { getHayesContent } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Shop",
  description: "Coach Hayes Football merch — print-on-demand, on his own site, with member pricing.",
};

// All copy comes from content.shop (admin-editable). Products come from the POD
// provider into `products` with member pricing + on-domain checkout (Phase 5).
export default async function ShopPage() {
  const { shop: c } = await getHayesContent();
  return (
    <div className="wide" style={{ paddingTop: 34, paddingBottom: 40 }}>
      <div className="hd center">
        <h2>{c.heading}</h2>
        <p>{c.intro}</p>
      </div>

      <div className="card" style={{ textAlign: "center", padding: "56px 30px" }}>
        <h3 style={{ marginBottom: 8 }}>{c.emptyTitle}</h3>
        <p style={{ color: "var(--sub)", maxWidth: "46ch", margin: "0 auto" }}>{c.emptyText}</p>
        <Link className="pill" href="/membership" style={{ marginTop: 18 }}>{c.memberCta}</Link>
      </div>
    </div>
  );
}
