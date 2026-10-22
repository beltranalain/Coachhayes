import { NextResponse } from "next/server";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";
import { requireRole } from "@/lib/requireAdmin";
import { generateEvaluation, aiEvalConfigured } from "@/lib/aiEval";

export const dynamic = "force-dynamic";
// 60s = the Vercel Hobby (free) function cap; the earlier 120 exceeded it. The AI
// draft comes back in well under a minute. Raise to 300 on Vercel Pro.
export const maxDuration = 60;

function ytId(url: string): string | null {
  const m = String(url || "").match(/(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}
async function ytMeta(url: string): Promise<{ title?: string; description?: string }> {
  const id = ytId(url);
  const key = process.env.YOUTUBE_API_KEY;
  if (!id || !key) return {};
  try {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${id}&key=${key}`, { cache: "no-store" });
    const d = await r.json();
    const sn = d?.items?.[0]?.snippet;
    return sn ? { title: sn.title, description: (sn.description || "").slice(0, 2000) } : {};
  } catch { return {}; }
}

// Admin: generate a long-form evaluation from Coach's spoken transcript and/or
// the recruit's profile + film metadata. Returns the draft (does NOT persist) —
// the editor reviews, edits, then saves it onto the player via /api/admin/players.
export async function POST(request: Request) {
  if (!adminConfigured) return NextResponse.json({ error: "Not configured." }, { status: 400 });
  if (!aiEvalConfigured) return NextResponse.json({ error: "No AI provider is connected — add GROQ_API_KEY (or OPENAI/DEEPSEEK)." }, { status: 400 });
  const role = await requireRole(request);
  if (!role || !["owner", "manager"].includes(role)) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  let b: any;
  try { b = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  // Source can be a player, a submission, or raw fields passed inline.
  let src: any = { ...b };
  try {
    const db = getAdminDb();
    if (db && b.playerId) {
      const snap = await db.collection("players").doc(String(b.playerId)).get();
      if (snap.exists) src = { ...snap.data(), ...b };
    } else if (db && b.submissionId) {
      const snap = await db.collection("submissions").doc(String(b.submissionId)).get();
      if (snap.exists) { const s: any = snap.data(); src = { ...s, playerName: s.playerName, ...b }; }
    }
  } catch { /* fall back to inline fields */ }

  const videoUrl = String(src.videoUrl || "");
  const meta = videoUrl ? await ytMeta(videoUrl) : {};

  try {
    const evaluation = await generateEvaluation({
      playerName: String(src.playerName || src.name || ""),
      position: String(src.position || ""),
      school: String(src.school || ""),
      city: String(src.city || ""),
      state: String(src.state || ""),
      classYear: String(src.classYear || ""),
      heightIn: Number(src.heightIn) || undefined,
      weightLb: Number(src.weightLb) || undefined,
      jersey: String(src.jersey || ""),
      videoUrl,
      videoTitle: meta.title,
      videoDescription: meta.description,
      notes: String(src.notes || ""),
      transcript: String(b.transcript || ""),
    });
    return NextResponse.json({ ok: true, evaluation });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Evaluation failed." }, { status: 500 });
  }
}
