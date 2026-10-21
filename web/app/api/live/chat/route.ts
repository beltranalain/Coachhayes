import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { chatIdFromVideo, getLiveChatMessages, youtubeConfigured } from "@/lib/youtube";

export const dynamic = "force-dynamic";

// PUBLIC read-only mirror of the coach's YouTube live chat, so every viewer on
// the site/app sees it merged into the native Live chat. Polled by the chat UI.
//
// Quota-safe: ONE shared server poll per interval (respecting YouTube's
// pollingIntervalMillis) feeds all viewers — 5 or 5,000 viewers cost the same.
// The current live video id comes from the shared liveState doc, so we don't run
// the 100-unit search here.
type Buf = { videoId: string | null; liveChatId: string | null; pageToken?: string; messages: any[]; lastPoll: number; pollingMs: number };
let buf: Buf = { videoId: null, liveChatId: null, messages: [], lastPoll: 0, pollingMs: 5000 };

function reset(): Buf {
  return { videoId: null, liveChatId: null, messages: [], lastPoll: 0, pollingMs: 5000 };
}

export async function GET() {
  if (!youtubeConfigured) return NextResponse.json({ live: false, messages: [] });

  // Which video is live right now (set by /api/live/status). No search here.
  let videoId: string | null = null;
  try {
    const db = getAdminDb();
    if (db) { const s = await db.collection("site").doc("liveState").get(); videoId = (s.exists ? (s.data()?.videoId as string) : null) || null; }
  } catch { /* ignore */ }

  if (!videoId) { buf = reset(); return NextResponse.json({ live: false, messages: [] }); }

  // Resolve the chat id once per video (cheap videos.list), then reuse it.
  if (buf.videoId !== videoId || !buf.liveChatId) {
    const id = await chatIdFromVideo(videoId);
    buf = { ...reset(), videoId, liveChatId: id };
    if (!id) return NextResponse.json({ live: true, messages: [] }); // live but chat off
  }

  const now = Date.now();
  if (now - buf.lastPoll >= buf.pollingMs) {
    const page = await getLiveChatMessages(buf.liveChatId!, buf.pageToken);
    buf.lastPoll = now;
    if (page) {
      buf.pageToken = page.pageToken || undefined;
      buf.pollingMs = Math.max(4000, page.pollingMs || 5000);
      const seen = new Set(buf.messages.map((m) => m.id));
      for (const m of page.messages) if (m.id && !seen.has(m.id)) buf.messages.push({ ...m, source: "youtube" });
      buf.messages = buf.messages.slice(-80); // keep the recent tail
    } else {
      // chat ended / id went stale — re-resolve next request
      buf.liveChatId = null;
    }
  }

  return NextResponse.json({ live: true, messages: buf.messages });
}
