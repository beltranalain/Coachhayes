import { NextResponse } from "next/server";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";
import { requireRole } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

type Product = {
  id: string; title: string; priceCents: number; image: string; blurb: string;
  sizes: string[]; visible: boolean; order: number;
};

function shape(id: string, x: any): Product {
  return {
    id,
    title: String(x.title || ""),
    priceCents: Number(x.priceCents) || 0,
    image: typeof x.image === "string" ? x.image : "",
    blurb: String(x.blurb || ""),
    sizes: Array.isArray(x.sizes) ? x.sizes.map((s: any) => String(s)).slice(0, 12) : [],
    visible: x.visible !== false,
    order: Number(x.order) || 0,
  };
}

// GET — products. Public returns visible only; admins pass ?all=1 for the manager.
export async function GET(request: Request) {
  if (!adminConfigured) return NextResponse.json({ products: [] });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ products: [] });
  const wantAll = new URL(request.url).searchParams.get("all") === "1";
  try {
    const snap = await db.collection("shopProducts").get();
    let products = snap.docs.map((d) => shape(d.id, d.data()));
    if (!wantAll || !(await requireRole(request))) products = products.filter((p) => p.visible);
    products.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
    return NextResponse.json({ products });
  } catch {
    return NextResponse.json({ products: [] });
  }
}

// POST — create/update a product (admin owner/manager). Images are small data URLs.
export async function POST(request: Request) {
  if (!adminConfigured) return NextResponse.json({ saved: false, demo: true });
  const role = await requireRole(request);
  if (!role || !["owner", "manager"].includes(role)) return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "No database." }, { status: 500 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const p = body.product || {};
  const image = typeof p.image === "string" ? p.image : "";
  const clean = {
    title: String(p.title || "").slice(0, 120),
    priceCents: Math.max(0, Math.min(5_000_00, Math.round(Number(p.priceCents) || 0))),
    image: image.startsWith("data:image") && image.length < 400_000 ? image : (image.startsWith("http") ? image.slice(0, 500) : ""),
    blurb: String(p.blurb || "").slice(0, 600),
    sizes: Array.isArray(p.sizes) ? p.sizes.map((s: any) => String(s).slice(0, 12)).filter(Boolean).slice(0, 12) : [],
    visible: p.visible !== false,
    order: Number(p.order) || 0,
  };
  if (!clean.title) return NextResponse.json({ error: "A title is required." }, { status: 400 });
  try {
    const id = String(p.id || "").trim();
    const ref = id ? db.collection("shopProducts").doc(id) : db.collection("shopProducts").doc();
    await ref.set(clean, { merge: true });
    return NextResponse.json({ saved: true, id: ref.id });
  } catch {
    return NextResponse.json({ error: "Save failed." }, { status: 500 });
  }
}

// DELETE ?id= — remove a product (admin).
export async function DELETE(request: Request) {
  const role = await requireRole(request);
  if (!role || !["owner", "manager"].includes(role)) return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "No database." }, { status: 500 });
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  try { await db.collection("shopProducts").doc(id).delete(); return NextResponse.json({ ok: true }); }
  catch { return NextResponse.json({ error: "Delete failed." }, { status: 500 }); }
}
