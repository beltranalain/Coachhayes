import { NextResponse } from "next/server";
import { resolveSchoolLogo } from "@/lib/schoolLogo";

// GET ?q=Miami → { found, name, logo, abbrev }. Thin wrapper over the shared
// resolver in lib/schoolLogo (also used by the WRE YouTube import).
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (!q) return NextResponse.json({ found: false, error: "Missing q." }, { status: 400 });
  const hit = await resolveSchoolLogo(q);
  if (!hit.found) return NextResponse.json({ found: false });
  return NextResponse.json(hit);
}
