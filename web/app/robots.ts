import type { MetadataRoute } from "next";
import { getSiteConfig } from "@/lib/siteConfig";

export const dynamic = "force-dynamic";

// Robots: welcome search engines AND the major AI crawlers (so the rankings get
// picked up and cited by ChatGPT, Claude, Perplexity, Google AI). Admin is
// disallowed. Points crawlers at the dynamic sitemap.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const { branding } = await getSiteConfig();
  const base = `https://${(branding.domain || "coachhayesfootball.com").replace(/^https?:\/\//, "")}`;
  const aiBots = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-Web", "anthropic-ai", "PerplexityBot", "Google-Extended", "Applebot-Extended", "CCBot", "Bytespider", "Amazonbot"];
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/manage", "/api", "/overlay", "/join"] },
      ...aiBots.map((ua) => ({ userAgent: ua, allow: "/", disallow: ["/admin", "/manage", "/api"] })),
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
