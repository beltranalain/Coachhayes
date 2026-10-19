import { NextResponse } from "next/server";
import { getPublishedPlayers, CHIP_META } from "@/lib/rankings";

export const dynamic = "force-dynamic";

// Public board feed for the mobile app (and any client). Returns only
// non-sensitive, already-published fields — NEVER the evaluation content or the
// unlock list. The app fetches the full evaluation separately through the
// paywall-gated /api/rankings/evaluation route.
export async function GET() {
  try {
    const players = await getPublishedPlayers();
    const rows = players.map((p) => ({
      slug: p.slug,
      name: p.name,
      position: p.position,
      school: p.school,
      city: p.city ?? "",
      state: p.state ?? "",
      classYear: p.classYear,
      chip: p.chip,
      chipLabel: CHIP_META[p.chip].label,
      categories: p.categories ?? null,
      videoUrl: p.videoUrl ?? "",
      commit: p.commit ?? "",
      commitLogo: p.commitLogo ?? "",
      hasEval: (p.evalAccess ?? "none") !== "none" && !!p.evaluation,
      evalAccess: p.evalAccess ?? "none",
      evalPrice: p.evalPrice ?? "",
    }));
    return NextResponse.json({ players: rows });
  } catch {
    return NextResponse.json({ players: [] }, { status: 200 });
  }
}
