import "server-only";
import { getAdminDb } from "./firebaseAdmin";
import { getLiveVideoId, checkVideoLive, getLiveInfo } from "./youtube";

// Quota-smart "is the channel live on YouTube?" resolver.
//
// The naive approach re-runs the 100-unit `search` on every poll, which a 3-4h
// show would blow past the 10k/day quota. Instead we keep the current live video
// id in Firestore (shared across all serverless instances) and:
//   • While we KNOW a video id -> confirm it with the 1-unit videos.list. A whole
//     4h show costs ~a few hundred units instead of ~16,000.
//   • While OFF air -> only run the 100-unit search on a throttle, so idle
//     traffic can't drain the quota either.
// Falls back to the simple cached path if Firestore isn't configured.

export type YtLive = { live: boolean; videoId: string | null; viewers: number | null };

type StoredState = {
  videoId?: string | null;
  viewers?: number | null;
  lastSearchAt?: number; // last time the expensive search ran
  updatedAt?: number;
};

// How often the 100-unit search may run while OFF air. Finding the START of a
// show within ~90s is plenty; detecting the END is free (cheap videos.list).
const SEARCH_THROTTLE_MS = 90_000;

export async function resolveYouTubeLive(channelId: string, now: number): Promise<YtLive> {
  if (!channelId) return { live: false, videoId: null, viewers: null };

  const db = getAdminDb();
  if (!db) {
    // No Firestore — use the simple cached path (search is still revalidate-cached).
    const info = await getLiveInfo(channelId);
    return { live: info.live, videoId: info.videoId, viewers: info.viewers };
  }

  const ref = db.collection("site").doc("liveState");
  const prev = (await ref.get().then((s) => (s.exists ? s.data() : {})).catch(() => ({}))) as StoredState;

  // 1) We think a show is on — confirm it cheaply (1 unit), no search.
  if (prev.videoId) {
    const { live, viewers } = await checkVideoLive(prev.videoId);
    if (live) {
      await ref.set({ videoId: prev.videoId, viewers, updatedAt: now }, { merge: true }).catch(() => {});
      return { live: true, videoId: prev.videoId, viewers };
    }
    // Show ended — clear the remembered video so we go off air.
    await ref.set({ videoId: null, viewers: null, updatedAt: now }, { merge: true }).catch(() => {});
  }

  // 2) Off air — only spend the 100-unit search on a throttle.
  if (prev.lastSearchAt && now - prev.lastSearchAt < SEARCH_THROTTLE_MS) {
    return { live: false, videoId: null, viewers: null };
  }

  const videoId = await getLiveVideoId(channelId);
  await ref.set({ lastSearchAt: now, updatedAt: now, videoId: videoId || null }, { merge: true }).catch(() => {});
  if (!videoId) return { live: false, videoId: null, viewers: null };

  const { viewers } = await checkVideoLive(videoId);
  await ref.set({ videoId, viewers, updatedAt: now }, { merge: true }).catch(() => {});
  return { live: true, videoId, viewers };
}
