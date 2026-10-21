import "server-only";

import { getAdminDb } from "./firebaseAdmin";
import { getPlaylists, getPlaylistLatestVideo, getPlaylistVideoIds, getUploadsPage, type YtPlaylist } from "./youtube";
import { getSiteConfig } from "./siteConfig";
import { PRIMARY_CHANNEL } from "./channels";
import { visibleSeries, type Series } from "./siteData";

// Shows = the coach's YouTube playlists (auto), with per-playlist overrides +
// fully-manual custom shows layered on top. Stored config lives in Firestore
// site/shows: { overrides: { [playlistId]: {...} }, manual: Series[] }. Falls
// back to the manually-edited content.series when YouTube isn't connected.

export type ShowOverride = { visible?: boolean; order?: number; title?: string; blurb?: string; image?: string };
export type ShowsConfig = { overrides: Record<string, ShowOverride>; manual: Series[] };

const ART = ["a2", "a5", "a3", "a4", "a6", "a1"];
// By default we show up to N series that are actually ACTIVE — most-recent first,
// and only if their latest video is within MAX_AGE_DAYS. This avoids padding the
// strip with stale, long-dormant playlists; the admin can still toggle any on.
const DEFAULT_VISIBLE_COUNT = 7;
const MAX_AGE_DAYS = 300;

function defaultVisibleIds(ranked: { id: string; latestTs: number }[]): Set<string> {
  const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;
  return new Set(ranked.filter((pl) => pl.latestTs >= cutoff).slice(0, DEFAULT_VISIBLE_COUNT).map((pl) => pl.id));
}

async function channelId(): Promise<string> {
  try { const { channels } = await getSiteConfig(); return channels[0]?.channelId || PRIMARY_CHANNEL.channelId; }
  catch { return PRIMARY_CHANNEL.channelId; }
}

// Playlists ordered by their latest video's date (most recent series first). The
// per-playlist "latest video" fetch is cached, so repeat calls are cheap.
async function playlistsByRecency(): Promise<(YtPlaylist & { latestTs: number })[]> {
  const pls = await getPlaylists(await channelId(), 50);
  const withTs = await Promise.all(pls.map(async (pl) => ({ ...pl, latestTs: (await getPlaylistLatestVideo(pl.id))?.ts ?? 0 })));
  return withTs.sort((a, b) => b.latestTs - a.latestTs);
}

export async function getShowsConfig(): Promise<ShowsConfig> {
  const db = getAdminDb();
  if (!db) return { overrides: {}, manual: [] };
  try {
    const d = (await db.collection("site").doc("shows").get()).data() || {};
    return { overrides: (d.overrides as Record<string, ShowOverride>) || {}, manual: Array.isArray(d.manual) ? (d.manual as Series[]) : [] };
  } catch {
    return { overrides: {}, manual: [] };
  }
}

// Map a playlist (+ its override) to the Series shape the site already renders.
// `i` is the recency rank (0 = most recent); defaultVisible marks the top N.
function toSeries(pl: YtPlaylist, o: ShowOverride, i: number, defaultVisible: boolean): Series & { order: number } {
  const blurb = (o.blurb || pl.description || "").trim().slice(0, 240) || `${pl.itemCount} episodes`;
  return {
    key: pl.id,
    title: o.title || pl.title,
    tag: "Series",
    badge: pl.itemCount ? `${pl.itemCount} episodes` : "Series",
    blurb,
    href: `/shows/${pl.id}`,
    by: "",
    category: "",
    art: ART[i % ART.length],
    image: o.image || pl.thumbnail || "",
    visible: o.visible !== undefined ? o.visible : defaultVisible,
    order: o.order ?? i,
  };
}

// Public shows list (manual custom shows first, then visible playlists in order).
export async function getShows(): Promise<Series[]> {
  const [ranked, cfg] = await Promise.all([playlistsByRecency(), getShowsConfig()]);
  if (!ranked.length) {
    // YouTube not connected / no playlists — keep the old manual behavior.
    const { content } = await getSiteConfig();
    return visibleSeries(content.series);
  }
  const defaultIds = defaultVisibleIds(ranked);
  const auto = ranked
    .map((pl, i) => toSeries(pl, cfg.overrides[pl.id] || {}, i, defaultIds.has(pl.id)))
    .filter((s) => s.visible !== false)
    .sort((a, b) => a.order - b.order);
  const manual = (cfg.manual || []).filter((s) => s.visible !== false);
  return [...manual, ...auto];
}

// Auto-post the channel's RECENT uploads to the feed (embedded, playable), tagged
// with the series they belong to so the Locker Room strip filter works. This is
// what keeps the feed showing his latest videos — the same ones in the Library —
// instead of a stale per-playlist latest. Each active show's latest is also
// ensured so the strip never shows an empty series. Removes outdated auto-posts.
const RECENT_UPLOADS = 14;

export async function syncShowPosts(): Promise<{ created: number; removed: number }> {
  const db = getAdminDb();
  if (!db) return { created: 0, removed: 0 };
  const [{ branding, channels }, shows] = await Promise.all([getSiteConfig(), getShows()]);
  const brandName = branding.siteName || "Coach Hayes Football";
  const brandLogo = branding.logo || null;
  const uploads = channels[0]?.uploadsPlaylist || PRIMARY_CHANNEL.uploadsPlaylist;
  const now = Date.now();

  // Map every video in each active series back to its show, so recent uploads can
  // be tagged with the right series.
  const vidToShow: Record<string, string> = {};
  await Promise.all(shows.map(async (s) => {
    if (!/^(PL|UU|FL|OL|RD)/.test(s.key)) return; // playlist shows only
    for (const id of await getPlaylistVideoIds(s.key)) if (!vidToShow[id]) vidToShow[id] = s.key;
  }));

  // Candidates = the newest uploads + each active show's latest (deduped by video).
  type Cand = { id: string; title: string; ts: number; show: string | null };
  const cands = new Map<string, Cand>();
  try {
    const recent = (await getUploadsPage(uploads)).items.slice(0, RECENT_UPLOADS);
    for (const v of recent) cands.set(v.id, { id: v.id, title: v.title, ts: Date.parse(v.publishedAt) || now, show: vidToShow[v.id] || null });
  } catch { /* ignore */ }
  const latests = await Promise.all(shows.map((s) => getPlaylistLatestVideo(s.key).catch(() => null)));
  shows.forEach((s, i) => { const v = latests[i]; if (v && !cands.has(v.id)) cands.set(v.id, { id: v.id, title: v.title, ts: v.ts || now, show: s.key }); });

  const keep = new Set<string>();
  let created = 0;
  for (const c of cands.values()) {
    const docId = `vid-${c.id}`; keep.add(docId);
    const ref = db.collection("posts").doc(docId);
    const existing = (await ref.get()).data() || {};
    await ref.set({
      uid: existing.uid || "system", author: brandName, picture: brandLogo,
      text: c.title || "", ts: existing.ts || c.ts,
      likes: existing.likes || 0, likedBy: existing.likedBy || [], commentCount: existing.commentCount || 0,
      room: "general", savedBy: existing.savedBy || [],
      image: null, clip: `https://www.youtube.com/watch?v=${c.id}`, poll: null, kind: "show", player: null, show: c.show,
    });
    created++;
  }

  // Remove auto-posts that are no longer current (old per-show + dropped videos).
  let removed = 0;
  try {
    const snap = await db.collection("posts").where("kind", "==", "show").get();
    for (const d of snap.docs) { if (!keep.has(d.id)) { await d.ref.delete(); removed++; } }
  } catch { /* ignore */ }

  return { created, removed };
}

// Admin view: every playlist (recency-ordered, with its current override) + the
// manual shows, so the Shows page can curate visibility / order / titles.
export async function getAdminShows(): Promise<{ configured: boolean; playlists: (YtPlaylist & { override: ShowOverride; defaultVisible: boolean })[]; manual: Series[] }> {
  const [ranked, cfg] = await Promise.all([playlistsByRecency(), getShowsConfig()]);
  const defaultIds = defaultVisibleIds(ranked);
  return {
    configured: ranked.length > 0,
    playlists: ranked.map((pl) => ({ ...pl, override: cfg.overrides[pl.id] || {}, defaultVisible: defaultIds.has(pl.id) })),
    manual: cfg.manual || [],
  };
}
