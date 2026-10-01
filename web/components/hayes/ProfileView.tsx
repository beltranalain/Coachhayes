"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getIdToken } from "@/lib/firebase";
import type { User } from "firebase/auth";

type Counts = { posts: number; followers: number; following: number };
type Profile = { uid: string; name: string; handle: string; bio: string; avatar: string | null; cover: string | null; joinedAt: number; tier: string | null; isTeam: boolean; counts: Counts };
type Post = { id: string; author: string; picture?: string | null; text: string; ts: number; likes: number; likedBy: string[]; commentCount: number; image?: string | null; clip?: string | null; savedBy: string[] };
type Reply = { id: string; postId: string; text: string; ts: number; parentExcerpt: string };
type PTab = "posts" | "replies" | "media" | "fantasy";

const TIER_LABEL: Record<string, string> = { coordinator: "The Coordinator", timmy: "Po’ Lil Timmy" };
const initial = (n: string) => (n || "?").charAt(0).toUpperCase();
function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
function joinedLabel(ts: number) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
function memberFor(ts: number) {
  if (!ts) return "";
  const months = Math.max(0, Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24 * 30)));
  if (months < 1) return "New member";
  if (months < 12) return `Member ${months} month${months === 1 ? "" : "s"}`;
  const y = Math.floor(months / 12);
  return `Member ${y} year${y === 1 ? "" : "s"}`;
}
function fileToDataUrl(file: File, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width: w, height: h } = img;
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

export default function ProfileView({ user, content: c }: { user: User | null; content: any }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [ptab, setPtab] = useState<PTab>("posts");
  const [posts, setPosts] = useState<Post[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  // edit modal
  const [editing, setEditing] = useState(false);
  const [fName, setFName] = useState("");
  const [fHandle, setFHandle] = useState("");
  const [fBio, setFBio] = useState("");
  const [fAvatar, setFAvatar] = useState<string | null>(null);
  const [fCover, setFCover] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [eErr, setEErr] = useState("");

  const authH = async (): Promise<Record<string, string>> => { const t = await getIdToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch("/api/community/profile", { headers: await authH(), cache: "no-store" }); const d = await r.json(); setProfile(d.profile || null); } catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { if (user) load(); else setLoading(false); }, [user, load]);

  // load tab data
  useEffect(() => {
    if (!profile) return;
    let cancel = false;
    (async () => {
      setTabLoading(true);
      try {
        if (ptab === "posts" || ptab === "media") {
          const r = await fetch(`/api/community/posts?uid=${profile.uid}${ptab === "media" ? "&media=1" : ""}`, { headers: await authH(), cache: "no-store" });
          const d = await r.json(); if (!cancel) setPosts(d.posts || []);
        } else if (ptab === "replies") {
          const r = await fetch(`/api/community/profile/replies?uid=${profile.uid}`, { headers: await authH(), cache: "no-store" });
          const d = await r.json(); if (!cancel) setReplies(d.replies || []);
        }
      } catch {} finally { if (!cancel) setTabLoading(false); }
    })();
    return () => { cancel = true; };
  }, [ptab, profile]);

  function openEdit() {
    if (!profile) return;
    setFName(profile.name); setFHandle(profile.handle); setFBio(profile.bio);
    setFAvatar(profile.avatar); setFCover(profile.cover); setEErr(""); setEditing(true);
  }
  async function pickAvatar(f: File) { try { setFAvatar(await fileToDataUrl(f, 512)); } catch { setEErr("Could not read that image."); } }
  async function pickCover(f: File) { try { setFCover(await fileToDataUrl(f, 1600)); } catch { setEErr("Could not read that image."); } }
  async function saveProfile() {
    setSaving(true); setEErr("");
    try {
      const body = { name: fName, handle: fHandle, bio: fBio, avatar: fAvatar, cover: fCover };
      const r = await fetch("/api/community/profile", { method: "POST", headers: { "Content-Type": "application/json", ...(await authH()) }, body: JSON.stringify(body) });
      const d = await r.json();
      if (d.ok) { setEditing(false); await load(); }
      else setEErr(d.error || "Could not save.");
    } catch { setEErr("Could not save."); } finally { setSaving(false); }
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

  if (!user) {
    return <div className="card" style={{ textAlign: "center", padding: "48px 30px" }}><h3 style={{ marginBottom: 8 }}>Sign in to see your profile</h3><Link className="pill" href="/account" style={{ marginTop: 12 }}>Sign in</Link></div>;
  }
  if (loading || !profile) return <div className="card" style={{ textAlign: "center", padding: "40px 30px", color: "var(--sub)" }}>Loading your profile…</div>;

  const badge = profile.isTeam ? { cls: "coord", label: "Team" } : profile.tier ? { cls: profile.tier === "coordinator" ? "coord" : "timmy", label: TIER_LABEL[profile.tier] || "Member" } : { cls: "timmy", label: "Free member" };

  return (
    <div className="prof">
      {/* header */}
      <div className="prof-cover" style={profile.cover ? { backgroundImage: `url(${profile.cover})` } : undefined} />
      <div className="prof-top">
        <span className="prof-av">{profile.avatar ? <img src={profile.avatar} alt="" /> : initial(profile.name)}</span>
        <div className="prof-id">
          <h2>{profile.name}</h2>
          <div className="prof-meta">@{profile.handle}{profile.joinedAt ? <> · Joined {joinedLabel(profile.joinedAt)}</> : null}</div>
          <div className="prof-tags">
            <span className={`badge ${badge.cls}`}>{badge.label}</span>
            {profile.joinedAt ? <span className="chip-soft">{memberFor(profile.joinedAt)}</span> : null}
          </div>
          {profile.bio && <p className="prof-bio">{profile.bio}</p>}
        </div>
        <button className="pill soft" onClick={openEdit}>Edit profile</button>
      </div>

      {/* stats */}
      <div className="prof-stats">
        <div className="pstat"><b>{profile.counts.posts}</b><span>Posts</span></div>
        <div className="pstat"><b>{profile.counts.followers}</b><span>Followers</span></div>
        <div className="pstat"><b>{profile.counts.following}</b><span>Following</span></div>
        <Link href="/fantasy" className="pstat"><b>—</b><span>Fantasy</span></Link>
      </div>

      {/* tabs */}
      <div className="prof-tabs">
        {(["posts", "replies", "media", "fantasy"] as PTab[]).map((t) => (
          <button key={t} className={ptab === t ? "on" : undefined} onClick={() => setPtab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {/* tab body */}
      {ptab === "fantasy" ? (
        <div className="card" style={{ textAlign: "center", padding: "44px 30px" }}>
          <h3 style={{ marginBottom: 8 }}>No fantasy league yet</h3>
          <p style={{ color: "var(--sub)", maxWidth: "42ch", margin: "0 auto" }}>Join a Coach Hayes fantasy league and your standings and rank show up here.</p>
          <Link className="pill" href="/fantasy" style={{ marginTop: 16 }}>Go to Fantasy</Link>
        </div>
      ) : tabLoading ? (
        <div className="card" style={{ textAlign: "center", padding: "36px", color: "var(--sub)" }}>Loading…</div>
      ) : ptab === "replies" ? (
        replies.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "44px 30px", color: "var(--sub)" }}>No replies yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {replies.map((r) => (
              <div className="post" key={r.id}>
                {r.parentExcerpt && <div className="reply-ctx">Replying to “{r.parentExcerpt}”</div>}
                <p className="post-text">{r.text}</p>
                <div className="post-time">{timeAgo(r.ts)}</div>
              </div>
            ))}
          </div>
        )
      ) : posts.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "44px 30px", color: "var(--sub)" }}>{ptab === "media" ? "No photos or clips yet." : "No posts yet. Say something in the feed."}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {posts.map((p) => {
            const liked = user ? p.likedBy.includes(user.uid) : false;
            const saved = user ? p.savedBy.includes(user.uid) : false;
            return (
              <div className="post" key={p.id}>
                <div className="post-head">
                  <span className="post-av">{profile.avatar ? <img src={profile.avatar} alt="" /> : initial(profile.name)}</span>
                  <div><b>{profile.name}</b><span className="post-time">@{profile.handle} · {timeAgo(p.ts)}</span></div>
                </div>
                {p.text && <p className="post-text">{p.text}</p>}
                {p.image && <img className="post-img" src={p.image} alt="" />}
                {p.clip && <a className="link" href={p.clip} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 8 }}>Watch clip ↗</a>}
                <div className="post-actions">
                  <button className={`react${liked ? " on" : ""}`} onClick={() => like(p.id)}>♥ {p.likes > 0 ? p.likes : ""}</button>
                  <button className="react">Reply {p.commentCount > 0 ? p.commentCount : ""}</button>
                  <button className={`react${saved ? " on" : ""}`} onClick={() => save(p.id)} style={{ marginLeft: "auto" }}>{saved ? "Saved" : "Save"}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* edit modal */}
      {editing && (
        <div className="prof-modal" onClick={(e) => { if (e.target === e.currentTarget) setEditing(false); }}>
          <div className="prof-dialog">
            <div className="prof-dhead"><h3>Edit profile</h3><button className="x" onClick={() => setEditing(false)}>×</button></div>
            <div className="prof-editcover" style={fCover ? { backgroundImage: `url(${fCover})` } : undefined}>
              <label className="pill sm soft">Change cover<input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) pickCover(f); }} /></label>
            </div>
            <div className="prof-editav">
              <span className="prof-av">{fAvatar ? <img src={fAvatar} alt="" /> : initial(fName)}</span>
              <label className="pill sm soft">Change photo<input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) pickAvatar(f); }} /></label>
            </div>
            <label className="prof-lab">Display name<input className="acc-in" value={fName} onChange={(e) => setFName(e.target.value)} maxLength={40} /></label>
            <label className="prof-lab">Handle<div className="prof-handle"><span>@</span><input className="acc-in" value={fHandle} onChange={(e) => setFHandle(e.target.value.toLowerCase())} maxLength={20} placeholder="handle" /></div><span className="prof-hint">3–20 characters: letters, numbers, underscores.</span></label>
            <label className="prof-lab">Bio<textarea className="acc-in" value={fBio} onChange={(e) => setFBio(e.target.value)} maxLength={200} rows={3} placeholder="A line about you." /></label>
            {eErr && <p style={{ color: "var(--live)", fontSize: 13 }}>{eErr}</p>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
              <button className="pill soft" onClick={() => setEditing(false)}>Cancel</button>
              <button className="pill" onClick={saveProfile} disabled={saving}>{saving ? "Saving…" : "Save profile"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
