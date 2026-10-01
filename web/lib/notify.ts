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
