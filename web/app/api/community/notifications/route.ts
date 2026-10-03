import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";
import { verifyUser } from "@/lib/requireUser";

export const dynamic = "force-dynamic";

// GET — my notifications: personal (likes/replies on my posts) + admin broadcasts
// to everyone (new posts/shows), newest first. POST — mark all read.
export async function GET(request: Request) {
  const u = await verifyUser(request);
  if (!u || !adminConfigured) return NextResponse.json({ notifications: [], unread: 0 });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ notifications: [], unread: 0 });
  try {
    const [mine, bcast] = await Promise.all([
      db.collection("notifications").where("uid", "==", u.uid).limit(80).get(),
      db.collection("notifications").where("broadcast", "==", true).limit(50).get(),
    ]);
    const personal = mine.docs.map((d) => { const x = d.data(); return { id: d.id, type: x.type, fromName: x.fromName, excerpt: x.excerpt || "", postId: x.postId, ts: x.ts || 0, read: !!x.read }; });
    const broadcasts = bcast.docs.map((d) => { const x = d.data(); return { id: d.id, type: x.type || "announcement", fromName: x.fromName, excerpt: x.excerpt || "", postId: x.postId, ts: x.ts || 0, read: Array.isArray(x.readBy) && x.readBy.includes(u.uid) }; });
    const notifications = [...personal, ...broadcasts].sort((a, b) => b.ts - a.ts).slice(0, 80);
    return NextResponse.json({ notifications, unread: notifications.filter((n) => !n.read).length });
  } catch {
    return NextResponse.json({ notifications: [], unread: 0 });
  }
}

export async function POST(request: Request) {
  const u = await verifyUser(request);
  if (!u) return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "No database." }, { status: 500 });
  try {
    const [mine, bcast] = await Promise.all([
      db.collection("notifications").where("uid", "==", u.uid).where("read", "==", false).limit(200).get(),
      db.collection("notifications").where("broadcast", "==", true).limit(50).get(),
    ]);
    const batch = db.batch();
    mine.docs.forEach((d) => batch.update(d.ref, { read: true }));
    bcast.docs.forEach((d) => { const rb: string[] = d.data().readBy || []; if (!rb.includes(u.uid)) batch.update(d.ref, { readBy: FieldValue.arrayUnion(u.uid) }); });
    await batch.commit();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
