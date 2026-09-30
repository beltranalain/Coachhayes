import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prepareMp4, streamConfigured } from "@/lib/stream";

export const dynamic = "force-dynamic";

// POST { uid } -> current MP4-preparation state for an uploaded intro video.
// The browser polls this after a direct upload until stage === "ready", then
// stores the returned CORS-enabled MP4 url as the bumper videoUrl. Admin only.
export async function POST(request: Request) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  if (!streamConfigured) {
    return NextResponse.json({ error: "Cloudflare Stream is not connected." }, { status: 400 });
  }
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const uid = String(body.uid || "").trim();
  if (!uid) return NextResponse.json({ error: "Missing uid." }, { status: 400 });

  const r = await prepareMp4(uid);
  return NextResponse.json(r, { status: r.stage === "error" ? 502 : 200 });
}
