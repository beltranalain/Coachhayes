import { NextResponse } from "next/server";
import { getAdminAuth, adminConfigured } from "@/lib/firebaseAdmin";
import { roleForEmail } from "@/lib/team";

export const dynamic = "force-dynamic";

// Mobile -> Studio auth bridge. The app is already signed in (Firebase), but the
// embedded web Studio runs its own session and would otherwise show a second
// login. The app posts its ID token here; we verify it, confirm the caller is an
// admin, and mint a short-lived CUSTOM token the Studio page can consume with
// signInWithCustomToken — so Go Live opens already signed in, no second login.
export async function POST(request: Request) {
  if (!adminConfigured) return NextResponse.json({ error: "Auth is not configured." }, { status: 400 });
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const auth = getAdminAuth();
  if (!auth || !token) return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  try {
    const decoded = await auth.verifyIdToken(token);
    const role = await roleForEmail(decoded.email);
    if (!role) return NextResponse.json({ error: "Not an admin." }, { status: 401 });
    const customToken = await auth.createCustomToken(decoded.uid);
    return NextResponse.json({ ok: true, token: customToken });
  } catch {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
}
