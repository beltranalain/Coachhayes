import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { verifyUser } from "@/lib/requireUser";

export const dynamic = "force-dynamic";

// POST { uid } — toggle the caller following the target user.
export async function POST(request: Request) {
  const u = await verifyUser(request);
  if (!u) return NextResponse.json({ error: "Sign in to follow." }, { status: 401 });
  let b: any; try { b = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const target = String(b.uid ?? "").trim();
  if (!target || target === u.uid) return NextResponse.json({ error: "Can’t follow that." }, { status: 400 });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "No database." }, { status: 500 });
  const ref = db.collection("follows").doc(`${u.uid}__${target}`);
  const snap = await ref.get();
  if (snap.exists) { await ref.delete(); return NextResponse.json({ ok: true, following: false }); }
  await ref.set({ follower: u.uid, target, ts: Date.now() });
  return NextResponse.json({ ok: true, following: true });
}
