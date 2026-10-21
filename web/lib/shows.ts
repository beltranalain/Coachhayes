import "server-only";

import { getAdminDb } from "./firebaseAdmin";
import { getPlaylists, type YtPlaylist } from "./youtube";
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
