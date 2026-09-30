import { PRIMARY_CHANNEL } from "@/lib/channels";
import { getLiveInfo } from "@/lib/youtube";
import { getSiteConfig, getHayesContent } from "@/lib/siteConfig";
import Home from "@/components/hayes/Home";

export default async function HomePage() {
  const [{ schedule, branding }, content] = await Promise.all([getSiteConfig(), getHayesContent()]);
  const live = await getLiveInfo(branding.youtubeChannelId || PRIMARY_CHANNEL.channelId);
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
    />
  );
}
