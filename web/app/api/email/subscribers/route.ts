import { NextResponse } from "next/server";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";
import { requireRole } from "@/lib/requireAdmin";
import { emailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

// GET — subscriber count + recent list (admin owner/manager).
export async function GET(request: Request) {
  const role = await requireRole(request);
  if (!role || !["owner", "manager"].includes(role)) return NextResponse.json({ count: 0, subscribers: [], configured: false });
  if (!adminConfigured) return NextResponse.json({ count: 0, subscribers: [], configured: false });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ count: 0, subscribers: [], configured: false });
  try {
    const snap = await db.collection("emailSubscribers").get();
    const all = snap.docs.map((d) => { const x = d.data(); return { email: x.email || d.id, source: x.source || "", ts: x.ts || 0 }; });
    all.sort((a, b) => b.ts - a.ts);
    return NextResponse.json({ count: all.length, subscribers: all.slice(0, 50), configured: emailConfigured });
  } catch {
    return NextResponse.json({ count: 0, subscribers: [], configured: emailConfigured });
  }
}
