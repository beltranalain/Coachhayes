import { NextResponse } from "next/server";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";
import { sendEmails, renderEmail, emailConfigured } from "@/lib/email";
import { getSiteConfig } from "@/lib/siteConfig";

// Notify the coach that a new film came in. Best-effort: never block or fail the
// submission on an email error. Goes to CONTACT_TO_EMAIL (falls back to the env
// owners' inbox) only when Resend is configured.
async function notifyAdmin(doc: Record<string, any>) {
  if (!emailConfigured) return;
  const to = (process.env.CONTACT_TO_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",").map((x) => x.trim()).filter(Boolean);
  if (!to.length) return;
  try {
    const { branding } = await getSiteConfig();
    const brandName = branding?.siteName || "Coach Hayes Football";
    const site = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
    const ht = doc.heightIn ? `${Math.floor(doc.heightIn / 12)}'${doc.heightIn % 12}"` : "—";
    const body = [
      `A new film submission just came in for review.`,
      `Player: ${doc.playerName}`,
      `Position: ${doc.position || "—"}    Class: ${doc.classYear || "—"}`,
      `School: ${[doc.school, doc.city, doc.state].filter(Boolean).join(", ") || "—"}`,
      `Height: ${ht}    Weight: ${doc.weightLb ? doc.weightLb + " lb" : "—"}`,
      `Film: ${doc.videoUrl}`,
      doc.notes ? `Notes: ${doc.notes}` : "",
      doc.submitterEmail ? `From (${doc.submitterRelation || "submitter"}): ${doc.submitterEmail}` : "",
      "",
      `Review it in the Control Room${site ? `: ${site}/admin/evaluations` : " under Evaluations."}`,
    ].filter(Boolean).join("\n");
    const html = renderEmail({ brandName, logo: branding?.logo, subject: `New film: ${doc.playerName}`, body, siteUrl: site });
    await sendEmails(to, `New film submission — ${doc.playerName}`, html);
  } catch { /* ignore — notification is best-effort */ }
}

// Public: a player/parent submits film + profile for review. Creates a
// `submissions` doc the admin reviews (with AI assist). No auth — but we keep
// only known fields and cap lengths. Contact email is stored for follow-up but
// NEVER shown publicly (minors protection).
export async function POST(request: Request) {
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const s = (v: unknown, n = 200) => String(v ?? "").trim().slice(0, n);
  const playerName = s(body.playerName, 80);
  const videoUrl = s(body.videoUrl, 500);
  const classYear = s(body.classYear, 8);
  if (!playerName || !videoUrl) return NextResponse.json({ error: "Player name and a film link are required." }, { status: 400 });
  if (!/^https?:\/\//i.test(videoUrl)) return NextResponse.json({ error: "Film link must be a valid URL." }, { status: 400 });

  const doc = {
    playerName,
    position: s(body.position, 24),
    school: s(body.school, 120),
    city: s(body.city, 80),
    state: s(body.state, 40),
    classYear,
    videoUrl,
    heightIn: Number(body.heightIn) || 0,
    weightLb: Number(body.weightLb) || 0,
    notes: s(body.notes, 2000),
    submitterEmail: s(body.submitterEmail, 160),   // private — follow-up only
    submitterRelation: s(body.submitterRelation, 40),
    status: "new" as const,
    aiDraft: null,
    createdAt: Date.now(),
  };

  if (!adminConfigured) return NextResponse.json({ saved: false, demo: true });
  try {
    const db = getAdminDb();
    if (!db) throw new Error("no db");
    const ref = await db.collection("submissions").add(doc);
    await notifyAdmin(doc); // best-effort email to the coach
    return NextResponse.json({ ok: true, id: ref.id });
  } catch {
    return NextResponse.json({ error: "Could not submit. Try again." }, { status: 500 });
  }
}
