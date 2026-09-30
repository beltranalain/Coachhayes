import { NextResponse } from "next/server";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";

// Public: a player/parent submits film + profile for review. Creates a
// `submissions` doc the admin reviews (with AI assist). No auth — but we keep
// only known fields and cap lengths. Contact email is stored for follow-up but
// NEVER shown publicly (minors protection).
export async function POST(request: Request) {
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const s = (v: unknown, n = 200) => String(v ?? "").trim().slice(0, n);
  const playerName = s(body.playerName, 80);
  const videoUrl = s(body.videoUrl, 500);
  const classYear = s(body.classYear, 8);
  if (!playerName || !videoUrl) return NextResponse.json({ error: "Player name and a film link are required." }, { status: 400 });
  if (!/^https?:\/\//i.test(videoUrl)) return NextResponse.json({ error: "Film link must be a valid URL." }, { status: 400 });

  const doc = {
    playerName,
    position: s(body.position, 24),
    school: s(body.school, 120),
    city: s(body.city, 80),
    state: s(body.state, 40),
    classYear,
    videoUrl,
    heightIn: Number(body.heightIn) || 0,
    weightLb: Number(body.weightLb) || 0,
    notes: s(body.notes, 2000),
    submitterEmail: s(body.submitterEmail, 160),   // private — follow-up only
    submitterRelation: s(body.submitterRelation, 40),
    status: "new" as const,
    aiDraft: null,
    createdAt: Date.now(),
  };

  if (!adminConfigured) return NextResponse.json({ saved: false, demo: true });
  try {
    const db = getAdminDb();
    if (!db) throw new Error("no db");
    const ref = await db.collection("submissions").add(doc);
    return NextResponse.json({ ok: true, id: ref.id });
  } catch {
    return NextResponse.json({ error: "Could not submit. Try again." }, { status: 500 });
  }
}
