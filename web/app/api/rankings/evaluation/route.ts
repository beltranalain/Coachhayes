import { NextResponse } from "next/server";
import { getAdminDb, getAdminAuth, adminConfigured } from "@/lib/firebaseAdmin";
import { roleForEmail } from "@/lib/team";
import { sanitizeEvaluation, sanitizeAccess, normalizeEmails, evaluationTeaser } from "@/lib/evaluation";

export const dynamic = "force-dynamic";

// Public: read a player's evaluation, gated by the manual-unlock paywall.
//   free   -> full evaluation to anyone
//   locked -> teaser only, UNLESS the caller is an admin or their signed-in email
//             is on the player's unlock list (granted after paying)
//   none   -> { hasEval: false }
// Pass an optional Firebase ID token (Authorization: Bearer ...) to be recognized
// as an unlocked viewer / admin.
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ error: "Missing slug." }, { status: 400 });
  if (!adminConfigured) return NextResponse.json({ hasEval: false });

  const db = getAdminDb();
  if (!db) return NextResponse.json({ hasEval: false });

  try {
    const snap = await db.collection("players").where("slug", "==", slug).limit(1).get();
    if (snap.empty) return NextResponse.json({ hasEval: false });
    const d: any = snap.docs[0].data();
    if (!d.published || d.removed) return NextResponse.json({ hasEval: false });

    const evaluation = sanitizeEvaluation(d.evaluation);
    const access = sanitizeAccess(d.evalAccess);
    if (!evaluation || access === "none") return NextResponse.json({ hasEval: false });

    if (access === "free") {
      return NextResponse.json({ hasEval: true, locked: false, evaluation });
    }

    // Locked — figure out if this caller is allowed through.
    let email: string | null = null;
    let isAdmin = false;
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (token) {
      try {
        const auth = getAdminAuth();
        const decoded = auth ? await auth.verifyIdToken(token) : null;
        email = decoded?.email?.toLowerCase() || null;
        if (email) isAdmin = (await roleForEmail(email)) != null;
      } catch { /* unverified token — treat as anonymous */ }
    }
    const unlockList = normalizeEmails(d.evalUnlockEmails);
    const unlocked = isAdmin || (email ? unlockList.includes(email) : false);

    if (unlocked) return NextResponse.json({ hasEval: true, locked: false, evaluation });

    return NextResponse.json({
      hasEval: true,
      locked: true,
      price: String(d.evalPrice || ""),
      teaser: evaluationTeaser(evaluation),
      evaluatedOn: evaluation.evaluatedOn || "",
    });
  } catch {
    return NextResponse.json({ hasEval: false });
  }
}
