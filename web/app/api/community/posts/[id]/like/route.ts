import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { verifyUser } from "@/lib/requireUser";
import { pushNotification } from "@/lib/notify";

// POST — toggle the caller's like on a post.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await verifyUser(request);
  if (!u) return NextResponse.json({ error: "Sign in to like." }, { status: 401 });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "No database." }, { status: 500 });
  try {
    const ref = db.collection("posts").doc(id);
    const res = await db.runTransaction(async (t) => {
      const s = await t.get(ref);
      if (!s.exists) throw new Error("gone");
      const d = s.data() || {};
      const likedBy: string[] = d.likedBy || [];
      const has = likedBy.includes(u.uid);
      const next = has ? likedBy.filter((x) => x !== u.uid) : [...likedBy, u.uid];
      t.update(ref, { likedBy: next, likes: next.length });
      return { likes: next.length, liked: !has, authorUid: d.uid, text: d.text };
    });
    if (res.liked) await pushNotification(res.authorUid, u.uid, u.name, "like", id, res.text);
    return NextResponse.json({ ok: true, likes: res.likes, liked: res.liked });
  } catch {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }
}
