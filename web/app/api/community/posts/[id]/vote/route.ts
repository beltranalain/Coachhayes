import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { verifyUser } from "@/lib/requireUser";

// POST { option } — cast/change the caller's vote on a post's poll.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await verifyUser(request);
  if (!u) return NextResponse.json({ error: "Sign in to vote." }, { status: 401 });
  let b: any; try { b = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const option = Number(b.option);
  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "No database." }, { status: 500 });
  try {
    const ref = db.collection("posts").doc(id);
    const votedBy = await db.runTransaction(async (t) => {
      const s = await t.get(ref);
      if (!s.exists) throw new Error("gone");
      const poll = s.data()?.poll;
      if (!poll || !Array.isArray(poll.options) || option < 0 || option >= poll.options.length) throw new Error("bad");
      const vb = { ...(poll.votedBy || {}), [u.uid]: option };
      t.update(ref, { "poll.votedBy": vb });
      return vb;
    });
    return NextResponse.json({ ok: true, votedBy });
  } catch {
    return NextResponse.json({ error: "Could not vote." }, { status: 400 });
  }
}
