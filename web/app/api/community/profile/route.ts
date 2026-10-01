import { NextResponse } from "next/server";
import { getAdminDb, getAdminAuth, adminConfigured } from "@/lib/firebaseAdmin";
import { verifyUser } from "@/lib/requireUser";
import { getMembership, effectiveTier } from "@/lib/membership";
import { roleForEmail } from "@/lib/team";

export const dynamic = "force-dynamic";

const handleRe = /^[a-z0-9_]{3,20}$/;
function defaultHandle(email: string | null, uid: string) {
  const base = (email?.split("@")[0] || "member").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 16);
  return (base.length >= 3 ? base : `coach_${uid.slice(0, 6)}`).toLowerCase();
}

async function counts(db: FirebaseFirestore.Firestore, uid: string) {
  try {
    const [p, fol, fing] = await Promise.all([
      db.collection("posts").where("uid", "==", uid).count().get(),
      db.collection("follows").where("target", "==", uid).count().get(),
      db.collection("follows").where("follower", "==", uid).count().get(),
    ]);
    return { posts: p.data().count, followers: fol.data().count, following: fing.data().count };
  } catch {
    return { posts: 0, followers: 0, following: 0 };
  }
}

// GET — a profile. ?uid= or ?handle= (else the caller's own). Returns profile
// fields, real counts, tier, and (for the viewer) isMe / isFollowing.
export async function GET(request: Request) {
  if (!adminConfigured) return NextResponse.json({ configured: false });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ configured: false });
  const url = new URL(request.url);
  const viewer = await verifyUser(request);
  let uid = url.searchParams.get("uid") || "";
  const handle = (url.searchParams.get("handle") || "").toLowerCase();

  if (!uid && handle) {
    const q = await db.collection("profiles").where("handleLower", "==", handle).limit(1).get();
    if (!q.empty) uid = q.docs[0].id;
  }
  if (!uid) uid = viewer?.uid || "";
  if (!uid) return NextResponse.json({ configured: true, error: "No profile." }, { status: 404 });

  const doc = await db.collection("profiles").doc(uid).get();
  const p = doc.exists ? doc.data() || {} : {};

  // Resolve name/email/joined from auth if we can (own profile is guaranteed).
  let name = p.name || ""; let email: string | null = null; let joinedAt = p.joinedAt || 0;
  const auth = getAdminAuth();
  if (auth) {
    try {
      const rec = await auth.getUser(uid);
      name = name || rec.displayName || rec.email?.split("@")[0] || "Member";
      email = rec.email || null;
      if (!joinedAt && rec.metadata?.creationTime) joinedAt = new Date(rec.metadata.creationTime).getTime();
    } catch {}
  }
  const isTeam = (await roleForEmail(email)) != null;
  const { tier } = await getMembership(uid);
  const c = await counts(db, uid);

  let isFollowing = false;
  if (viewer && viewer.uid !== uid) {
    const f = await db.collection("follows").doc(`${viewer.uid}__${uid}`).get();
    isFollowing = f.exists;
  }

  return NextResponse.json({
    configured: true,
    profile: {
      uid,
      name: name || "Member",
      handle: p.handle || defaultHandle(email, uid),
      bio: p.bio || "",
      avatar: p.avatar || null,
      cover: p.cover || null,
      joinedAt,
      tier: effectiveTier(tier, isTeam),
      isTeam,
      counts: c,
    },
    isMe: viewer?.uid === uid,
    isFollowing,
  });
}

// POST — update the caller's own profile (name, handle, bio, avatar, cover).
export async function POST(request: Request) {
  const u = await verifyUser(request);
  if (!u) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "No database." }, { status: 500 });
  let b: any; try { b = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const patch: Record<string, unknown> = {};
  if (typeof b.name === "string") {
    const name = b.name.trim().slice(0, 40);
    if (!name) return NextResponse.json({ error: "Name can’t be empty." }, { status: 400 });
    patch.name = name;
  }
  if (typeof b.handle === "string") {
    const handle = b.handle.trim().toLowerCase().replace(/^@/, "");
    if (!handleRe.test(handle)) return NextResponse.json({ error: "Handle must be 3–20 characters: letters, numbers or underscores." }, { status: 400 });
    const clash = await db.collection("profiles").where("handleLower", "==", handle).limit(1).get();
    if (!clash.empty && clash.docs[0].id !== u.uid) return NextResponse.json({ error: "That handle is taken." }, { status: 409 });
    patch.handle = handle; patch.handleLower = handle;
  }
  if (typeof b.bio === "string") patch.bio = b.bio.trim().slice(0, 200);
  if (typeof b.avatar === "string" || b.avatar === null) patch.avatar = b.avatar && b.avatar.startsWith("data:image") && b.avatar.length < 700_000 ? b.avatar : null;
  if (typeof b.cover === "string" || b.cover === null) patch.cover = b.cover && b.cover.startsWith("data:image") && b.cover.length < 1_400_000 ? b.cover : null;

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  patch.updatedAt = Date.now();
  await db.collection("profiles").doc(u.uid).set(patch, { merge: true });

  // Keep the auth displayName in sync so tokens/new posts carry the new name.
  if (patch.name) { const auth = getAdminAuth(); try { await auth?.updateUser(u.uid, { displayName: patch.name as string }); } catch {} }

  // No backfill needed: posts/comments are enriched with the live profile
  // name + avatar at read time (see lib/communityAuthors).
  return NextResponse.json({ ok: true, profile: patch });
}
