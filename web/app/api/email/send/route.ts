import { NextResponse } from "next/server";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";
import { requireIdentity } from "@/lib/requireAdmin";
import { renderEmail, sendEmails, emailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

async function brand() {
  const db = getAdminDb();
  try {
    const b = (await db?.collection("site").doc("branding").get())?.data() || {};
    const domain = String(b.domain || "").trim();
    return { name: b.siteName || "Coach Hayes Football", logo: b.logo || "", site: domain ? (domain.startsWith("http") ? domain : `https://${domain}`) : "" };
  } catch { return { name: "Coach Hayes Football", logo: "", site: "" }; }
}

// POST { subject, body, test? } — send the campaign to all subscribers, or just
// to the admin (test:true). Admin owner/manager only; needs Resend configured.
export async function POST(request: Request) {
  const { email: adminEmail, role } = await requireIdentity(request);
  if (!role || !["owner", "manager"].includes(role)) return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  if (!adminConfigured) return NextResponse.json({ error: "Not connected." }, { status: 400 });
  if (!emailConfigured) return NextResponse.json({ error: "Email isn't connected yet — set RESEND_API_KEY and RESEND_FROM." }, { status: 400 });

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "No database." }, { status: 500 });

  let b: any;
  try { b = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const subject = String(b.subject || "").trim().slice(0, 200);
  const body = String(b.body || "").trim().slice(0, 20000);
  const test = !!b.test;
  if (!subject) return NextResponse.json({ error: "Add a subject." }, { status: 400 });
  if (!body) return NextResponse.json({ error: "Add a message." }, { status: 400 });

  const { name, logo, site } = await brand();
  const html = renderEmail({ brandName: name, logo, siteUrl: site, subject, body });

  let to: string[];
  if (test) {
    if (!adminEmail) return NextResponse.json({ error: "No admin email to send the test to." }, { status: 400 });
    to = [adminEmail];
  } else {
    const snap = await db.collection("emailSubscribers").get();
    to = snap.docs.map((d) => String(d.data().email || d.id)).filter((e) => e.includes("@"));
    if (to.length === 0) return NextResponse.json({ error: "No subscribers yet." }, { status: 400 });
  }

  const { sent, error } = await sendEmails(to, subject, html);
  if (error) return NextResponse.json({ error, sent }, { status: 502 });
  // Record the campaign for history.
  if (!test) { try { await db.collection("emailCampaigns").add({ subject, body, recipients: sent, ts: Date.now() }); } catch {} }
  return NextResponse.json({ ok: true, sent, test });
}
