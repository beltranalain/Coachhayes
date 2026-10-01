import { NextResponse } from "next/server";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";
import { verifyUser } from "@/lib/requireUser";

export const dynamic = "force-dynamic";

// GET ?uid= — a member's replies (comments) across posts, newest first, with the
// parent post's text for context. Uses a collectionGroup query over comments.
export async function GET(request: Request) {
  if (!adminConfigured) return NextResponse.json({ replies: [] });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ replies: [] });
  const url = new URL(request.url);
  const viewer = await verifyUser(request);
  const uid = url.searchParams.get("uid") || viewer?.uid || "";
  if (!uid) return NextResponse.json({ replies: [] });

  try {
    const snap = await db.collectionGroup("comments").where("uid", "==", uid).limit(60).get();
    const rows = snap.docs.map((d) => {
      const x = d.data();
      const postId = d.ref.parent.parent?.id || "";
      return { id: d.id, postId, author: x.author || "Member", text: x.text || "", ts: x.ts || 0 };
    }).sort((a, b) => b.ts - a.ts);

    // Attach a short parent-post excerpt (best effort, capped).
    const ids = Array.from(new Set(rows.map((r) => r.postId).filter(Boolean))).slice(0, 30);
    const parents: Record<string, string> = {};
    await Promise.all(ids.map(async (id) => {
      try { const p = await db.collection("posts").doc(id).get(); if (p.exists) parents[id] = String(p.data()?.text || "").slice(0, 140); } catch {}
    }));
    return NextResponse.json({ replies: rows.map((r) => ({ ...r, parentExcerpt: parents[r.postId] || "" })) });
  } catch {
    // collectionGroup on "comments" needs a single-field index enabled; return
    // empty (not an error) until it's created rather than break the profile.
    return NextResponse.json({ replies: [], indexNeeded: true });
  }
}
