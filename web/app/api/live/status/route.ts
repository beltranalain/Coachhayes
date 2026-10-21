import { NextResponse } from "next/server";
import { getLiveInputStatus } from "@/lib/stream";
import { PRIMARY_CHANNEL } from "@/lib/channels";
import { getSiteConfig } from "@/lib/siteConfig";
import { resolveYouTubeLive } from "@/lib/liveState";

export const dynamic = "force-dynamic";

// Public "is the show on right now?" for the website + app. Checks BOTH ways the
// coach can go live and tells the player which to show:
//   • youtube  — he went live on his YouTube channel (his usual way)
//   • cloudflare — he's broadcasting from the phone/studio (native WHIP)
// Heavily cached so the 100-unit YouTube search never runs more than once per
// window no matter how many viewers are polling.
type Status = { live: boolean; source: "youtube" | "cloudflare" | "off"; videoId: string | null; viewers: number | null };
let cache: { t: number; data: Status } | null = null;
const TTL = 20_000; // dedupe bursts; the YouTube search itself is cached 90s upstream

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.t < TTL) return NextResponse.json(cache.data);

  // YouTube first — it's how the coach normally goes live. The resolver keeps the
  // 100-unit search off during a show (confirms the known video with a 1-unit
  // call), so a 3-4h broadcast barely touches the quota.
  let youtubeLive = false, videoId: string | null = null, viewers: number | null = null;
  try {
    const { channels } = await getSiteConfig();
    const channelId = channels[0]?.channelId || PRIMARY_CHANNEL.channelId;
    const yt = await resolveYouTubeLive(channelId, now);
    youtubeLive = yt.live; videoId = yt.videoId; viewers = yt.viewers;
  } catch { /* ignore — fall through to Cloudflare / off */ }

  // Cloudflare native broadcast (the phone studio) as the other source.
  let cfLive = false;
  if (!youtubeLive) {
    try {
      const uid = process.env.CLOUDFLARE_STREAM_LIVE_INPUT_UID || process.env.NEXT_PUBLIC_CF_STREAM_LIVE_INPUT_UID || "";
      if (uid) { const s = await getLiveInputStatus(uid); cfLive = Boolean(s?.connected); }
    } catch { /* ignore */ }
  }

  const data: Status = youtubeLive
    ? { live: true, source: "youtube", videoId, viewers }
    : cfLive
      ? { live: true, source: "cloudflare", videoId: null, viewers: null }
      : { live: false, source: "off", videoId: null, viewers: null };

  cache = { t: now, data };
  return NextResponse.json(data);
}
