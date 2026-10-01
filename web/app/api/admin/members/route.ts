import { NextResponse } from "next/server";
import { getAdminDb, getAdminAuth, adminConfigured } from "@/lib/firebaseAdmin";
import { requireRole } from "@/lib/requireAdmin";
import type { MembershipTier } from "@/lib/schema";

export const dynamic = "force-dynamic";

const TIERS: MembershipTier[] = ["timmy", "coordinator"];

async function gate(request: Request) {
  if (!adminConfigured) return { error: NextResponse.json({ error: "Not configured." }, { status: 400 }) };
  const role = await requireRole(request);
  if (!role || !["owner", "manager"].includes(role)) return { error: NextResponse.json({ error: "Not authorized." }, { status: 401 }) };
  const db = getAdminDb();
  if (!db) return { error: NextResponse.json({ error: "No database." }, { status: 500 }) };
  return { db };
}

// GET — every granted/active membership (for the admin Members table).
export async function GET(request: Request) {
  const g = await gate(request); if (g.error) return g.error;
  try {
    const snap = await g.db!.collection("memberships").limit(500).get();
    const members = snap.docs.map((d) => { const x = d.data(); return { uid: d.id, email: x.email || "", name: x.name || "", tier: x.tier || null, status: x.status || null, source: x.source || "stripe", createdAt: x.createdAt || 0 }; }).sort((a, b) => b.createdAt - a.createdAt);
    return NextResponse.json({ members });
  } catch {
    return NextResponse.json({ members: [] });
  }
}

// POST — grant or revoke a member's tier by email (manual comp while Stripe is
// off). { email, tier } grants; { email, tier:"none" } revokes.
export async function POST(request: Request) {
  const g = await gate(request); if (g.error) return g.error;
  let b: any; try { b = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const email = String(b.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Enter the member's email." }, { status: 400 });
  const revoke = b.tier === "none" || b.tier === null;
  const tier = revoke ? null : (TIERS.includes(b.tier) ? (b.tier as MembershipTier) : null);
  if (!revoke && !tier) return NextResponse.json({ error: "Pick a valid tier." }, { status: 400 });

  const auth = getAdminAuth();
  if (!auth) return NextResponse.json({ error: "Auth unavailable." }, { status: 500 });
  let uid = ""; let name = "";
  try { const rec = await auth.getUserByEmail(email); uid = rec.uid; name = rec.displayName || ""; }
  catch { return NextResponse.json({ error: "No account found for that email. They need to sign up first." }, { status: 404 }); }

  const ref = g.db!.collection("memberships").doc(uid);
  const now = Date.now();
  if (revoke) {
    await ref.set({ status: "canceled", tier: null, canceledAt: now }, { merge: true });
    return NextResponse.json({ ok: true, revoked: true, email });
  }
  await ref.set({ userId: uid, email, name, tier, status: "active", source: "comp", currentPeriodEnd: 0, createdAt: now }, { merge: true });
  return NextResponse.json({ ok: true, uid, email, tier });
}
