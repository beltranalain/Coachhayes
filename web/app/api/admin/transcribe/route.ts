import { NextResponse } from "next/server";
import { requireRole } from "@/lib/requireAdmin";
import { transcribeClip, transcribeConfigured } from "@/lib/aiProvider";

export const dynamic = "force-dynamic";
// 60s is the max a Vercel Hobby (free) function gets. A 3-4 min clip transcribes
// in a few seconds on Groq, so this is plenty — the earlier 120 was above the
// Hobby cap and could fall back to a low default. Raise to 300 on Vercel Pro.
export const maxDuration = 60;

// Admin: transcribe a recorded audio clip (Coach talking through the film) to
// text via Whisper. Expects multipart/form-data with an "audio" file field.
export async function POST(request: Request) {
  if (!transcribeConfigured()) return NextResponse.json({ error: "Voice isn't connected — add GROQ_API_KEY (or OPENAI_API_KEY)." }, { status: 400 });
  const role = await requireRole(request);
  if (!role || !["owner", "manager"].includes(role)) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Invalid upload." }, { status: 400 }); }
  const file = form.get("audio");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "No audio provided." }, { status: 400 });
  if (file.size > 25 * 1024 * 1024) return NextResponse.json({ error: "Clip too large (25MB max). Record a shorter take." }, { status: 400 });

  try {
    const name = (file as File).name || "coach-eval.webm";
    const text = await transcribeClip(file, name);
    return NextResponse.json({ ok: true, text });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Transcription failed." }, { status: 500 });
  }
}
