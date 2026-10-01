import { NextResponse } from "next/server";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";
import { verifyUser } from "@/lib/requireUser";

export const dynamic = "force-dynamic";

// GET — my notifications (newest first). POST {action:"read"} — mark all read.
export async function GET(request: Request) {
  const u = await verifyUser(request);
  if (!u || !adminConfigured) return NextResponse.json({ notifications: [], unread: 0 });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ notifications: [], unread: 0 });
  try {
    const snap = await db.collection("notifications").where("uid", "==", u.uid).limit(80).get();
    const notifications = snap.docs
      .map((d) => { const x = d.data(); return { id: d.id, type: x.type, fromName: x.fromName, excerpt: x.excerpt || "", postId: x.postId, ts: x.ts || 0, read: !!x.read }; })
      .sort((a, b) => b.ts - a.ts);
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
    const snap = await db.collection("notifications").where("uid", "==", u.uid).where("read", "==", false).limit(200).get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
    await batch.commit();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
