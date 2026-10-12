import type { MetadataRoute } from "next";
import { getAllPlayerSlugs, getRankingFacets } from "@/lib/rankings";
import { getPublishedPosts } from "@/lib/blog";
import { getSiteConfig } from "@/lib/siteConfig";

export const dynamic = "force-dynamic";

// Dynamic sitemap: static pages + every published player page + class-year
// landing pages + the blog (index + every published post). Generated from the
// database on each request so search + AI engines discover the whole site with
// real lastmod per URL. Admin/manage/api/overlay/join are excluded (not listed).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { branding } = await getSiteConfig();
  const base = `https://${(branding.domain || "coachhayesfootball.com").replace(/^https?:\/\//, "")}`;
  const now = new Date();

  const staticPages = ["", "/live", "/community", "/rankings", "/rankings/submit", "/rankings/how-it-works", "/blog", "/fantasy", "/shop", "/membership"].map((p) => ({
    url: `${base}${p}`,
    lastModified: now,
    changeFrequency: (p === "/rankings" || p === "/blog" ? "daily" : "weekly") as "daily" | "weekly",
    priority: p === "/rankings" ? 0.9 : p === "" ? 1 : 0.7,
  }));

  const [players, facets, posts] = await Promise.all([getAllPlayerSlugs(), getRankingFacets(), getPublishedPosts()]);
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
  const blogPages = posts.map((p) => ({
    url: `${base}/blog/${p.slug}`,
    lastModified: p.publishedAt ? new Date(p.publishedAt) : (p.updatedAt ? new Date(p.updatedAt) : now),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...playerPages, ...classPages, ...blogPages];
}
