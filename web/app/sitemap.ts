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

  const [players, facets, posts] = await Promise.all([getAllPlayerSlugs(), getRankingFacets(), getPublishedPosts()]);

  // Real content timestamps so lastmod means "actually changed", not "built
  // today" (a build-time stamp on every page is a signal crawlers discount).
  const latestPlayer = players.reduce((m, p) => Math.max(m, p.updatedAt || 0), 0);
  const latestPost = posts.reduce((m, p) => Math.max(m, p.publishedAt || p.updatedAt || 0), 0);
  const latestPlayerInClass = (y: string) => players.reduce((m, p) => Math.max(m, (p.slug.endsWith(`-${y}`) ? (p.updatedAt || 0) : 0)), 0);

  // Static pages: only stamp lastmod where there's a real content signal (home,
  // the board, the blog index). Genuinely static pages omit it entirely.
  const staticLastMod: Record<string, number> = {
    "": Math.max(latestPlayer, latestPost),
    "/rankings": latestPlayer,
    "/blog": latestPost,
  };
  const staticPages = ["", "/live", "/community", "/rankings", "/rankings/submit", "/rankings/how-it-works", "/blog", "/fantasy", "/shop", "/membership"].map((p) => {
    const ts = staticLastMod[p];
    return {
      url: `${base}${p}`,
      ...(ts ? { lastModified: new Date(ts) } : {}),
      changeFrequency: (p === "/rankings" || p === "/blog" ? "daily" : "weekly") as "daily" | "weekly",
      priority: p === "/rankings" ? 0.9 : p === "" ? 1 : 0.7,
    };
  });

  const playerPages = players.map((p) => ({
    url: `${base}/rankings/${p.slug}`,
    ...(p.updatedAt ? { lastModified: new Date(p.updatedAt) } : {}),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
  const classPages = facets.years.map((y) => {
    const ts = latestPlayerInClass(y);
    return {
      url: `${base}/rankings/class/${y}`,
      ...(ts ? { lastModified: new Date(ts) } : {}),
      changeFrequency: "daily" as const,
      priority: 0.8,
    };
  });
  const blogPages = posts.map((p) => ({
    url: `${base}/blog/${p.slug}`,
    ...(p.publishedAt || p.updatedAt ? { lastModified: new Date(p.publishedAt || p.updatedAt) } : {}),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...playerPages, ...classPages, ...blogPages];
}
