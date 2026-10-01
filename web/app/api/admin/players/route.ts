import { NextResponse } from "next/server";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";
import { requireRole } from "@/lib/requireAdmin";
import { defaultOrder, slugify, sanitizeCategories, sanitizeCategoryNotes, recommendedOverall, CHIP_META, CATEGORIES, type Chip } from "@/lib/rankings";
import { getSiteConfig } from "@/lib/siteConfig";

const CHIPS: Chip[] = ["bronze", "silver", "gold", "blue"];

// Build an announcement post body for a newly-ranked player (no emojis).
function playerPostText(f: Record<string, any>): string {
  const lines: string[] = [];
  const meta = [f.position, f.school, f.classYear ? `Class of ${f.classYear}` : ""].filter(Boolean).join(" · ");
  lines.push(`New in the rankings: ${f.name}`);
  if (meta) lines.push(meta);
  lines.push(`Overall grade: ${CHIP_META[f.chip as Chip]?.label || f.chip}`);
  const cats = CATEGORIES
    .filter((c) => f.categories && f.categories[c.key])
    .map((c) => `${c.label}: ${CHIP_META[f.categories[c.key] as Chip]?.label || f.categories[c.key]}`);
  if (cats.length) lines.push(cats.join(" · "));
  if (f.commit) lines.push(`Committed: ${f.commit}`);
  lines.push(`Full breakdown: /rankings/${f.slug}`);
  return lines.join("\n");
}

// Create a community feed post announcing a new player. Best-effort: any failure
// here must not block the player from being saved.
async function announcePlayer(db: FirebaseFirestore.Firestore, playerId: string, f: Record<string, any>) {
  try {
    let author = "Coach Hayes Football"; let picture: string | null = null;
    try { const { branding } = await getSiteConfig(); if (branding?.siteName) author = branding.siteName; if (branding?.logo) picture = branding.logo; } catch {}
    const clip = typeof f.videoUrl === "string" && /^https?:\/\//.test(f.videoUrl) ? f.videoUrl.slice(0, 500) : null;
    const now = Date.now();
    await db.collection("posts").add({
      uid: "system-rankings", author, picture,
      text: playerPostText(f), ts: now,
      likes: 0, likedBy: [], commentCount: 0, room: "general", savedBy: [],
      image: null, clip, poll: null,
      kind: "player", playerId, playerSlug: f.slug,
      player: {
        name: f.name, position: f.position || "", classYear: f.classYear || "",
        school: f.school || "", commit: f.commit || "", commitLogo: f.commitLogo || "", slug: f.slug || "",
        chip: f.chip, categories: f.categories || {}, categoryNotes: f.categoryNotes || {},
      },
    });
  } catch {}
}
async function gate(request: Request) {
  if (!adminConfigured) return { error: NextResponse.json({ error: "Not configured." }, { status: 400 }) };
  const role = await requireRole(request);
  if (!role || !["owner", "manager"].includes(role)) return { error: NextResponse.json({ error: "Not authorized." }, { status: 401 }) };
  const db = getAdminDb();
  if (!db) return { error: NextResponse.json({ error: "No database." }, { status: 500 }) };
  return { db };
}

// GET — all players (published + drafts), ranked.
export async function GET(request: Request) {
  const g = await gate(request); if (g.error) return g.error;
  const snap = await g.db!.collection("players").get();
  const players = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => (b.order || 0) - (a.order || 0));
  return NextResponse.json({ players });
}

// POST — create or update a player (also used to publish from a submission).
export async function POST(request: Request) {
  const g = await gate(request); if (g.error) return g.error;
  let b: any; try { b = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const s = (v: unknown, n = 200) => String(v ?? "").trim().slice(0, n);
  const name = s(b.name, 80);
  const classYear = s(b.classYear, 8);
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  // Per-category tier chips + overall (recommended from categories, coach can override).
  const categories = sanitizeCategories(b.categories);
  const chip: Chip = CHIPS.includes(b.chip) ? b.chip : recommendedOverall(categories).chip;
  const now = Date.now();
  const id = b.id ? String(b.id) : undefined;

  const fields: Record<string, unknown> = {
    name, classYear, chip, categories, categoryNotes: sanitizeCategoryNotes(b.categoryNotes),
    position: s(b.position, 24), school: s(b.school, 120), city: s(b.city, 80), state: s(b.state, 40),
    commit: s(b.commit, 80), commitLogo: s(b.commitLogo, 400),
    slug: s(b.slug) || slugify(name, classYear),
    bio: s(b.bio, 4000),
    strengths: Array.isArray(b.strengths) ? b.strengths.map((x: unknown) => s(x, 160)).slice(0, 8) : [],
    traits: Array.isArray(b.traits) ? b.traits.map((x: unknown) => s(x, 40)).slice(0, 10) : [],
    videoUrl: s(b.videoUrl, 500),
    heightIn: Number(b.heightIn) || 0, weightLb: Number(b.weightLb) || 0, fortyYd: s(b.fortyYd, 12),
    seoTitle: s(b.seoTitle, 80), seoDescription: s(b.seoDescription, 200),
    published: b.published !== false,
    removed: Boolean(b.removed),
    updatedAt: now,
  };

  try {
    if (id) {
      await g.db!.collection("players").doc(id).set(fields, { merge: true });
      // If a submission was the source, mark it published.
      if (b.fromSubmissionId) await g.db!.collection("submissions").doc(String(b.fromSubmissionId)).set({ status: "published", playerId: id }, { merge: true });
      return NextResponse.json({ ok: true, id });
    }
    const ref = await g.db!.collection("players").add({ ...fields, order: defaultOrder(chip, now), createdAt: now });
    if (b.fromSubmissionId) await g.db!.collection("submissions").doc(String(b.fromSubmissionId)).set({ status: "published", playerId: ref.id }, { merge: true });
    // Auto-announce the new player in the community feed (published players only).
    if (fields.published && !fields.removed && b.announce !== false) await announcePlayer(g.db!, ref.id, fields);
    return NextResponse.json({ ok: true, id: ref.id });
  } catch { return NextResponse.json({ error: "Save failed." }, { status: 500 }); }
}

// PATCH — reorder (move up/down), auto-rank, or quick chip change.
export async function PATCH(request: Request) {
  const g = await gate(request); if (g.error) return g.error;
  let b: any; try { b = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const snap = await g.db!.collection("players").get();
  const players = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).sort((a, b2) => (b2.order || 0) - (a.order || 0));

  if (b.action === "auto") {
    const batch = g.db!.batch();
    for (const p of players) batch.update(g.db!.collection("players").doc(p.id), { order: defaultOrder(p.chip || "bronze", p.createdAt || Date.now()) });
    await batch.commit();
    return NextResponse.json({ ok: true });
  }
  if (b.action === "move" && b.id) {
    const i = players.findIndex((p) => p.id === b.id);
    const j = b.direction === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= players.length) return NextResponse.json({ ok: true });
    const a = players[i], c = players[j];
    const batch = g.db!.batch();
    batch.update(g.db!.collection("players").doc(a.id), { order: c.order });
    batch.update(g.db!.collection("players").doc(c.id), { order: a.order });
    await batch.commit();
    return NextResponse.json({ ok: true });
  }
  // Quick single-CATEGORY change from the board → update that category and
  // recompute the overall chip from the new category scores.
  const CAT_KEYS = ["power", "speed", "motor", "technique", "iq"];
  if (b.id && CAT_KEYS.includes(b.category) && CHIPS.includes(b.chip)) {
    const ref = g.db!.collection("players").doc(String(b.id));
    const cur = sanitizeCategories((await ref.get()).data()?.categories);
    (cur as any)[b.category] = b.chip;
    await ref.set({ categories: cur, chip: recommendedOverall(cur).chip, updatedAt: Date.now() }, { merge: true });
    return NextResponse.json({ ok: true });
  }
  if (b.id && typeof b.classYear === "string") {
    await g.db!.collection("players").doc(String(b.id)).set({ classYear: b.classYear.trim().slice(0, 8), updatedAt: Date.now() }, { merge: true });
    return NextResponse.json({ ok: true });
  }
  if (b.id && CHIPS.includes(b.chip)) {
    await g.db!.collection("players").doc(String(b.id)).set({ chip: b.chip, updatedAt: Date.now() }, { merge: true });
    return NextResponse.json({ ok: true });
  }
  // Quick single-field updates from the board (e.g. paste a film link inline).
  if (b.id && typeof b.videoUrl === "string") {
    await g.db!.collection("players").doc(String(b.id)).set({ videoUrl: String(b.videoUrl).trim().slice(0, 500), updatedAt: Date.now() }, { merge: true });
    return NextResponse.json({ ok: true });
  }
  if (b.id && typeof b.published === "boolean") {
    await g.db!.collection("players").doc(String(b.id)).set({ published: b.published, updatedAt: Date.now() }, { merge: true });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

// DELETE ?id=
export async function DELETE(request: Request) {
  const g = await gate(request); if (g.error) return g.error;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  await g.db!.collection("players").doc(id).delete();
  return NextResponse.json({ ok: true });
}
