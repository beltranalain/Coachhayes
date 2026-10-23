import { NextResponse } from "next/server";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";
import { requireRole } from "@/lib/requireAdmin";
import { getPlaylists, getPlaylistItems, youtubeConfigured } from "@/lib/youtube";
import { parseRecruits } from "@/lib/recruitParse";
import { resolveSchoolLogo } from "@/lib/schoolLogo";
import { slugify, defaultOrder, sanitizeCategories, recommendedOverall, type Chip } from "@/lib/rankings";
import { getSiteConfig } from "@/lib/siteConfig";
import { PRIMARY_CHANNEL } from "@/lib/channels";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function channelId(): Promise<string> {
  try { const { channels, branding } = await getSiteConfig(); return channels[0]?.channelId || (branding as any)?.youtubeChannelId || PRIMARY_CHANNEL.channelId; }
  catch { return PRIMARY_CHANNEL.channelId; }
}
const isWre = (t: string) => /\bw\.?r\.?e\.?\b|watch\.?\s*react/i.test(t || "");
const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

async function gate(request: Request) {
  if (!adminConfigured) return { error: NextResponse.json({ error: "Not configured." }, { status: 400 }) };
  const role = await requireRole(request);
  if (!role || !["owner", "manager"].includes(role)) return { error: NextResponse.json({ error: "Not authorized." }, { status: 401 }) };
  return { ok: true as const };
}

// GET — the channel's playlists (WRE ones first) so the admin can pick a source.
export async function GET(request: Request) {
  const g = await gate(request); if (g.error) return g.error;
  if (!youtubeConfigured) return NextResponse.json({ error: "YouTube isn't connected — add YOUTUBE_API_KEY." }, { status: 400 });
  const pls = await getPlaylists(await channelId(), 50);
  const sorted = [...pls].sort((a, b) => (isWre(b.title) ? 1 : 0) - (isWre(a.title) ? 1 : 0));
  return NextResponse.json({ playlists: sorted.map((p) => ({ id: p.id, title: p.title, itemCount: p.itemCount, thumbnail: p.thumbnail, wre: isWre(p.title) })) });
}

// POST — two actions:
//   { action:"preview", playlistId, classYear } -> fetch + AI-parse, flag dupes (NO writes)
//   { action:"commit", items:[...] }            -> create Pending players
export async function POST(request: Request) {
  const g = await gate(request); if (g.error) return g.error;
  let b: any; try { b = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  if (b.action === "preview") {
    if (!youtubeConfigured) return NextResponse.json({ error: "YouTube isn't connected — add YOUTUBE_API_KEY." }, { status: 400 });
    const playlistId = String(b.playlistId || "");
    if (!playlistId) return NextResponse.json({ error: "Pick a playlist first." }, { status: 400 });
    const all = await getPlaylistItems(playlistId, 20);
    if (!all.length) return NextResponse.json({ error: "That playlist looks empty, or YouTube is rate-limited." }, { status: 400 });
    // Cap per run so the AI parse stays under the function time limit; the admin
    // can import a huge playlist in a couple of passes.
    const CAP = 120;
    const items = all.slice(0, CAP);
    let candidates;
    try { candidates = await parseRecruits(items, String(b.classYear || "").trim()); }
    catch (e: any) { return NextResponse.json({ error: e?.message || "AI parsing failed." }, { status: 500 }); }

    // Flag recruits already on the board (best-effort — tolerates a read failure).
    const existing = new Set<string>();
    try {
      const db = getAdminDb();
      if (db) { const snap = await db.collection("players").get(); for (const d of snap.docs) existing.add(norm(d.data()?.name || "")); }
    } catch { /* quota / offline — skip dedup flagging */ }
    const out = candidates.map((c) => ({ ...c, exists: c.name ? existing.has(norm(c.name)) : false }));
    return NextResponse.json({ ok: true, total: items.length, truncated: all.length > items.length ? all.length : 0, candidates: out });
  }

  if (b.action === "commit") {
    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: "No database." }, { status: 500 });
    const rows: any[] = Array.isArray(b.items) ? b.items : [];
    if (!rows.length) return NextResponse.json({ error: "Nothing selected to import." }, { status: 400 });

    // Dedup against what's already there.
    let existing = new Set<string>();
    try { const snap = await db.collection("players").get(); for (const d of snap.docs) existing.add(norm(d.data()?.name || "")); }
    catch { return NextResponse.json({ error: "Could not read the board (database is rate-limited). Try again after the quota resets." }, { status: 503 }); }

    const now = Date.now();
    let created = 0, skipped = 0, i = 0;
    const errors: string[] = [];
    for (const r of rows) {
      const name = String(r.name || "").trim().slice(0, 80);
      if (!name || existing.has(norm(name))) { skipped++; continue; }
      existing.add(norm(name));
      const commit = String(r.commit || "").trim().slice(0, 80);
      let commitLogo = "";
      if (commit) { try { const hit = await resolveSchoolLogo(commit); if (hit.found) commitLogo = hit.logo; } catch {} }
      const categories = sanitizeCategories(undefined); // all bronze until graded
      const chip: Chip = recommendedOverall(categories).chip;
      const classYear = String(r.classYear || "").trim().slice(0, 8);
      try {
        await db.collection("players").add({
          name, classYear, chip, categories, categoryNotes: {},
          position: String(r.position || "").slice(0, 24), school: "", city: "", state: "",
          commit, commitLogo,
          slug: slugify(name, classYear),
          bio: "", strengths: [], traits: [],
          videoUrl: String(r.videoUrl || "").slice(0, 500),
          heightIn: 0, weightLb: 0, fortyYd: "",
          seoTitle: "", seoDescription: "",
          published: false, removed: false, source: "wre-import",
          order: -now - i, createdAt: now, updatedAt: now,
        });
        created++; i++;
      } catch { errors.push(name); }
    }
    return NextResponse.json({ ok: true, created, skipped, failed: errors.length });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
