import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { getActiveLiveChatId, getLiveChatMessages, chatIdFromVideo, parseVideoId, youtubeConfigured } from "@/lib/youtube";
import { getSiteConfig } from "@/lib/siteConfig";
import { PRIMARY_CHANNEL } from "@/lib/channels";

export const dynamic = "force-dynamic";

// GET /api/chat/youtube?liveChatId=...&pageToken=...&channelId=...
//
// Reads a page of the active YouTube live chat so the Studio can merge it into
// the site chat. Admin-only (the host's Studio) to protect our API quota. The
// caller caches liveChatId + pageToken between polls so steady-state is one
// cheap request per interval.
export async function GET(request: Request) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  if (!youtubeConfigured) {
    return NextResponse.json({ configured: false, live: false });
  }

  const url = new URL(request.url);
  let liveChatId = url.searchParams.get("liveChatId") || "";
  const pageToken = url.searchParams.get("pageToken") || undefined;

  // Resolve the live chat id once (client caches it). A direct video URL/ID wins
  // (works for UNLISTED streams too); otherwise auto-detect from the channel via
  // search (PUBLIC streams only). Private streams are never accessible by API key.
  if (!liveChatId) {
    const liveUrl = url.searchParams.get("liveUrl") || url.searchParams.get("videoId") || "";
    const videoId = parseVideoId(liveUrl);
    if (videoId) {
      liveChatId = (await chatIdFromVideo(videoId)) || "";
    } else {
      let channelId = url.searchParams.get("channelId") || "";
      if (!channelId) {
        const { branding } = await getSiteConfig();
        channelId = branding.youtubeChannelId || PRIMARY_CHANNEL.channelId;
      }
      liveChatId = (await getActiveLiveChatId(channelId)) || "";
    }
    if (!liveChatId) return NextResponse.json({ configured: true, live: false });
  }

  const page = await getLiveChatMessages(liveChatId, pageToken);
  if (!page) {
    // Chat ended or the id went stale - tell the client to re-resolve.
    return NextResponse.json({ configured: true, live: false, liveChatId: null });
  }

  return NextResponse.json({
    configured: true,
    live: true,
    liveChatId,
    messages: page.messages,
    pageToken: page.pageToken,
    pollingMs: page.pollingMs,
  });
}
