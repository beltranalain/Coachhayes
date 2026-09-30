import { NextResponse } from "next/server";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";
import { requireRole } from "@/lib/requireAdmin";

async function gate(request: Request) {
  if (!adminConfigured) return { error: NextResponse.json({ error: "Not configured." }, { status: 400 }) };
  const role = await requireRole(request);
  if (!role || !["owner", "manager"].includes(role)) return { error: NextResponse.json({ error: "Not authorized." }, { status: 401 }) };
  const db = getAdminDb();
  if (!db) return { error: NextResponse.json({ error: "No database." }, { status: 500 }) };
  return { db };
}

// GET — the submissions queue (newest first).
export async function GET(request: Request) {
  const g = await gate(request); if (g.error) return g.error;
  const snap = await g.db!.collection("submissions").orderBy("createdAt", "desc").limit(200).get();
  return NextResponse.json({ submissions: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
}

// PATCH { id, status } — update a submission's status (e.g. reject).
export async function PATCH(request: Request) {
  const g = await gate(request); if (g.error) return g.error;
  let b: any; try { b = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!b.id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  const status = ["new", "reviewing", "published", "rejected"].includes(b.status) ? b.status : undefined;
  if (!status) return NextResponse.json({ error: "Bad status." }, { status: 400 });
  await g.db!.collection("submissions").doc(String(b.id)).set({ status }, { merge: true });
  return NextResponse.json({ ok: true });
}
