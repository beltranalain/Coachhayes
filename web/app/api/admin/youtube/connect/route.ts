import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";
import { requireRole } from "@/lib/requireAdmin";
import { ytOAuthConfigured, consentUrl } from "@/lib/youtubeMembers";

export const dynamic = "force-dynamic";

// POST — start the owner OAuth: returns a Google consent URL for the admin to
// visit. A one-time `state` is stored so the callback can verify the round-trip.
export async function POST(request: Request) {
  if (!adminConfigured) return NextResponse.json({ error: "Not configured." }, { status: 400 });
  const role = await requireRole(request);
  if (!role || !["owner", "manager"].includes(role)) return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  if (!ytOAuthConfigured) {
    return NextResponse.json({ error: "Add the YouTube connection keys first (YOUTUBE_OAUTH_CLIENT_ID and YOUTUBE_OAUTH_CLIENT_SECRET)." }, { status: 400 });
  }
  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "No database." }, { status: 500 });

  const base = request.headers.get("origin") || new URL(request.url).origin;
  const redirectUri = `${base}/api/admin/youtube/callback`;
  const state = randomUUID();
  await db.collection("integrations").doc("youtube_oauth").set({ state, redirectUri, ts: Date.now() });

  return NextResponse.json({ url: consentUrl(redirectUri, state) });
}
