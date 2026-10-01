import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { verifyUser } from "@/lib/requireUser";

// POST — toggle the caller saving/bookmarking a post.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await verifyUser(request);
  if (!u) return NextResponse.json({ error: "Sign in to save." }, { status: 401 });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "No database." }, { status: 500 });
  try {
    const ref = db.collection("posts").doc(id);
    const res = await db.runTransaction(async (t) => {
      const s = await t.get(ref);
      if (!s.exists) throw new Error("gone");
      const savedBy: string[] = s.data()?.savedBy || [];
      const has = savedBy.includes(u.uid);
      const next = has ? savedBy.filter((x) => x !== u.uid) : [...savedBy, u.uid];
      t.update(ref, { savedBy: next });
      return { saved: !has };
    });
    return NextResponse.json({ ok: true, ...res });
  } catch {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }
}
