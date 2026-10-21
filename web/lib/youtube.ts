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

export type YtPlaylist = { id: string; title: string; description: string; thumbnail: string; itemCount: number };

// A channel's playlists — each is a "series" (show). 1 unit per 50, cached.
export async function getPlaylists(channelId: string, max = 50): Promise<YtPlaylist[]> {
  if (!KEY || !channelId) return [];
  const out: YtPlaylist[] = [];
  let pageToken = "";
  try {
    while (out.length < max) {
      const url = `${API}/playlists?part=snippet,contentDetails&maxResults=50&channelId=${channelId}&key=${KEY}${pageToken ? `&pageToken=${pageToken}` : ""}`;
      const res = await fetch(url, { next: { revalidate: 1800 } });
      if (!res.ok) break;
      const data = await res.json();
      for (const it of data.items ?? []) {
        const s = it.snippet ?? {}; const t = s.thumbnails ?? {};
        out.push({ id: it.id, title: s.title ?? "", description: s.description ?? "", thumbnail: (t.medium ?? t.high ?? t.default ?? {}).url ?? "", itemCount: Number(it.contentDetails?.itemCount) || 0 });
      }
      pageToken = data.nextPageToken ?? "";
      if (!pageToken) break;
    }
    return out.slice(0, max);
  } catch {
    return out;
  }
}

// One page (up to 50) of a channel's uploads + the token for the next page.
// Used by the Library's "load more" so we page lazily instead of pulling it all.
export async function getUploadsPage(
  uploadsPlaylistId: string,
  pageToken?: string
): Promise<{ items: YtVideo[]; nextPageToken: string | null }> {
  if (!KEY) return { items: [], nextPageToken: null };
  try {
    const url = `${API}/playlistItems?part=snippet&maxResults=50&playlistId=${uploadsPlaylistId}&key=${KEY}${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return { items: [], nextPageToken: null };
    const data = await res.json();
    const items: YtVideo[] = (data.items ?? [])
      .map((item: any) => {
        const s = item.snippet ?? {}; const t = s.thumbnails ?? {};
        return { id: s.resourceId?.videoId ?? "", title: s.title ?? "", publishedAt: s.publishedAt ?? "", thumbnail: (t.medium ?? t.high ?? t.default ?? {}).url ?? "" };
      })
      .filter((v: YtVideo) => v.id);
    return { items, nextPageToken: data.nextPageToken ?? null };
  } catch {
    return { items: [], nextPageToken: null };
  }
}

export type YtLatest = { id: string; title: string; ts: number };

// The genuinely-latest video in a playlist = the item with the MAX video-publish
// date (playlists have inconsistent ordering, so items[0] is unreliable). Pages
// with part=snippet,contentDetails (1 unit/page), cached; capped so huge
// playlists stay cheap. Returns null if the playlist is empty / unreadable.
export async function getPlaylistLatestVideo(playlistId: string, maxPages = 7): Promise<YtLatest | null> {
  if (!KEY || !playlistId) return null;
  let token = "", pages = 0;
  let best: YtLatest | null = null;
  try {
    while (pages < maxPages) {
      const url = `${API}/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${playlistId}&key=${KEY}${token ? `&pageToken=${token}` : ""}`;
      const res = await fetch(url, { next: { revalidate: 1800 } });
      if (!res.ok) break;
      const data = await res.json();
      for (const it of data.items ?? []) {
        const ts = Date.parse(it.contentDetails?.videoPublishedAt || it.snippet?.publishedAt || "") || 0;
        const id = it.snippet?.resourceId?.videoId || it.contentDetails?.videoId || "";
        if (id && ts > (best?.ts ?? -1)) best = { id, title: it.snippet?.title || "", ts };
      }
      token = data.nextPageToken ?? ""; pages++;
      if (!token) break;
    }
  } catch { /* ignore */ }
  return best;
}

// All video ids in a playlist (paged, cached, capped). Used to map a recent
// upload back to the series/playlist it belongs to.
export async function getPlaylistVideoIds(playlistId: string, maxPages = 7): Promise<string[]> {
  if (!KEY || !playlistId) return [];
  const ids: string[] = []; let token = "", pages = 0;
  try {
    while (pages < maxPages) {
      const url = `${API}/playlistItems?part=contentDetails&maxResults=50&playlistId=${playlistId}&key=${KEY}${token ? `&pageToken=${token}` : ""}`;
      const res = await fetch(url, { next: { revalidate: 1800 } });
      if (!res.ok) break;
      const data = await res.json();
      for (const it of data.items ?? []) { const id = it.contentDetails?.videoId; if (id) ids.push(id); }
      token = data.nextPageToken ?? ""; pages++;
      if (!token) break;
    }
  } catch { /* ignore */ }
  return ids;
}

function parseDuration(iso: string): number {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || "");
  if (!m) return 0;
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
}

export type VideoKind = "short" | "video" | "live";

// Classify videos by duration + whether they were a livestream, so the Library
// can filter Videos / Shorts / Live replays. videos.list is 1 unit per 50 ids.
export async function classifyVideos(ids: string[]): Promise<Record<string, { durationSec: number; kind: VideoKind }>> {
  const out: Record<string, { durationSec: number; kind: VideoKind }> = {};
  if (!KEY || !ids.length) return out;
  try {
    const res = await fetch(`${API}/videos?part=contentDetails,liveStreamingDetails&id=${ids.slice(0, 50).join(",")}&key=${KEY}`, { next: { revalidate: 1800 } });
    if (!res.ok) return out;
    const data = await res.json();
    for (const it of data.items ?? []) {
      const durationSec = parseDuration(it.contentDetails?.duration || "");
      const wasLive = Boolean(it.liveStreamingDetails?.actualStartTime);
      // YouTube Shorts can be up to ~3 minutes, so treat anything <=180s (that
      // isn't a livestream) as a Short.
      const kind: VideoKind = wasLive ? "live" : durationSec > 0 && durationSec <= 180 ? "short" : "video";
      out[it.id] = { durationSec, kind };
    }
  } catch { /* ignore */ }
  return out;
}

// Returns the videoId of an active live broadcast for a channel, or null.
// search.list costs 100 quota units, so the result is cached (revalidate) and
// shared across all callers — one real call per window regardless of traffic.
export async function getLiveVideoId(channelId: string): Promise<string | null> {
  if (!KEY) return null;
  const url = `${API}/search?part=id&channelId=${channelId}&eventType=live&type=video&key=${KEY}`;
  try {
    const res = await fetch(url, { next: { revalidate: 90 } });
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

// Cheap (1-unit videos.list) check of whether a KNOWN video is still live, plus
// its viewer count. Used to keep a show "on air" without re-running the 100-unit
// search every poll — the single biggest quota saver for long broadcasts.
export async function checkVideoLive(videoId: string): Promise<{ live: boolean; viewers: number | null }> {
  if (!KEY || !videoId) return { live: false, viewers: null };
  try {
    const res = await fetch(
      `${API}/videos?part=snippet,liveStreamingDetails&id=${videoId}&key=${KEY}`,
      { cache: "no-store" }
    );
    if (!res.ok) return { live: false, viewers: null };
    const data = await res.json();
    const item = data.items?.[0];
    if (!item) return { live: false, viewers: null };
    const details = item.liveStreamingDetails || {};
    // Still live only if YouTube says "live" and it hasn't actually ended.
    const live = item.snippet?.liveBroadcastContent === "live" && !details.actualEndTime;
    const c = details.concurrentViewers;
    return { live, viewers: c ? Number(c) : null };
  } catch {
    return { live: false, viewers: null };
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
