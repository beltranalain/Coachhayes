import { NextResponse } from "next/server";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";
import { requireRole } from "@/lib/requireAdmin";
import { renderEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

async function brand() {
  if (!adminConfigured) return { name: "Coach Hayes Football", logo: "", site: "" };
  const db = getAdminDb();
  if (!db) return { name: "Coach Hayes Football", logo: "", site: "" };
  try {
    const b = (await db.collection("site").doc("branding").get()).data() || {};
    const domain = String(b.domain || "").trim();
    return { name: b.siteName || "Coach Hayes Football", logo: b.logo || "", site: domain ? (domain.startsWith("http") ? domain : `https://${domain}`) : "" };
  } catch { return { name: "Coach Hayes Football", logo: "", site: "" }; }
}

// POST { subject, body } -> rendered email HTML (admin). Used by the Preview
// button so what you see is exactly what gets sent.
export async function POST(request: Request) {
  const role = await requireRole(request);
  if (!role || !["owner", "manager"].includes(role)) return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  let b: any;
  try { b = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const { name, logo, site } = await brand();
  const html = renderEmail({ brandName: name, logo, siteUrl: site, subject: String(b.subject || "").slice(0, 200), body: String(b.body || "").slice(0, 20000) });
  return NextResponse.json({ html });
}
