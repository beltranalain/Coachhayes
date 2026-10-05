"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import GoogleIcon from "@/components/hayes/GoogleIcon";
import YouTubeMemberLink from "@/components/hayes/YouTubeMemberLink";
import { firebaseConfigured, getFirebaseAuth, getIdToken } from "@/lib/firebase";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";

// Public member account page: create a free account or sign in (Google/email),
// then see account status. Paid tier checkout (Po' Lil Timmy / The Coordinator)
// is wired in the membership phase — those buttons explain that for now.
export default function AccountPage() {
  const [viewer, setViewer] = useState<User | null>(null);
  const [ready, setReady] = useState(!firebaseConfigured);
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [tier, setTier] = useState<string | null>(null);
  const [isTeam, setIsTeam] = useState(false);
  // Edit display name
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState("");

  useEffect(() => {
    if (!firebaseConfigured) return;
    const auth = getFirebaseAuth();
    if (!auth) { setReady(true); return; }
    getRedirectResult(auth).catch(() => {});
    const unsub = onAuthStateChanged(auth, async (u) => {
      setViewer(u); setReady(true);
      if (u) await refreshTier();
      else { setTier(null); setIsTeam(false); }
    });
    return () => unsub();
  }, []);

  // Re-read the member's effective tier (after a YouTube link, upgrade, etc.).
  async function refreshTier() {
    try {
      const t = await getIdToken();
      const r = await fetch("/api/membership/me", { headers: t ? { Authorization: `Bearer ${t}` } : {}, cache: "no-store" });
      const d = await r.json();
      setTier(d.effective || null); setIsTeam(!!d.isTeam);
    } catch { /* ignore */ }
  }

  const TIER_LABEL: Record<string, string> = { coordinator: "The Coordinator", timmy: "Po’ Lil Timmy" };

  async function google() {
    const auth = getFirebaseAuth();
    if (!auth) return;
    setErr("");
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e: any) {
      const code = e?.code || "";
      if (["auth/popup-blocked", "auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(code)) {
        try { await signInWithRedirect(auth, new GoogleAuthProvider()); return; } catch {}
      }
      setErr(code === "auth/operation-not-allowed" ? "Google sign-in isn’t enabled in Firebase yet." : "Google sign-in failed. Try email.");
    }
  }

  async function emailAuth(e: React.FormEvent) {
    e.preventDefault();
    const auth = getFirebaseAuth();
    if (!auth) return;
    setErr(""); setBusy(true);
    try {
      if (mode === "signup") {
        if (!name.trim()) { setErr("Pick a display name."); return; }
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), pw);
        await updateProfile(cred.user, { displayName: name.trim() });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), pw);
      }
      setEmail(""); setPw(""); setName("");
    } catch {
      setErr(mode === "signup" ? "Could not create the account (email may be in use, or password too short)." : "Sign in failed. Check your email and password.");
    } finally { setBusy(false); }
  }

  function startEdit() {
    setNewName(viewer?.displayName || "");
    setNameMsg("");
    setEditing(true);
  }
  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) return;
    const trimmed = newName.trim();
    if (!trimmed) { setNameMsg("Enter a name."); return; }
    if (trimmed.length > 40) { setNameMsg("Keep it under 40 characters."); return; }
    setSavingName(true); setNameMsg("");
    try {
      await updateProfile(auth.currentUser, { displayName: trimmed });
      await auth.currentUser.reload();
      setViewer(auth.currentUser);
      setEditing(false);
    } catch {
      setNameMsg("Could not update your name. Try again.");
    } finally { setSavingName(false); }
  }

  const displayName = viewer?.displayName || viewer?.email?.split("@")[0] || "member";

  return (
    <div className="wide" style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 560 }}>
      {!firebaseConfigured ? (
        <div className="card center">
          <h2 style={{ marginBottom: 8 }}>Accounts are almost ready</h2>
          <p style={{ color: "var(--sub)" }}>Connect Firebase to turn on member sign-up.</p>
        </div>
      ) : !ready ? (
        <p style={{ color: "var(--sub)" }}>Loading…</p>
      ) : viewer ? (
        // ---- Signed in ----
        <div className="card">
          <span className={`badge ${tier === "coordinator" ? "coord" : "timmy"}`} style={{ marginBottom: 14 }}>
            {isTeam ? "Team" : tier ? TIER_LABEL[tier] || "Member" : "Free member"}
          </span>
          {editing ? (
            <form onSubmit={saveName} style={{ margin: "4px 0 20px" }}>
              <label style={{ display: "block", color: "var(--sub)", fontSize: 13, marginBottom: 8 }}>Display name — this is what people see on your posts and in chat.</label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input className="acc-in" style={{ flex: "1 1 220px", minWidth: 200 }} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Your name" maxLength={40} autoFocus />
                <button className="pill" type="submit" disabled={savingName}>{savingName ? "Saving…" : "Save name"}</button>
                <button className="pill soft" type="button" onClick={() => setEditing(false)}>Cancel</button>
              </div>
              {nameMsg && <p style={{ color: "var(--live)", fontSize: 13, marginTop: 10 }}>{nameMsg}</p>}
            </form>
          ) : (
            <>
              <h2 style={{ marginBottom: 6 }}>You’re in, {displayName}.</h2>
              <p style={{ color: "var(--sub)", marginBottom: 20 }}>
                Signed in as {viewer.email}.{" "}
                {isTeam
                  ? "You’re on the team — every room, including the Film Room, is open to you."
                  : tier === "coordinator"
                    ? "The Coordinator is active — the Film Room and every members’ room are unlocked."
                    : tier
                      ? "Your membership is active. The Film Room unlocks with The Coordinator."
                      : "Your free account works across the site, the community and the live chat."}
              </p>
            </>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {tier !== "coordinator" && !isTeam && <Link className="pill" href="/membership">Upgrade membership</Link>}
            {!editing && <button className="pill soft" onClick={startEdit}>Edit name</button>}
            <Link className="pill soft" href="/community">Go to the community</Link>
            <Link className="pill soft" href="/live">Go to live</Link>
            <button className="pill soft" onClick={() => { const a = getFirebaseAuth(); if (a) signOut(a); }}>Sign out</button>
          </div>
          {!tier && !isTeam && (
            <p style={{ color: "var(--sub)", fontSize: 13, marginTop: 18 }}>
              Paid tiers (Po’ Lil Timmy · The Coordinator) unlock members’ rooms like the Film Room. Stripe checkout turns on in the membership phase.
            </p>
          )}
          {!isTeam && tier !== "coordinator" && <YouTubeMemberLink onLinked={refreshTier} />}
        </div>
      ) : (
        // ---- Signed out: create account / sign in ----
        <div className="card">
          <h2 style={{ marginBottom: 6 }}>{mode === "signup" ? "Create your free account" : "Welcome back"}</h2>
          <p style={{ color: "var(--sub)", marginBottom: 20 }}>
            One login covers the site, the community, the live chat and the apps. Free — no card needed.
          </p>

          <button className="pill soft" onClick={google} style={{ width: "100%", justifyContent: "center", gap: 10, marginBottom: 14 }}>
            <GoogleIcon />
            Continue with Google
          </button>
          <div style={{ textAlign: "center", color: "var(--dim)", fontSize: 12, marginBottom: 14 }}>or use email</div>

          <form onSubmit={emailAuth} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {mode === "signup" && (
              <input className="acc-in" placeholder="Display name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
            )}
            <input className="acc-in" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <input className="acc-in" type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
            <button className="pill" type="submit" disabled={busy} style={{ justifyContent: "center" }}>
              {busy ? "…" : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>

          {err && <p style={{ color: "var(--live)", fontSize: 13, marginTop: 10 }}>{err}</p>}

          <button
            onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setErr(""); }}
            style={{ marginTop: 16, color: "var(--sub)", fontSize: 13, textDecoration: "underline" }}
          >
            {mode === "signup" ? "Already have an account? Sign in" : "New here? Create a free account"}
          </button>
        </div>
      )}
    </div>
  );
}
