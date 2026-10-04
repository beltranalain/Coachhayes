import type { Metadata } from "next";
import { getHayesContent } from "@/lib/siteConfig";
import ShopGrid from "@/components/ShopGrid";

export const metadata: Metadata = {
  title: "Shop",
  description: "Coach Hayes Football merch — on his own site, with on-domain checkout.",
};

// Copy comes from content.shop (admin-editable); products are admin-created in
// Manage → Merch and bought on-site via Stripe (no hosted redirect).
export default async function ShopPage() {
  const { shop: c } = await getHayesContent();
  return (
    <div className="wide" style={{ paddingTop: 34, paddingBottom: 40 }}>
      <div className="hd center">
        <h2>{c.heading}</h2>
        <p>{c.intro}</p>
      </div>
      <ShopGrid emptyTitle={c.emptyTitle} emptyText={c.emptyText} />
    </div>
  );
}
