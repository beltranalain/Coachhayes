import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";
import { getStripe, stripeConfigured, MEMBERSHIP_PRICES } from "@/lib/stripe";

export const dynamic = "force-dynamic";

type S = "ok" | "warn" | "fail" | "off";

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, r) => setTimeout(() => r(new Error("timeout")), ms))]);
}
// "off" = not configured, "ok" = responds, "fail" = configured but erroring.
async function check(present: boolean, fn: () => Promise<boolean>): Promise<S> {
  if (!present) return "off";
  try { return (await fn()) ? "ok" : "fail"; } catch { return "fail"; }
}

// GET — live connection status for every integration. Pings each service; never
// returns or logs the key itself. Returns a `services` array for the UI dots.
export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const cfAcct = process.env.CLOUDFLARE_ACCOUNT_ID || "";
  const cfTok = process.env.CLOUDFLARE_STREAM_API_TOKEN || "";
  const relay = process.env.RELAY_URL || "";
  const yt = process.env.YOUTUBE_API_KEY || "";
  const anthropic = process.env.ANTHROPIC_API_KEY || "";
  const resendKey = process.env.RESEND_API_KEY || "";
  const resendFrom = process.env.RESEND_FROM || "";
  const chatWs = process.env.NEXT_PUBLIC_CHAT_WS_URL || "";
  const chatHttp = chatWs.replace(/^wss:/, "https:").replace(/^ws:/, "http:");

  const [firebase, stream, stripe, resend, chat] = await Promise.all([
    check(adminConfigured, async () => { const db = getAdminDb(); if (!db) return false; await db.collection("site").limit(1).get(); return true; }),
    check(Boolean(cfAcct && cfTok), async () => { const r = await withTimeout(fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAcct}/stream?limit=1`, { headers: { Authorization: `Bearer ${cfTok}` } }), 5000); return r.ok; }),
    check(stripeConfigured, async () => { const st = getStripe(); if (!st) return false; await st.balance.retrieve(); return true; }),
    check(Boolean(resendKey), async () => { const r = await withTimeout(fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${resendKey}` } }), 5000); return r.ok; }),
    check(Boolean(chatHttp), async () => { const r = await withTimeout(fetch(chatHttp, { cache: "no-store" }), 5000); return r.ok; }),
  ]);

  const relayS: S = relay ? "ok" : "off";
  const youtubeS: S = yt ? "ok" : "off";
  const anthropicS: S = anthropic ? "ok" : "off";

  // Stripe connected but membership not fully wired -> yellow.
  let stripeS: S = stripe;
  let stripeDetail = "Payments, tips, membership and the shop";
  if (stripe === "ok") {
    const prices = Boolean(MEMBERSHIP_PRICES.timmy && MEMBERSHIP_PRICES.coordinator);
    const memWh = Boolean(process.env.STRIPE_WEBHOOK_SECRET_MEMBERSHIP || process.env.STRIPE_WEBHOOK_SECRET);
    if (!prices || !memWh) { stripeS = "warn"; stripeDetail = "Connected — one more step to turn on memberships"; }
  } else if (stripe === "off") { stripeDetail = "Not connected — connect to take payments"; }

  // Resend connected but no verified sender -> yellow.
  let resendS: S = resend;
  let resendDetail = "Sends your email campaigns";
  if (resend === "ok" && !resendFrom) { resendS = "warn"; resendDetail = "Connected — add a sender address to start sending"; }
  else if (resend === "off") resendDetail = "Not connected — connect to send emails";

  const services = [
    { key: "firebase", name: "Firebase", status: firebase, detail: "Your database and logins" },
    { key: "stream", name: "Cloudflare Stream", status: stream, detail: stream === "ok" ? "Live video, playback and uploads" : "Not connected — needed for live video" },
    { key: "relay", name: "Simulcast relay (Fly.io · MediaMTX)", status: relayS, detail: relay ? "Streams to YouTube, Twitch, etc. at once" : "Off — turn on to go live to several platforms at once" },
    { key: "youtube", name: "YouTube Data API", status: youtubeS, detail: yt ? "Pulls in your videos and live status" : "Off — connect to pull in your YouTube videos" },
    { key: "stripe", name: "Stripe", status: stripeS, detail: stripeDetail },
    { key: "resend", name: "Resend", status: resendS, detail: resendDetail },
    { key: "anthropic", name: "Anthropic (Claude AI)", status: anthropicS, detail: anthropic ? "AI player breakdowns" : "Off — connect for AI player scouting" },
    { key: "chat", name: "Chat worker (Cloudflare)", status: chat, detail: chat === "ok" ? "Real-time chat and tip alerts" : "Not connected" },
  ];
  // Back-compat flat map + the new services array.
  return NextResponse.json({ services, firebase, stream, stripe, resend, chat, youtube: youtubeS });
}
