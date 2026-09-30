import "server-only";

// Server-side YouTube Data API v3 helpers. The API key stays on the server.
// Every function degrades gracefully (returns empty / null) when no key is set.

const API = "https://www.googleapis.com/youtube/v3";
const KEY = process.env.YOUTUBE_API_KEY;

export const youtubeConfigured = Boolean(KEY);

export type YtVideo = {
  id: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
};

export async function getUploads(
  uploadsPlaylistId: string,
  max = 12
): Promise<YtVideo[]> {
  if (!KEY) return [];
  const out: YtVideo[] = [];
  let pageToken = "";
  try {
    // Page through the uploads playlist (50 per call) until we hit `max` or run
    // out, so channels with more than one page still show every video.
    while (out.length < max) {
      const url = `${API}/playlistItems?part=snippet&maxResults=50&playlistId=${uploadsPlaylistId}&key=${KEY}${pageToken ? `&pageToken=${pageToken}` : ""}`;
      const res = await fetch(url, { next: { revalidate: 1800 } });
      if (!res.ok) break;
      const data = await res.json();
      for (const item of data.items ?? []) {
        const s = item.snippet ?? {};
        const t = s.thumbnails ?? {};
        out.push({
          id: s.resourceId?.videoId ?? "",
          title: s.title ?? "",
          publishedAt: s.publishedAt ?? "",
          thumbnail: (t.medium ?? t.high ?? t.default ?? {}).url ?? "",
        } as YtVideo);
      }
      pageToken = data.nextPageToken ?? "";
      if (!pageToken) break;
    }
    return out.slice(0, max);
  } catch {
    return out;
  }
}

// Returns the videoId of an active live broadcast for a channel, or null.
export async function getLiveVideoId(channelId: string): Promise<string | null> {
  if (!KEY) return null;
  const url = `${API}/search?part=id&channelId=${channelId}&eventType=live&type=video&key=${KEY}`;
  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.items?.[0]?.id?.videoId ?? null;
  } catch {
    return null;
  }
}

export type LiveInfo = { live: boolean; videoId: string | null; viewers: number | null };

// Whether a channel is live right now, plus concurrent viewers if available.
export async function getLiveInfo(channelId: string): Promise<LiveInfo> {
  const videoId = await getLiveVideoId(channelId);
  if (!videoId || !KEY) return { live: Boolean(videoId), videoId, viewers: null };
  try {
    const res = await fetch(
      `${API}/videos?part=liveStreamingDetails&id=${videoId}&key=${KEY}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return { live: true, videoId, viewers: null };
    const data = await res.json();
    const c = data.items?.[0]?.liveStreamingDetails?.concurrentViewers;
    return { live: true, videoId, viewers: c ? Number(c) : null };
  } catch {
    return { live: true, videoId, viewers: null };
  }
}

// ---- Live chat: read messages from an active broadcast (public, API key) ----

// Resolve the active live broadcast's chat id for a channel, or null if the
// channel isn't live (or has live chat disabled).
export async function getActiveLiveChatId(channelId: string): Promise<string | null> {
  if (!KEY) return null;
  const videoId = await getLiveVideoId(channelId);
  if (!videoId) return null;
  try {
    const res = await fetch(
      `${API}/videos?part=liveStreamingDetails&id=${videoId}&key=${KEY}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.items?.[0]?.liveStreamingDetails?.activeLiveChatId ?? null;
  } catch {
    return null;
  }
}

// Pull a YouTube video ID out of any common watch/live/share URL - or accept a
// bare 11-char ID as-is. Returns "" if nothing looks like an ID.
export function parseVideoId(input: string): string {
  const s = (input || "").trim();
  if (!s) return "";
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s; // already a bare ID
  const m = s.match(/(?:v=|\/live\/|youtu\.be\/|\/watch\?.*v=|\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : "";
}

// Resolve the active live chat id directly from a known video ID. Works for
// PUBLIC and UNLISTED broadcasts (an API key can read either given the id) -
// unlike search, which only surfaces public streams. Private is not accessible.
export async function chatIdFromVideo(videoId: string): Promise<string | null> {
  if (!KEY || !videoId) return null;
  try {
    const res = await fetch(
      `${API}/videos?part=liveStreamingDetails&id=${videoId}&key=${KEY}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.items?.[0]?.liveStreamingDetails?.activeLiveChatId ?? null;
  } catch {
    return null;
  }
}

export type LiveChatMessage = { id: string; name: string; text: string; ts: number };
export type LiveChatPage = {
  messages: LiveChatMessage[];
  pageToken: string | null; // pass back next call to get only newer messages
  pollingMs: number;        // YouTube's recommended poll interval
};

// One page of live chat messages. Pass the previous pageToken to fetch only
// messages newer than the last call.
export async function getLiveChatMessages(
  liveChatId: string,
  pageToken?: string
): Promise<LiveChatPage | null> {
  if (!KEY) return null;
  const params = new URLSearchParams({
    liveChatId,
    part: "snippet,authorDetails",
    maxResults: "200",
    key: KEY,
  });
  if (pageToken) params.set("pageToken", pageToken);
  try {
    const res = await fetch(`${API}/liveChat/messages?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const messages: LiveChatMessage[] = (data.items ?? [])
      .map((it: any) => {
        const s = it.snippet ?? {};
        return {
          id: String(it.id ?? ""),
          name: String(it.authorDetails?.displayName ?? "YouTube"),
          text: String(s.displayMessage ?? s.textMessageDetails?.messageText ?? ""),
          ts: Date.parse(s.publishedAt ?? "") || Date.now(),
        } as LiveChatMessage;
      })
      .filter((m: LiveChatMessage) => m.text);
    return {
      messages,
      pageToken: data.nextPageToken ?? null,
      pollingMs: Number(data.pollingIntervalMillis) || 5000,
    };
  } catch {
    return null;
  }
}

export type ChannelStats = { subscribers: number; views: number; videos: number };

// Aggregate statistics across one or more channels (one API call).
export async function getAllStats(channelIds: string[]): Promise<ChannelStats | null> {
  if (!KEY || channelIds.length === 0) return null;
  const url = `${API}/channels?part=statistics&id=${channelIds.join(",")}&key=${KEY}`;
  try {
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return null;
    const data = await res.json();
    let subscribers = 0, views = 0, videos = 0;
    for (const it of data.items ?? []) {
      const s = it.statistics ?? {};
      subscribers += Number(s.subscriberCount || 0);
      views += Number(s.viewCount || 0);
      videos += Number(s.videoCount || 0);
    }
    return { subscribers, views, videos };
  } catch {
    return null;
  }
}

export type ChannelStatRow = { channelId: string; subscribers: number; views: number; videos: number };

// Per-channel statistics (for comparison charts). One API call.
export async function getStatsByChannel(channelIds: string[]): Promise<ChannelStatRow[]> {
  if (!KEY || channelIds.length === 0) return [];
  const url = `${API}/channels?part=statistics&id=${channelIds.join(",")}&key=${KEY}`;
  try {
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []).map((it: any) => ({
      channelId: String(it.id || ""),
      subscribers: Number(it.statistics?.subscriberCount || 0),
      views: Number(it.statistics?.viewCount || 0),
      videos: Number(it.statistics?.videoCount || 0),
    }));
  } catch {
    return [];
  }
}
