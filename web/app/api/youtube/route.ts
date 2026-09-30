import { NextResponse } from "next/server";
import { getSiteConfig } from "@/lib/siteConfig";
import {
  getUploads,
  getLiveInfo,
  getAllStats,
  youtubeConfigured,
} from "@/lib/youtube";

export const dynamic = "force-dynamic";

// GET /api/youtube?type=uploads|live|stats&channel=<key>
// Proxies the YouTube Data API so the key never reaches the browser. Channels
// come from the admin-managed list (Content -> Connected YouTube channels).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "uploads";
  const { channels } = await getSiteConfig();
  const list = channels;
  const channelKey = searchParams.get("channel") ?? list[0]?.key;

  if (!youtubeConfigured) {
    return NextResponse.json({ configured: false });
  }

  if (type === "stats") {
    const stats = await getAllStats(list.map((c) => c.channelId));
    return NextResponse.json({ configured: true, stats });
  }

  if (type === "live") {
    const info = await getLiveInfo(list[0]?.channelId || "");
    return NextResponse.json({ configured: true, ...info });
  }

  const channel = list.find((c) => c.key === channelKey);
  if (!channel) {
    return NextResponse.json({ error: "Unknown channel." }, { status: 400 });
  }
  const items = await getUploads(channel.uploadsPlaylist);
  return NextResponse.json({ configured: true, channel: channel.key, items });
}
