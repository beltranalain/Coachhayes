import type { Metadata } from "next";
import { PRIMARY_CHANNEL } from "@/lib/channels";
import { getSiteConfig, getHayesContent } from "@/lib/siteConfig";
import { visibleSeries } from "@/lib/siteData";
import { getLiveInfo } from "@/lib/youtube";
import CommunityFeed from "@/components/hayes/CommunityFeed";

export const metadata: Metadata = {
  title: "Community",
  description: "The Locker Room — talk football with people who actually watch the tape.",
};

// The Locker Room feed: real posts/likes/comments (Firestore) with a live-status
// player in the rail. Copy comes from content.community (admin-editable).
export default async function CommunityPage() {
  const [{ branding, content: siteContent }, content] = await Promise.all([getSiteConfig(), getHayesContent()]);
  const c = content.community;
  const shows = visibleSeries(siteContent.series).map((s) => ({ key: s.key, title: s.title, href: s.href || "/live", art: s.art, image: s.image || "" }));
  const live = await getLiveInfo(branding.youtubeChannelId || PRIMARY_CHANNEL.channelId);
  const cfCode = process.env.NEXT_PUBLIC_CF_STREAM_CUSTOMER_CODE;
  const cfInput = process.env.NEXT_PUBLIC_CF_STREAM_LIVE_INPUT_UID;
  const channelId = branding.youtubeChannelId || PRIMARY_CHANNEL.channelId;
  const playerSrc = cfCode && cfInput
    ? `https://customer-${cfCode}.cloudflarestream.com/${cfInput}/iframe`
    : `https://www.youtube.com/embed/live_stream?channel=${channelId}`;

  return (
    <div className="wide" style={{ paddingTop: 26, paddingBottom: 40 }}>
      <CommunityFeed content={c} shows={shows} playerSrc={playerSrc} liveInitial={live.live} logo={branding.logo} />
    </div>
  );
}
