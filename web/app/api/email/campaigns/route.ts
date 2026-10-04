import { NextResponse } from "next/server";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";
import { requireRole } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

// GET — history of sent email campaigns (admin owner/manager), newest first.
export async function GET(request: Request) {
  const role = await requireRole(request);
  if (!role || !["owner", "manager"].includes(role)) return NextResponse.json({ campaigns: [] });
  if (!adminConfigured) return NextResponse.json({ campaigns: [] });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ campaigns: [] });
  try {
    const snap = await db.collection("emailCampaigns").orderBy("ts", "desc").limit(100).get();
    const campaigns = snap.docs.map((d) => { const x = d.data(); return { id: d.id, subject: x.subject || "", body: x.body || "", recipients: x.recipients || 0, ts: x.ts || 0 }; });
    return NextResponse.json({ campaigns });
  } catch {
    return NextResponse.json({ campaigns: [] });
  }
}
