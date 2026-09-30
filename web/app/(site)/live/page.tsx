import type { Metadata } from "next";
import Link from "next/link";
import { PRIMARY_CHANNEL } from "@/lib/channels";
import { getSiteConfig, getHayesContent } from "@/lib/siteConfig";
import { getLiveInfo } from "@/lib/youtube";
import LivePlayer from "@/components/LivePlayer";
import LiveHeadline from "@/components/hayes/LiveHeadline";
import LivePinnedOverlay from "@/components/LivePinnedOverlay";
import LiveChat from "@/components/hayes/LiveChat";

export const metadata: Metadata = { title: "Live" };

export default async function LivePage() {
  const [{ schedule, branding }, content] = await Promise.all([getSiteConfig(), getHayesContent()]);
  const c = content.live;
  const channelId = branding.youtubeChannelId || PRIMARY_CHANNEL.channelId;
  const live = await getLiveInfo(channelId);

  const cfCode = process.env.NEXT_PUBLIC_CF_STREAM_CUSTOMER_CODE;
  const cfInput = process.env.NEXT_PUBLIC_CF_STREAM_LIVE_INPUT_UID;
  const onOwnPlatform = Boolean(cfCode && cfInput);
  const playerSrc = onOwnPlatform
    ? `https://customer-${cfCode}.cloudflarestream.com/${cfInput}/iframe`
    : `https://www.youtube.com/embed/live_stream?channel=${channelId}`;

  const upcoming = [...schedule]
    .sort((a, b) => (a.startsAt ?? 0) - (b.startsAt ?? 0))
    .filter((x) => (x.startsAt ?? 0) > Date.now());
  const next = upcoming[0];

  return (
    <div className="wide" style={{ paddingTop: 22 }}>
      <div className="liveGrid">
        <div className="lmain">
          <div className="lstage">
            <LivePlayer src={playerSrc} logo={branding.logo} />
            <LivePinnedOverlay />
          </div>

          <div className="lmeta">
            <LiveHeadline
              initialLive={live.live}
              siteName={branding.siteName}
              showLabel={c.showLabelSuffix}
              onAir={c.onAirHeadline}
              offAir={c.offAirHeadline}
              channelId={channelId}
              watchLabel={c.watchYouTubeLabel}
              callLabel={c.callInLabel}
              pastLabel={c.pastLabel}
            />

            {next && (
              <div className="nextcard" style={{ marginTop: 20 }}>
                <div className="nc-body">
                  <span className="nc-eyebrow">Up next</span>
                  <span className="nc-title">{next.title}</span>
                  <span className="nc-when">{next.when}{next.note ? ` · ${next.note}` : ""}</span>
                </div>
              </div>
            )}

            <p style={{ marginTop: 16, fontSize: 13, color: "var(--sub)" }}>
              {onOwnPlatform ? c.ownPlatformNote : c.youtubeFallbackNote}
            </p>
          </div>
        </div>

        <LiveChat hostName={branding.hostName || "Coach Hayes"} />
      </div>
    </div>
  );
}
