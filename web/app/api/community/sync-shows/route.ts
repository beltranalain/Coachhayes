import { NextResponse } from "next/server";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";
import { requireRole } from "@/lib/requireAdmin";
import { broadcastNotification } from "@/lib/notify";

export const dynamic = "force-dynamic";

// Keeps one community post per VISIBLE show (idempotent, doc id "show-<key>"),
// tagged with the show so the Community strip filter is populated automatically.
// A show's YouTube/Hudl link becomes a playable clip in the post. Hidden shows
// have their post removed. Admin (owner/manager) only.
export async function POST(request: Request) {
  if (!adminConfigured) return NextResponse.json({ ok: false, demo: true });
  const role = await requireRole(request);
  if (!role || !["owner", "manager"].includes(role)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const shows = Array.isArray(body.shows) ? body.shows : [];
  const brandName = String(body.brandName || "Coach Hayes Football").slice(0, 80);
  const brandLogo = typeof body.brandLogo === "string" && body.brandLogo ? body.brandLogo : null;

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "No database." }, { status: 500 });

  const now = Date.now();
  let created = 0, removed = 0;
  for (const s of shows) {
    const key = String(s?.key || "").slice(0, 60);
    if (!key) continue;
    const ref = db.collection("posts").doc(`show-${key}`);

    // Hidden show -> remove its feed post.
    if (s.visible === false) {
      const ex = await ref.get();
      if (ex.exists) { await ref.delete(); removed++; }
      continue;
    }

    const title = String(s.title || "").slice(0, 120);
    const blurb = String(s.blurb || "").slice(0, 400);
    const video = typeof s.video === "string" && /^https?:\/\//.test(s.video.trim()) ? s.video.trim().slice(0, 300) : "";
    const image = typeof s.image === "string" && s.image.startsWith("data:image") ? s.image : "";

    // Preserve engagement + original timestamp on updates.
    const existing = (await ref.get()).data() || {};
    const isNew = !existing.ts;
    const doc = {
      uid: existing.uid || "system",
      author: brandName,
      picture: brandLogo,
      text: blurb || (title ? `New show: ${title}` : ""),
      ts: existing.ts || now,
      likes: existing.likes || 0,
      likedBy: existing.likedBy || [],
      commentCount: existing.commentCount || 0,
      room: "general",
      savedBy: existing.savedBy || [],
      // A video embeds as a playable clip; otherwise show the thumbnail.
      image: video ? null : (image || null),
      clip: video || null,
      poll: null,
      kind: "show",
      player: null,
      show: key,
    };
    await ref.set(doc);
    created++;
    // Announce genuinely new shows to everyone (not on every re-save).
    if (isNew) await broadcastNotification(brandName, "show", `show-${key}`, title ? `New show: ${title}` : "New show");
  }
  return NextResponse.json({ ok: true, created, removed });
}
