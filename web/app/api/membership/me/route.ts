import { NextResponse } from "next/server";
import { verifyUser } from "@/lib/requireUser";
import { getMembership, effectiveTier } from "@/lib/membership";
import { roleForEmail } from "@/lib/team";

export const dynamic = "force-dynamic";

// GET — the caller's membership standing, used by the account page and the
// community feed to reflect real access (Free member / The Coordinator / team).
export async function GET(request: Request) {
  const u = await verifyUser(request);
  if (!u) return NextResponse.json({ signedIn: false, tier: null, isTeam: false, effective: null });
  const isTeam = (await roleForEmail(u.email)) != null;
  const { tier, status } = await getMembership(u.uid);
  return NextResponse.json({ signedIn: true, tier, status, isTeam, effective: effectiveTier(tier, isTeam) });
}
