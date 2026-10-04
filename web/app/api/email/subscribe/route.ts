import { NextResponse } from "next/server";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

// POST { email, source? } — add someone to the owned subscriber list (public).
// Keyed by the normalized email so re-subscribing is idempotent.
export async function POST(request: Request) {
  if (!adminConfigured) return NextResponse.json({ ok: false, demo: true });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ ok: false });
  let b: any;
  try { b = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const email = String(b.email || "").trim().toLowerCase();
  if (!email.includes("@") || email.length > 160) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  try {
    await db.collection("emailSubscribers").doc(email).set({ email, source: String(b.source || "site").slice(0, 40), ts: Date.now() }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not subscribe." }, { status: 500 });
  }
}
