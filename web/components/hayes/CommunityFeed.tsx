"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { firebaseConfigured, getFirebaseAuth, getIdToken } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useLiveStatus } from "@/components/hayes/useLiveStatus";
import { ROOMS } from "@/lib/communityRooms";
import ProfileView from "@/components/hayes/ProfileView";
import PlayerPostCard, { type PlayerPost } from "@/components/hayes/PlayerPostCard";

type Poll = { options: string[]; votedBy: Record<string, number> };
type Post = { id: string; uid: string; author: string; picture?: string | null; text: string; ts: number; likes: number; likedBy: string[]; commentCount: number; room: string; savedBy: string[]; image?: string | null; clip?: string | null; poll?: Poll | null; kind?: string | null; player?: PlayerPost | null };
type Comment = { id: string; author: string; picture?: string | null; text: string; ts: number };
type Notif = { id: string; type: "like" | "comment"; fromName: string; excerpt: string; postId: string; ts: number; read: boolean };
type Tab = "general" | "film" | "notifications" | "saved" | "profile";

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
const initial = (n: string) => (n || "?").charAt(0).toUpperCase();
function ytId(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}
// Downscale an image file to a data URL under Firestore's size budget.
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1280; let { width: w, height: h } = img;
        if (w > max || h > max) { const s = max / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject; img.src = String(r.result);
    };
    r.onerror = reject; r.readAsDataURL(file);
  });
}

type Show = { key: string; title: string; href: string; art: string; image?: string };

export default function CommunityFeed({ content: c, shows = [], playerSrc, liveInitial, logo }: { content: any; shows?: Show[]; playerSrc?: string; liveInitial: boolean; logo?: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("general");
  const [posts, setPosts] = useState<Post[]>([]);
  const [locked, setLocked] = useState(false);
  const [lockSignedIn, setLockSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);

  // composer
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [clip, setClip] = useState<string | null>(null);
  const [pollOpts, setPollOpts] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [open, setOpen] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [cText, setCText] = useState("");
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const live = useLiveStatus(liveInitial);
  const latestTs = useRef(0);

  useEffect(() => {
    if (!firebaseConfigured) return;
    const a = getFirebaseAuth(); if (!a) return;
    return onAuthStateChanged(a, (u) => setUser(u));
  }, []);

  // The signed-in member's own avatar comes from their profile (not Firebase
  // photoURL, which is empty for email sign-ups), used for the composer + replies.
  useEffect(() => {
    if (!user) { setMyAvatar(null); return; }
    (async () => {
      try { const r = await fetch("/api/community/profile", { headers: await authH(), cache: "no-store" }); const d = await r.json(); setMyAvatar(d.profile?.avatar || user.photoURL || null); } catch { setMyAvatar(user.photoURL || null); }
    })();
  }, [user]);
  const authH = async (): Promise<Record<string, string>> => { const t = await getIdToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };

  const loadPosts = useCallback(async (t: Tab) => {
    setLoading(true); setLocked(false);
    try {
      const q = t === "saved" ? "saved=1" : `room=${t}`;
      const r = await fetch(`/api/community/posts?${q}`, { headers: await authH(), cache: "no-store" });
      const d = await r.json();
      if (d.locked) { setLocked(true); setLockSignedIn(!!d.signedIn); setPosts([]); }
      else { setPosts(d.posts || []); latestTs.current = (d.posts || [])[0]?.ts || 0; }
    } catch {} finally { setLoading(false); }
  }, []);

  const loadNotifs = useCallback(async () => {
    try { const r = await fetch("/api/community/notifications", { headers: await authH(), cache: "no-store" }); const d = await r.json(); setNotifs(d.notifications || []); setUnread(d.unread || 0); } catch {}
  }, []);

  // load on tab change
  useEffect(() => {
    if (tab === "notifications") loadNotifs();
    else if (tab === "profile") { /* ProfileView loads its own data */ }
    else loadPosts(tab);
  }, [tab, user, loadPosts, loadNotifs]);

  // unread badge poll + realtime new posts
  useEffect(() => { if (user) loadNotifs(); }, [user, loadNotifs]);
  useEffect(() => {
    const id = setInterval(async () => {
      if (user) loadNotifs();
      if ((tab === "general" || tab === "film") && latestTs.current) {
        try {
          const r = await fetch(`/api/community/posts?room=${tab}&since=${latestTs.current}`, { headers: await authH(), cache: "no-store" });
          const d = await r.json();
          const fresh: Post[] = (d.posts || []).filter((p: Post) => p.ts > latestTs.current);
          if (fresh.length) { setPosts((prev) => { const ids = new Set(prev.map((x) => x.id)); const add = fresh.filter((f) => !ids.has(f.id)); if (add.length) latestTs.current = add[0].ts; return [...add, ...prev]; }); }
        } catch {}
      }
    }, 15000);
    return () => clearInterval(id);
  }, [tab, user, loadNotifs]);

  async function onPhoto(file: File) {
    try { if (file.size > 12_000_000) { setErr("Image too large."); return; } setImage(await fileToDataUrl(file)); } catch { setErr("Could not read image."); }
  }
  async function submit() {
    if (!user) return;
    if (!text.trim() && !image && !clip && !(pollOpts && pollOpts.filter((o) => o.trim()).length >= 2)) { setErr("Add something first."); return; }
    setBusy(true); setErr("");
    try {
      const body: any = { text, room: tab === "film" ? "film" : "general" };
      if (image) body.image = image;
      if (clip) body.clip = clip;
      if (pollOpts && pollOpts.filter((o) => o.trim()).length >= 2) body.poll = { options: pollOpts.filter((o) => o.trim()) };
      const r = await fetch("/api/community/posts", { method: "POST", headers: { "Content-Type": "application/json", ...(await authH()) }, body: JSON.stringify(body) });
      const d = await r.json();
      if (d.ok) { setPosts((p) => [d.post, ...p]); latestTs.current = d.post.ts; setText(""); setImage(null); setClip(null); setPollOpts(null); }
      else setErr(d.error || "Could not post.");
    } catch { setErr("Could not post."); } finally { setBusy(false); }
  }
  async function like(id: string) {
    if (!user) return; const uid = user.uid;
    setPosts((ps) => ps.map((p) => { if (p.id !== id) return p; const has = p.likedBy.includes(uid); return { ...p, likedBy: has ? p.likedBy.filter((x) => x !== uid) : [...p.likedBy, uid], likes: has ? p.likes - 1 : p.likes + 1 }; }));
    try { await fetch(`/api/community/posts/${id}/like`, { method: "POST", headers: await authH() }); } catch {}
  }
  async function save(id: string) {
    if (!user) return; const uid = user.uid;
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, savedBy: p.savedBy.includes(uid) ? p.savedBy.filter((x) => x !== uid) : [...p.savedBy, uid] } : p)));
    try { await fetch(`/api/community/posts/${id}/save`, { method: "POST", headers: await authH() }); } catch {}
  }
  async function vote(id: string, option: number) {
    if (!user) return; const uid = user.uid;
    setPosts((ps) => ps.map((p) => (p.id === id && p.poll ? { ...p, poll: { ...p.poll, votedBy: { ...p.poll.votedBy, [uid]: option } } } : p)));
    try { await fetch(`/api/community/posts/${id}/vote`, { method: "POST", headers: { "Content-Type": "application/json", ...(await authH()) }, body: JSON.stringify({ option }) }); } catch {}
  }
  async function toggleComments(id: string) {
    if (open === id) { setOpen(null); return; }
    setOpen(id); setCText("");
    if (!comments[id]) { try { const r = await fetch(`/api/community/posts/${id}/comments`, { cache: "no-store" }); const d = await r.json(); setComments((m) => ({ ...m, [id]: d.comments || [] })); } catch {} }
  }
  async function addComment(id: string) {
    if (!cText.trim() || !user) return; const t = cText; setCText("");
    try {
      const r = await fetch(`/api/community/posts/${id}/comments`, { method: "POST", headers: { "Content-Type": "application/json", ...(await authH()) }, body: JSON.stringify({ text: t }) });
      const d = await r.json();
      if (d.ok) { setComments((m) => ({ ...m, [id]: [...(m[id] || []), d.comment] })); setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, commentCount: p.commentCount + 1 } : p))); }
    } catch {}
  }
  async function openNotifs() {
    setTab("notifications");
    if (unread > 0) { try { await fetch("/api/community/notifications", { method: "POST", headers: await authH() }); setUnread(0); } catch {} }
  }

  const signedIn = Boolean(user);
  const myName = user?.displayName?.split(" ")[0] || user?.email?.split("@")[0] || "You";
  const showComposer = (tab === "general" || tab === "film") && !locked;

  return (
    <div className="feedwrap">
      {/* LEFT RAIL */}
      <aside className="lrail">
        <nav className="fnav">
          {ROOMS.map((r) => (
            <button key={r.key} className={tab === r.key ? "on" : undefined} onClick={() => setTab(r.key as Tab)}>
              <span className="i" />{r.label}{r.gated && <span className="lk">Coordinator</span>}
            </button>
          ))}
          <button className={tab === "notifications" ? "on" : undefined} onClick={openNotifs}>
            <span className="i" />Notifications{unread > 0 && <span className="badge2">{unread}</span>}
          </button>
          <button className={tab === "saved" ? "on" : undefined} onClick={() => setTab("saved")}>
            <span className="i" />Saved
          </button>
          <button className={tab === "profile" ? "on" : undefined} onClick={() => setTab("profile")}>
            <span className="i" />Your profile
          </button>
        </nav>
        {signedIn ? (
          <div className="pill" style={{ width: "100%", marginTop: 14, background: "var(--card)", border: "1px solid var(--hair)", color: "var(--ink)", justifyContent: "center" }}>Posting as {myName}</div>
        ) : (
          <Link className="pill" href="/account" style={{ width: "100%", marginTop: 14 }}>Sign in to post</Link>
        )}
      </aside>

      {/* MAIN */}
      <div className="feed" id="feed">
        {tab === "profile" && <ProfileView user={user} content={c} />}

        {(tab === "general" || tab === "film") && (
          <div className="livestrip">
            <Link href="/live" className={`lv1${live ? " on" : ""}`}>
              <span className="ring"><span className="th" style={{ background: "var(--deep)" }} /></span>
              <em>{live ? "Live now" : "Live"}</em>
            </Link>
            {shows.map((s) => (
              <Link key={s.key} href={s.href || "/live"} className="lv1">
                <span className="ring"><span className={`th${!s.image ? " " + (s.art || "a1") : ""}`} style={s.image ? { backgroundImage: `url(${s.image})` } : undefined} /></span>
                <em>{s.title}</em>
              </Link>
            ))}
          </div>
        )}

        {tab !== "profile" && showComposer && (
          <div className="composer">
            <span className="comment-av" style={{ width: 40, height: 40, fontSize: 15 }}>{signedIn ? (myAvatar ? <img src={myAvatar} alt="" /> : initial(myName)) : ""}</span>
            <div className="cbody">
              <textarea placeholder={signedIn ? `Say something${tab === "film" ? " in the Film Room" : ""}…` : "Sign in to say something about the game"} value={text} onChange={(e) => setText(e.target.value)} disabled={!signedIn} rows={2} style={{ width: "100%", resize: "vertical", background: "transparent", border: "none", outline: "none", color: "var(--ink)", font: "inherit", fontSize: 15 }} />

              {(image || clip || pollOpts) && (
                <div className="composer-attach">
                  {image && <span style={{ position: "relative" }}><img src={image} alt="" /><button onClick={() => setImage(null)} style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,.6)", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, cursor: "pointer" }}>×</button></span>}
                  {clip && <span className="pill sm soft" style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}>Clip: {clip}<button onClick={() => setClip(null)} style={{ marginLeft: 6, background: "none", border: "none", color: "var(--sub)", cursor: "pointer" }}>×</button></span>}
                </div>
              )}
              {pollOpts && (
                <div className="pollbuild">
                  {pollOpts.map((o, i) => (
                    <input key={i} value={o} placeholder={`Option ${i + 1}`} onChange={(e) => setPollOpts((p) => p!.map((x, j) => (j === i ? e.target.value : x)))} />
                  ))}
                  {pollOpts.length < 4 && <button className="link" style={{ fontSize: 13, textAlign: "left" }} onClick={() => setPollOpts((p) => [...p!, ""])}>+ Add option</button>}
                </div>
              )}

              <div className="ctools">
                {err && <span style={{ color: "var(--live)", fontSize: 13, marginRight: "auto" }}>{err}</span>}
                <label className="ct" style={{ cursor: signedIn ? "pointer" : "not-allowed" }}>Photo<input type="file" accept="image/*" disabled={!signedIn} style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(f); }} /></label>
                <button className="ct" disabled={!signedIn} onClick={() => { const u = prompt("Paste a YouTube or Hudl clip link:"); if (u) setClip(u.trim()); }}>Clip</button>
                <button className="ct" disabled={!signedIn} onClick={() => setPollOpts(pollOpts ? null : ["", ""])}>Poll</button>
                {signedIn ? <button className="pill sm" onClick={submit} disabled={busy} style={{ marginLeft: err ? 8 : "auto" }}>{busy ? "Posting…" : "Post"}</button> : <Link className="pill sm" href="/account" style={{ marginLeft: "auto" }}>Join</Link>}
              </div>
            </div>
          </div>
        )}

        {/* NOTIFICATIONS TAB */}
        {tab === "profile" ? null : tab === "notifications" ? (
          !signedIn ? (
            <div className="card" style={{ textAlign: "center", padding: "44px 30px" }}><h3 style={{ marginBottom: 8 }}>Sign in to see notifications</h3><Link className="pill" href="/account" style={{ marginTop: 12 }}>Sign in</Link></div>
          ) : notifs.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "44px 30px", color: "var(--sub)" }}>No notifications yet. Likes and replies on your posts show up here.</div>
          ) : (
            <div className="card" style={{ padding: "8px 18px" }}>
              {notifs.map((n) => (
                <div className={`notif${n.read ? "" : " unread"}`} key={n.id}>
                  <span className="post-av" style={{ width: 32, height: 32, fontSize: 13 }}>{initial(n.fromName)}</span>
                  <div style={{ fontSize: 14 }}><b>{n.fromName}</b> {n.type === "like" ? "liked" : "commented on"} your post{n.excerpt ? <> — <span style={{ color: "var(--sub)" }}>“{n.excerpt}”</span></> : ""}<div className="post-time">{timeAgo(n.ts)}</div></div>
                </div>
              ))}
            </div>
          )
        ) : locked ? (
          <div className="card" style={{ textAlign: "center", padding: "48px 30px" }}>
            <h3 style={{ marginBottom: 8 }}>The Film Room unlocks with The Coordinator</h3>
            <p style={{ color: "var(--sub)", maxWidth: "46ch", margin: "0 auto" }}>
              {lockSignedIn
                ? "This room is for The Coordinator members — the deep tape breakdowns, clips and polls live here. Upgrade to join in."
                : "Sign in and join The Coordinator to get into the Film Room — the deep tape breakdowns, clips and polls with people who watch the film."}
            </p>
            <Link className="pill" href="/membership" style={{ marginTop: 18 }}>{lockSignedIn ? "Upgrade to The Coordinator" : "See membership"}</Link>
          </div>
        ) : loading ? (
          <div className="card" style={{ textAlign: "center", padding: "40px 30px", color: "var(--sub)" }}>Loading…</div>
        ) : posts.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "48px 30px" }}>
            <h3 style={{ marginBottom: 8 }}>{tab === "saved" ? "Nothing saved yet" : tab === "film" ? "The Film Room is open" : "The Locker Room is open"}</h3>
            <p style={{ color: "var(--sub)", maxWidth: "44ch", margin: "0 auto" }}>{tab === "saved" ? "Tap the bookmark on any post to save it here." : "Be the first to post. Talk football with people who actually watch the tape."}</p>
            {!signedIn && tab !== "saved" && <Link className="pill" href="/account" style={{ marginTop: 18 }}>Sign in to post</Link>}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {posts.map((p) => {
              const liked = user ? p.likedBy.includes(user.uid) : false;
              const saved = user ? p.savedBy.includes(user.uid) : false;
              const vid = ytId(p.clip);
              return (
                <div className="post" key={p.id}>
                  <div className="post-head">
                    <span className="post-av">{p.picture ? <img src={p.picture} alt="" /> : initial(p.author)}</span>
                    <div><b>{p.author}</b><span className="post-time">{timeAgo(p.ts)}</span></div>
                  </div>
                  {p.kind === "player" && p.player ? (
                    <PlayerPostCard p={p.player} />
                  ) : (
                    p.text && <p className="post-text">{p.text}</p>
                  )}
                  {p.image && <img className="post-img" src={p.image} alt="" />}
                  {p.clip && (vid ? <div className="post-clip"><iframe src={`https://www.youtube.com/embed/${vid}`} title="clip" allow="encrypted-media; picture-in-picture" allowFullScreen /></div> : <a className="link" href={p.clip} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 8 }}>Watch clip ↗</a>)}
                  {p.poll && (() => {
                    const votes = Object.values(p.poll.votedBy || {}); const total = votes.length;
                    const mine = user ? p.poll.votedBy?.[user.uid] : undefined;
                    return (
                      <div className="poll">
                        {p.poll.options.map((o, i) => {
                          const count = votes.filter((v) => v === i).length; const pct = total ? Math.round((count / total) * 100) : 0;
                          const voted = mine !== undefined;
                          return (
                            <div key={i} className={`poll-opt${mine === i ? " mine" : ""}`} onClick={() => !voted && signedIn && vote(p.id, i)} style={{ cursor: voted || !signedIn ? "default" : "pointer" }}>
                              {voted && <span className="fill" style={{ width: `${pct}%` }} />}
                              <span className="lbl"><span>{o}</span>{voted && <span>{pct}%</span>}</span>
                            </div>
                          );
                        })}
                        <span className="post-time">{total} vote{total === 1 ? "" : "s"}{!signedIn ? " · sign in to vote" : ""}</span>
                      </div>
                    );
                  })()}
                  <div className="post-actions">
                    <button className={`react${liked ? " on" : ""}`} onClick={() => like(p.id)} disabled={!signedIn}>♥ {p.likes > 0 ? p.likes : ""}</button>
                    <button className="react" onClick={() => toggleComments(p.id)}>Reply {p.commentCount > 0 ? p.commentCount : ""}</button>
                    <button className={`react${saved ? " on" : ""}`} onClick={() => save(p.id)} disabled={!signedIn} style={{ marginLeft: "auto" }}>{saved ? "Saved" : "Save"}</button>
                  </div>
                  {open === p.id && (
                    <div className="post-comments">
                      {(comments[p.id] || []).map((cm) => (
                        <div className="comment" key={cm.id}>
                          <span className="comment-av">{cm.picture ? <img src={cm.picture} alt="" /> : initial(cm.author)}</span>
                          <div className="comment-body"><b>{cm.author}</b> {cm.text}<span className="post-time"> · {timeAgo(cm.ts)}</span></div>
                        </div>
                      ))}
                      {(comments[p.id] || []).length === 0 && <p className="post-time" style={{ margin: "2px 0 10px" }}>No replies yet. Be the first.</p>}
                      {signedIn ? (
                        <div className="reply-box">
                          <span className="comment-av">{myAvatar ? <img src={myAvatar} alt="" /> : initial(myName)}</span>
                          <input value={cText} onChange={(e) => setCText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addComment(p.id); }} placeholder="Add a reply…" />
                          <button className="pill sm" onClick={() => addComment(p.id)} disabled={!cText.trim()}>Send</button>
                        </div>
                      ) : <Link className="link" href="/account" style={{ fontSize: 13 }}>Sign in to reply</Link>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT RAIL */}
      <aside className="rrail">
        <div className="rcard">
          <h4>{c.watchTitle}</h4>
          <div style={{ position: "relative", aspectRatio: "16/9", borderRadius: 12, overflow: "hidden", background: "#000", margin: "10px 0 12px" }}>
            {live && playerSrc ? (
              <iframe src={`${playerSrc}${playerSrc.includes("?") ? "&" : "?"}autoplay=true&muted=true`} title="Live" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
            ) : (
              <div className="stage-soon rail">
                <span className={`soon-mark${logo ? " has-logo" : ""}`}>{logo ? <img src={logo} alt="" /> : null}</span>
                <b>Off air</b>
                <span>The show appears here the moment it goes live.</span>
              </div>
            )}
          </div>
          <Link className="pill sm soft" href="/live">{c.watchCta}</Link>
        </div>
        <div className="rcard">
          <h4>{c.roomsTitle}</h4>
          <p style={{ color: "var(--sub)", fontSize: 13.5, marginTop: 6 }}>{c.roomsText}</p>
        </div>
      </aside>
    </div>
  );
}
