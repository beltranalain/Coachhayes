import type { MetadataRoute } from "next";
import { getAllPlayerSlugs, getRankingFacets } from "@/lib/rankings";
import { getSiteConfig } from "@/lib/siteConfig";

export const dynamic = "force-dynamic";

// Dynamic sitemap: static pages + every published player page + the class-year
// landing pages. This is how search + AI engines discover the whole board.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { branding } = await getSiteConfig();
  const base = `https://${(branding.domain || "coachhayesfootball.com").replace(/^https?:\/\//, "")}`;
  const now = new Date();

  const staticPages = ["", "/live", "/community", "/rankings", "/rankings/submit", "/rankings/how-it-works", "/fantasy", "/shop", "/membership"].map((p) => ({
    url: `${base}${p}`,
    lastModified: now,
    changeFrequency: (p === "/rankings" ? "daily" : "weekly") as "daily" | "weekly",
    priority: p === "/rankings" ? 0.9 : p === "" ? 1 : 0.7,
  }));

  const [players, facets] = await Promise.all([getAllPlayerSlugs(), getRankingFacets()]);
  const playerPages = players.map((p) => ({
    url: `${base}/rankings/${p.slug}`,
    lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
  const classPages = facets.years.map((y) => ({
    url: `${base}/rankings/class/${y}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...playerPages, ...classPages];
}
