import { PRIMARY_CHANNEL } from "@/lib/channels";
import { getLiveInfo } from "@/lib/youtube";
import { getSiteConfig, getHayesContent } from "@/lib/siteConfig";
import { getPublishedPlayers, CHIP_META } from "@/lib/rankings";
import { getPublishedPosts, readingMinutes } from "@/lib/blog";
import Home from "@/components/hayes/Home";

export default async function HomePage() {
  const [{ schedule, branding }, content, players, posts] = await Promise.all([getSiteConfig(), getHayesContent(), getPublishedPlayers(), getPublishedPosts(3)]);
  const live = await getLiveInfo(branding.youtubeChannelId || PRIMARY_CHANNEL.channelId);

  // Latest blog posts for the home-page strip.
  const latestPosts = posts.map((p) => ({
    slug: p.slug, title: p.title, excerpt: p.excerpt, coverImage: p.coverImage,
    category: p.categories[0] || "", readMins: readingMinutes(p.content),
    date: p.publishedAt ? new Date(p.publishedAt).toLocaleDateString("en-US", { dateStyle: "medium" }) : "",
  }));

  // Top of the board preview — the top few published players, in rank order.
  const topRankings = players.slice(0, 5).map((p) => ({
    slug: p.slug, name: p.name, position: p.position, school: p.school, classYear: p.classYear,
    chip: p.chip, chipLabel: CHIP_META[p.chip].label, categories: p.categories,
    commit: p.commit, commitLogo: p.commitLogo, videoUrl: p.videoUrl,
  }));
  const week = [...schedule]
    .sort((a, b) => (a.startsAt ?? 0) - (b.startsAt ?? 0))
    .map((it) => ({ when: it.when, title: it.title, note: it.note }));

  const cfCode = process.env.NEXT_PUBLIC_CF_STREAM_CUSTOMER_CODE;
  const cfInput = process.env.NEXT_PUBLIC_CF_STREAM_LIVE_INPUT_UID;
  const channelId = branding.youtubeChannelId || PRIMARY_CHANNEL.channelId;
  const playerSrc = cfCode && cfInput
    ? `https://customer-${cfCode}.cloudflarestream.com/${cfInput}/iframe`
    : `https://www.youtube.com/embed/live_stream?channel=${channelId}`;

  return (
    <Home
      tagline={branding.tagline}
      logo={branding.logo}
      content={content.home}
      live={{ live: live.live, viewers: live.viewers ?? undefined }}
      playerSrc={playerSrc}
      schedule={week}
      rankings={{ total: players.length, top: topRankings }}
      posts={latestPosts}
    />
  );
}
