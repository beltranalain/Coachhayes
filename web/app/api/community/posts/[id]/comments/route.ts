import { NextResponse } from "next/server";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";
import { verifyUser } from "@/lib/requireUser";
import { pushNotification } from "@/lib/notify";
import { authorMap } from "@/lib/communityAuthors";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

// GET — comments on a post (public). POST — add a comment (any signed-in member).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!adminConfigured) return NextResponse.json({ comments: [] });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ comments: [] });
  try {
    const snap = await db.collection("posts").doc(id).collection("comments").orderBy("ts", "asc").limit(200).get();
    let comments = snap.docs.map((d) => { const x = d.data(); return { id: d.id, uid: x.uid as string | undefined, author: x.author || "Member", picture: (x.picture as string | null) || null, text: x.text || "", ts: x.ts || 0 }; });
    const am = await authorMap(db, comments.map((c) => c.uid));
    comments = comments.map((c) => { const a = c.uid ? am[c.uid] : undefined; return a ? { ...c, author: a.name || c.author, picture: a.avatar ?? c.picture } : c; });
    return NextResponse.json({ comments });
  } catch {
    return NextResponse.json({ comments: [] });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await verifyUser(request);
  if (!u) return NextResponse.json({ error: "Sign in to comment." }, { status: 401 });
  let b: any; try { b = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const text = String(b.text ?? "").trim().slice(0, 600);
  if (!text) return NextResponse.json({ error: "Write a comment first." }, { status: 400 });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "No database." }, { status: 500 });
  try {
    const post = db.collection("posts").doc(id);
    const now = Date.now();
    // Prefer the member's profile name/avatar if they've customised it.
    let author = u.name; let picture: string | null = u.picture;
    try { const pf = (await db.collection("profiles").doc(u.uid).get()).data(); if (pf?.name) author = pf.name; if (pf?.avatar) picture = pf.avatar; } catch {}
    const c = { uid: u.uid, author, picture, text, ts: now };
    const ref = await post.collection("comments").add(c);
    await post.set({ commentCount: FieldValue.increment(1) }, { merge: true });
    try { const pd = (await post.get()).data(); await pushNotification(pd?.uid, u.uid, u.name, "comment", id, text); } catch {}
    return NextResponse.json({ ok: true, comment: { id: ref.id, ...c } });
  } catch {
    return NextResponse.json({ error: "Could not add comment." }, { status: 500 });
  }
}
