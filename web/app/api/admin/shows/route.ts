import { NextResponse } from "next/server";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";
import { requireRole } from "@/lib/requireAdmin";
import { getAdminShows, type ShowOverride } from "@/lib/shows";
import type { Series } from "@/lib/siteData";

export const dynamic = "force-dynamic";

// GET — playlists (with overrides) + manual shows, for the admin Shows page.
export async function GET() {
  return NextResponse.json(await getAdminShows());
}

// POST { overrides, manual } — save the Shows curation (owner/manager).
export async function POST(request: Request) {
  if (!adminConfigured) return NextResponse.json({ saved: false, demo: true });
  const role = await requireRole(request);
  if (!role || !["owner", "manager"].includes(role)) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  let body: any; try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  // Sanitize overrides: only known keys; keep inline images small.
  const overrides: Record<string, ShowOverride> = {};
  const src = body?.overrides && typeof body.overrides === "object" ? body.overrides : {};
  for (const id of Object.keys(src).slice(0, 100)) {
    const o = src[id] || {};
    const clean: ShowOverride = {};
    if (typeof o.visible === "boolean") clean.visible = o.visible;
    if (Number.isFinite(o.order)) clean.order = Number(o.order);
    if (typeof o.title === "string" && o.title.trim()) clean.title = o.title.slice(0, 120);
    if (typeof o.blurb === "string") clean.blurb = o.blurb.slice(0, 280);
    if (typeof o.image === "string" && o.image.startsWith("data:image") && o.image.length < 200_000) clean.image = o.image;
    if (Object.keys(clean).length) overrides[id] = clean;
  }

  // Sanitize manual custom shows (same Series shape the site renders).
  const manual: Series[] = (Array.isArray(body?.manual) ? body.manual : []).slice(0, 24).map((s: any) => ({
    key: String(s.key || "").slice(0, 60) || `manual-${Math.random().toString(36).slice(2, 8)}`,
    title: String(s.title || "").slice(0, 120),
    tag: String(s.tag || "Series").slice(0, 40),
    badge: String(s.badge || "").slice(0, 40),
    blurb: String(s.blurb || "").slice(0, 280),
    href: String(s.href || "/live").slice(0, 300),
    by: String(s.by || "").slice(0, 120),
    category: String(s.category || "").slice(0, 40),
    art: String(s.art || "a1").slice(0, 4),
    image: typeof s.image === "string" && s.image.startsWith("data:image") && s.image.length < 200_000 ? s.image : "",
    visible: s.visible !== false,
    video: typeof s.video === "string" ? s.video.slice(0, 300) : "",
  })).filter((s: Series) => s.title);

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "No database." }, { status: 500 });
  try {
    await db.collection("site").doc("shows").set({ overrides, manual }, { merge: false });
    return NextResponse.json({ saved: true });
  } catch {
    return NextResponse.json({ error: "Save failed." }, { status: 500 });
  }
}
