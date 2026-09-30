import { NextResponse } from "next/server";
import { getHayesContent } from "@/lib/siteConfig";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";
import { requireRole } from "@/lib/requireAdmin";
import type { Role } from "@/lib/admin";
import { DEFAULT_HAYES, type HayesContent } from "@/lib/hayesContent";

// GET -> the merged Hayes site content (Firestore site/hayes over defaults).
export async function GET() {
  const content = await getHayesContent();
  return NextResponse.json({ configured: adminConfigured, content });
}

// POST { section: keyof HayesContent, data } -> writes that section to
// Firestore site/hayes after verifying the caller's Firebase token + role.
export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const section = body?.section as keyof HayesContent;
  const data = body?.data;
  if (!section || !(section in DEFAULT_HAYES)) {
    return NextResponse.json({ error: "Unknown section." }, { status: 400 });
  }
  if (!data || typeof data !== "object") {
    return NextResponse.json({ error: "Missing data." }, { status: 400 });
  }

  if (!adminConfigured) {
    return NextResponse.json({ saved: false, demo: true });
  }

  const role = await requireRole(request);
  if (!role) return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  const editors: Role[] = ["owner", "manager"];
  if (!editors.includes(role)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  try {
    const db = getAdminDb();
    if (!db) throw new Error("no db");
    // Whitelist keys against the default shape so only known fields are written,
    // and guard against oversized inline images (keep the doc under 1MB).
    const template = DEFAULT_HAYES[section] as Record<string, unknown>;
    const clean: Record<string, unknown> = {};
    for (const key of Object.keys(template)) {
      if (key in data) clean[key] = sanitize(data[key]);
    }
    await db.collection("site").doc("hayes").set({ [section]: clean }, { merge: true });
    return NextResponse.json({ saved: true });
  } catch {
    return NextResponse.json({ error: "Save failed." }, { status: 500 });
  }
}

// Drop oversized inline image data URLs anywhere in the value; leave everything
// else intact. Keeps the Firestore doc comfortably under the 1MB limit.
function sanitize(v: unknown): unknown {
  if (typeof v === "string") {
    if (v.startsWith("data:") && (!v.startsWith("data:image") || v.length > 300_000)) return "";
    return v.slice(0, 4000);
  }
  if (Array.isArray(v)) return v.slice(0, 40).map(sanitize);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) out[k] = sanitize(val);
    return out;
  }
  return v;
}
