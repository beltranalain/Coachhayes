import { NextResponse } from "next/server";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";
import { requireRole } from "@/lib/requireAdmin";
import { scoutDraft, aiConfigured } from "@/lib/aiScout";

function ytId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
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

// Admin: run the AI scout on a submission and save the draft back to it.
export async function POST(request: Request) {
  if (!adminConfigured) return NextResponse.json({ error: "Not configured." }, { status: 400 });
  if (!aiConfigured) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set — add it to enable the AI scout." }, { status: 400 });
  const role = await requireRole(request);
  if (!role || !["owner", "manager"].includes(role)) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const id = String(body.submissionId || "");
  if (!id) return NextResponse.json({ error: "Missing submissionId." }, { status: 400 });

  try {
    const db = getAdminDb();
    if (!db) throw new Error("no db");
    const ref = db.collection("submissions").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    const s = snap.data() as any;

    const meta = await ytMeta(String(s.videoUrl || ""));
    const draft = await scoutDraft({
      playerName: s.playerName, position: s.position, school: s.school, state: s.state,
      classYear: s.classYear, notes: s.notes, heightIn: s.heightIn, weightLb: s.weightLb,
      videoTitle: meta.title, videoDescription: meta.description,
    });

    await ref.set({ aiDraft: draft, status: "reviewing", aiDraftedAt: Date.now() }, { merge: true });
    return NextResponse.json({ ok: true, draft });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "AI draft failed." }, { status: 500 });
  }
}
