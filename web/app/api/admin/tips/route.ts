import { NextResponse } from "next/server";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";
import { requireRole } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

// GET -> recent tips + totals (from the Firestore `tips` collection).
// Tips are owner|manager only (matches the Tips page access).
export async function GET(request: Request) {
  if (!adminConfigured) return NextResponse.json({ configured: false, tips: [], total: 0, count: 0 });
  const role = await requireRole(request);
  if (role !== "owner" && role !== "manager") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const db = getAdminDb();
  if (!db) return NextResponse.json({ configured: false, tips: [], total: 0, count: 0 });

  try {
    const snap = await db.collection("tips").orderBy("ts", "desc").limit(200).get();
    const tips = snap.docs.map((d) => {
      const x = d.data();
      return { name: String(x.name || "A viewer"), amount: Number(x.amount) || 0, message: String(x.message || ""), ts: Number(x.ts) || 0 };
    });
    const total = tips.reduce((s, t) => s + t.amount, 0);
    return NextResponse.json({ configured: true, tips, total, count: tips.length });
  } catch {
    // No tips yet (collection may not exist) - just report empty.
    return NextResponse.json({ configured: true, tips: [], total: 0, count: 0 });
  }
}

// DELETE -> wipe the local tip history (e.g. clearing test data before launch).
// Owner-only. This only removes the display records in Firestore; it does NOT
// touch Stripe payments or payouts (that money already moved).
export async function DELETE(request: Request) {
  if (!adminConfigured) return NextResponse.json({ error: "Not configured." }, { status: 400 });
  const role = await requireRole(request);
  if (role !== "owner") {
    return NextResponse.json({ error: "Only the owner can clear tips." }, { status: 403 });
  }
  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "Not configured." }, { status: 400 });

  try {
    let deleted = 0;
    // Delete in batches until the collection is empty.
    for (;;) {
      const snap = await db.collection("tips").limit(400).get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      deleted += snap.size;
      if (snap.size < 400) break;
    }
    return NextResponse.json({ ok: true, deleted });
  } catch {
    return NextResponse.json({ error: "Could not clear tips." }, { status: 500 });
  }
}
