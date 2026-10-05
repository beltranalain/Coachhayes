import { NextResponse } from "next/server";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";
import { exchangeCode, saveYtConfig, memberChannel } from "@/lib/youtubeMembers";

export const dynamic = "force-dynamic";

// GET — Google redirects the owner back here with ?code & ?state. We verify the
// one-time state, exchange the code for a refresh token, and store it. No Bearer
// auth is possible on a top-level redirect, so the unguessable state is the gate.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = url.origin;
  const done = (q: string) => NextResponse.redirect(new URL(`/admin/members?yt=${q}`, base));

  if (!adminConfigured) return done("error");
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const db = getAdminDb();
  if (!db || !code || !state) return done("error");

  const stRef = db.collection("integrations").doc("youtube_oauth");
  const st = (await stRef.get()).data();
  if (!st || st.state !== state || Date.now() - (st.ts || 0) > 10 * 60 * 1000) return done("error");

  const redirectUri = st.redirectUri || `${base}/api/admin/youtube/callback`;
  const tok = await exchangeCode(code, redirectUri);
  if (!tok?.refreshToken) return done("norefresh");

  let channelTitle = "";
  if (tok.accessToken) { const ch = await memberChannel(tok.accessToken); channelTitle = ch?.title || ""; }

  await saveYtConfig({ refreshToken: tok.refreshToken, connectedAt: Date.now(), connectedChannelTitle: channelTitle });
  await stRef.delete().catch(() => {});
  return done("connected");
}
