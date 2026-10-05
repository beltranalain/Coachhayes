import { NextResponse } from "next/server";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";
import { requireRole } from "@/lib/requireAdmin";
import { slugify } from "@/lib/blog";

export const dynamic = "force-dynamic";

async function gate(request: Request) {
  if (!adminConfigured) return { error: NextResponse.json({ error: "Not configured." }, { status: 400 }) };
  const role = await requireRole(request);
  if (!role || !["owner", "manager"].includes(role)) return { error: NextResponse.json({ error: "Not authorized." }, { status: 401 }) };
  const db = getAdminDb();
  if (!db) return { error: NextResponse.json({ error: "No database." }, { status: 500 }) };
  return { db };
}

// GET — all tags, alphabetical (for suggestions).
export async function GET(request: Request) {
  const g = await gate(request); if (g.error) return g.error;
  const snap = await g.db!.collection("blogTags").get();
  const tags = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return NextResponse.json({ tags });
}

// POST — create a tag (idempotent by slug).
export async function POST(request: Request) {
  const g = await gate(request); if (g.error) return g.error;
  let b: any; try { b = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const name = String(b?.name || "").trim().slice(0, 60);
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  const slug = slugify(name);
  const existing = await g.db!.collection("blogTags").where("slug", "==", slug).limit(1).get();
  if (!existing.empty) {
    const d = existing.docs[0];
    return NextResponse.json({ tag: { id: d.id, ...d.data() } });
  }
  const ref = await g.db!.collection("blogTags").add({ name, slug, createdAt: Date.now() });
  return NextResponse.json({ tag: { id: ref.id, name, slug } });
}
