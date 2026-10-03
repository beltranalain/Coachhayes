import "server-only";
import { getAdminDb } from "./firebaseAdmin";

// Write a notification for the recipient (skips self-actions). Best-effort.
export async function pushNotification(toUid: string, fromUid: string, fromName: string, type: "like" | "comment", postId: string, excerpt: string) {
  if (!toUid || toUid === fromUid) return;
  const db = getAdminDb();
  if (!db) return;
  try {
    await db.collection("notifications").add({ uid: toUid, fromName: fromName || "Someone", type, postId, excerpt: String(excerpt || "").slice(0, 80), ts: Date.now(), read: false });
  } catch { /* non-fatal */ }
}

// Announce to EVERYONE (admin post / new show). Stored once with broadcast:true
// and per-member read tracking (readBy) instead of fanning out a doc per user.
export async function broadcastNotification(fromName: string, type: string, postId: string, excerpt: string) {
  const db = getAdminDb();
  if (!db) return;
  try {
    await db.collection("notifications").add({ broadcast: true, fromName: fromName || "Coach Hayes Football", type: type || "announcement", postId, excerpt: String(excerpt || "").slice(0, 120), ts: Date.now(), readBy: [] });
  } catch { /* non-fatal */ }
}
