import "server-only";

import { getAdminDb } from "./firebaseAdmin";
import { getPlaylists, getUploadsPage, type YtPlaylist } from "./youtube";
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
// A playlist is shown by default when it's a substantial series; smaller lists
// (team-commit lists, one-offs) stay hidden until the admin turns them on. Keeps
// the default Shows page clean; the admin curates the rest with one toggle.
const DEFAULT_VISIBLE_MIN = 20;

async function channelId(): Promise<string> {
  try { const { channels } = await getSiteConfig(); return channels[0]?.channelId || PRIMARY_CHANNEL.channelId; }
  catch { return PRIMARY_CHANNEL.channelId; }
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
function toSeries(pl: YtPlaylist, o: ShowOverride, i: number): Series & { order: number } {
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
    visible: o.visible !== undefined ? o.visible : pl.itemCount >= DEFAULT_VISIBLE_MIN,
    order: o.order ?? i,
  };
}

// Public shows list (manual custom shows first, then visible playlists in order).
export async function getShows(): Promise<Series[]> {
  const [playlists, cfg] = await Promise.all([getPlaylists(await channelId(), 50), getShowsConfig()]);
  if (!playlists.length) {
    // YouTube not connected / no playlists — keep the old manual behavior.
    const { content } = await getSiteConfig();
    return visibleSeries(content.series);
  }
  const auto = playlists
    .map((pl, i) => toSeries(pl, cfg.overrides[pl.id] || {}, i))
    .filter((s) => s.visible !== false)
    .sort((a, b) => a.order - b.order);
  const manual = (cfg.manual || []).filter((s) => s.visible !== false);
  return [...manual, ...auto];
}

// Keep one community "show" post per VISIBLE show, tagged with the show so the
// Locker Room strip filter is populated and the show's latest video embeds as a
// playable clip in the feed. Posts for shows that are no longer visible are
// removed. Runs after the admin saves Shows (and can be re-run to refresh).
export async function syncShowPosts(): Promise<{ created: number; removed: number }> {
  const db = getAdminDb();
  if (!db) return { created: 0, removed: 0 };
  const [{ branding }, shows] = await Promise.all([getSiteConfig(), getShows()]);
  const brandName = branding.siteName || "Coach Hayes Football";
  const brandLogo = branding.logo || null;
  const now = Date.now();

  // Resolve each show's latest video (playlists) in parallel.
  const resolved = await Promise.all(shows.map(async (s) => {
    if (s.video && /^https?:\/\//.test(s.video)) return { s, clip: s.video, text: s.blurb || s.title, ts: now };
    try {
      const page = await getUploadsPage(s.key);
      const v = page.items[0];
      if (v) return { s, clip: `https://www.youtube.com/watch?v=${v.id}`, text: v.title, ts: Date.parse(v.publishedAt) || now };
    } catch { /* ignore */ }
    return { s, clip: "", text: s.blurb || s.title, ts: now };
  }));

  const keep = new Set<string>();
  let created = 0;
  for (const { s, clip, text, ts } of resolved) {
    keep.add(s.key);
    const ref = db.collection("posts").doc(`show-${s.key}`);
    const existing = (await ref.get()).data() || {};
    await ref.set({
      uid: existing.uid || "system", author: brandName, picture: brandLogo,
      text: text || "", ts: existing.ts || ts,
      likes: existing.likes || 0, likedBy: existing.likedBy || [], commentCount: existing.commentCount || 0,
      room: "general", savedBy: existing.savedBy || [],
      image: clip ? null : (s.image || null), clip: clip || null, poll: null, kind: "show", player: null, show: s.key,
    });
    created++;
  }

  // Remove show posts whose show is no longer visible.
  let removed = 0;
  try {
    const snap = await db.collection("posts").where("kind", "==", "show").get();
    for (const d of snap.docs) {
      const key = (d.data().show as string) || d.id.replace(/^show-/, "");
      if (!keep.has(key)) { await d.ref.delete(); removed++; }
    }
  } catch { /* ignore */ }

  return { created, removed };
}

// Admin view: every playlist (with its current override) + the manual shows, so
// the Shows page can curate visibility / order / titles.
export async function getAdminShows(): Promise<{ configured: boolean; playlists: (YtPlaylist & { override: ShowOverride; defaultVisible: boolean })[]; manual: Series[] }> {
  const [playlists, cfg] = await Promise.all([getPlaylists(await channelId(), 50), getShowsConfig()]);
  return {
    configured: playlists.length > 0,
    playlists: playlists.map((pl) => ({ ...pl, override: cfg.overrides[pl.id] || {}, defaultVisible: pl.itemCount >= DEFAULT_VISIBLE_MIN })),
    manual: cfg.manual || [],
  };
}
