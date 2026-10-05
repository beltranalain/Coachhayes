import { NextResponse } from "next/server";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";
import { verifyUser } from "@/lib/requireUser";
import { memberChannel, ownerAccessToken, checkMember, getYtConfig, tierForLevel } from "@/lib/youtubeMembers";

export const dynamic = "force-dynamic";

// POST — a signed-in member links their YouTube account to claim their tier.
// Body: { accessToken } — the member's Google OAuth access token (youtube.readonly),
// obtained client-side via Firebase Google sign-in with the scope added. We read
// their channel with THEIR token (so it's provably theirs), then check the owner's
// member list and grant the mapped tier. No billing is touched.
export async function POST(request: Request) {
  if (!adminConfigured) return NextResponse.json({ error: "Not configured." }, { status: 400 });
  const user = await verifyUser(request);
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  let b: any; try { b = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const accessToken = String(b.accessToken || "");
  if (!accessToken) return NextResponse.json({ error: "Missing YouTube authorization." }, { status: 400 });

  const ch = await memberChannel(accessToken);
  if (!ch) return NextResponse.json({ error: "We couldn't read your YouTube channel. Please allow YouTube access and try again." }, { status: 400 });

  const ownerTok = await ownerAccessToken();
  if (!ownerTok) return NextResponse.json({ error: "YouTube memberships aren't connected by the channel owner yet." }, { status: 400 });

  const res = await checkMember(ownerTok, ch.id);
  if (!res) return NextResponse.json({ error: "Couldn't verify your membership right now. Please try again." }, { status: 502 });
  if (!res.isMember) {
    return NextResponse.json({ member: false, message: "We couldn't find an active membership on that YouTube account. Make sure you're signed into the Google account you use to support the channel." });
  }

  const cfg = await getYtConfig();
  const tier = tierForLevel(cfg, res.levelId);

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "No database." }, { status: 500 });
  const ref = db.collection("memberships").doc(user.uid);
  const now = Date.now();
  const existing = await ref.get();
  await ref.set({
    userId: user.uid,
    email: user.email || "",
    name: user.name || "",
    tier,
    status: "active",
    source: "youtube",
    youtubeChannelId: ch.id,
    youtubeChannelTitle: ch.title || "",
    ytLevel: res.level || "",
    ytLevelId: res.levelId || "",
    ...(existing.exists ? {} : { createdAt: now }),
    updatedAt: now,
  }, { merge: true });

  return NextResponse.json({ member: true, tier, level: res.level || "" });
}
