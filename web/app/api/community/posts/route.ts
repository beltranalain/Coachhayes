import { NextResponse } from "next/server";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";
import { verifyUser } from "@/lib/requireUser";
import { isRoom, roomGated, roomMinTier, tierMeets } from "@/lib/communityRooms";
import { getMembership, effectiveTier } from "@/lib/membership";
import { roleForEmail } from "@/lib/team";
import { authorMap, withLiveAuthor } from "@/lib/communityAuthors";

// Can this member enter a gated room? Team members always can; otherwise their
// active membership tier must meet the room's minimum (Film Room = Coordinator).
async function canEnter(room: string, u: { uid: string; email: string | null } | null): Promise<boolean> {
  const min = roomMinTier(room);
  if (!min) return true;
  if (!u) return false;
  const isTeam = (await roleForEmail(u.email)) != null;
  const { tier } = await getMembership(u.uid);
  return tierMeets(effectiveTier(tier, isTeam), min);
}

export const dynamic = "force-dynamic";

function shape(id: string, x: any) {
  return {
    id, uid: x.uid, author: x.author || "Member", picture: x.picture || null, text: x.text || "",
    ts: x.ts || 0, likes: x.likes || 0, likedBy: x.likedBy || [], commentCount: x.commentCount || 0,
    room: x.room || "general", savedBy: x.savedBy || [],
    image: x.image || null, clip: x.clip || null,
    poll: x.poll ? { options: x.poll.options || [], votedBy: x.poll.votedBy || {} } : null,
    kind: x.kind || null, player: x.player || null,
  };
}

// GET — posts. ?room=general | ?saved=1 (auth) | ?since=<ts> for realtime.
export async function GET(request: Request) {
  if (!adminConfigured) return NextResponse.json({ configured: false, posts: [] });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ configured: false, posts: [] });
  const url = new URL(request.url);
  const room = url.searchParams.get("room") || "general";
  const saved = url.searchParams.get("saved") === "1";
  const authorUid = url.searchParams.get("uid") || "";
  const media = url.searchParams.get("media") === "1";
  const since = Number(url.searchParams.get("since")) || 0;
  const u = await verifyUser(request); // optional

  // Gated room content requires an unlocked membership tier (Coordinator for Film).
  if (!saved && !authorUid && roomGated(room) && !(await canEnter(room, u))) {
    return NextResponse.json({ configured: true, locked: true, needsTier: roomMinTier(room), signedIn: !!u, posts: [] });
  }

  try {
    const snap = await db.collection("posts").orderBy("ts", "desc").limit(200).get();
    let posts = snap.docs.map((d) => shape(d.id, d.data()));
    if (authorUid) {
      // A member's own posts (profile). Hide gated-room posts from viewers who
      // can't access that room, unless it's their own profile.
      const canFilm = authorUid === u?.uid ? true : await canEnter("film", u);
      posts = posts.filter((p) => p.uid === authorUid && (canFilm || !roomGated(p.room)));
      if (media) posts = posts.filter((p) => p.image || p.clip);
    } else if (saved) {
      if (!u) return NextResponse.json({ configured: true, posts: [] });
      posts = posts.filter((p) => p.savedBy.includes(u.uid));
    } else {
      posts = posts.filter((p) => (isRoom(p.room) ? p.room : "general") === room);
    }
    if (since) posts = posts.filter((p) => p.ts > since);
    // Overlay each author's current name + avatar so profile edits show live.
    const am = await authorMap(db, posts.map((p) => p.uid));
    posts = posts.map((p) => withLiveAuthor(p, am));
    return NextResponse.json({ configured: true, posts });
  } catch {
    return NextResponse.json({ configured: true, posts: [] });
  }
}

// POST — create a post (text and/or image/clip/poll) in a room.
export async function POST(request: Request) {
  const u = await verifyUser(request);
  if (!u) return NextResponse.json({ error: "Sign in to post." }, { status: 401 });
  let b: any; try { b = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const text = String(b.text ?? "").trim().slice(0, 1000);
  const room = isRoom(b.room) ? b.room : "general";
  if (roomGated(room) && !(await canEnter(room, u))) {
    return NextResponse.json({ error: "The Film Room is for The Coordinator members." }, { status: 403 });
  }

  const image = typeof b.image === "string" && b.image.startsWith("data:image") && b.image.length < 900_000 ? b.image : null;
  const clip = typeof b.clip === "string" && /^https?:\/\//.test(b.clip) ? b.clip.slice(0, 500) : null;
  let poll: { options: string[]; votedBy: Record<string, number> } | null = null;
  if (Array.isArray(b.poll?.options)) {
    const opts = b.poll.options.map((o: unknown) => String(o ?? "").trim().slice(0, 80)).filter(Boolean).slice(0, 4);
    if (opts.length >= 2) poll = { options: opts, votedBy: {} };
  }
  if (!text && !image && !clip && !poll) return NextResponse.json({ error: "Add something to post." }, { status: 400 });

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "No database." }, { status: 500 });
  // Prefer the member's profile name/avatar (if they've customised it).
  let author = u.name; let picture = u.picture;
  try { const pf = (await db.collection("profiles").doc(u.uid).get()).data(); if (pf?.name) author = pf.name; if (pf?.avatar) picture = pf.avatar; } catch {}
  const now = Date.now();
  const doc: any = { uid: u.uid, author, picture, text, ts: now, likes: 0, likedBy: [], commentCount: 0, room, savedBy: [], image, clip, poll };
  const ref = await db.collection("posts").add(doc);
  return NextResponse.json({ ok: true, post: { id: ref.id, ...doc } });
}
