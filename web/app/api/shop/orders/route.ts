import { NextResponse } from "next/server";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";
import { requireRole } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

// GET — recent shop orders (admin owner/manager). Newest first.
export async function GET(request: Request) {
  const role = await requireRole(request);
  if (!role || !["owner", "manager"].includes(role)) return NextResponse.json({ orders: [] });
  if (!adminConfigured) return NextResponse.json({ orders: [] });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ orders: [] });
  try {
    const snap = await db.collection("shopOrders").orderBy("ts", "desc").limit(100).get();
    const orders = snap.docs.map((d) => { const x = d.data(); return { id: d.id, title: x.title || "", size: x.size || "", qty: x.qty || 1, amountCents: x.amountCents || 0, email: x.email || "", name: x.name || "", address: x.address || "", status: x.status || "paid", ts: x.ts || 0 }; });
    return NextResponse.json({ orders });
  } catch {
    return NextResponse.json({ orders: [] });
  }
}
