"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import GoogleIcon from "@/components/hayes/GoogleIcon";
import { firebaseConfigured, getFirebaseAuth } from "@/lib/firebase";
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

  useEffect(() => {
    if (!firebaseConfigured) return;
    const auth = getFirebaseAuth();
    if (!auth) { setReady(true); return; }
    getRedirectResult(auth).catch(() => {});
    const unsub = onAuthStateChanged(auth, (u) => { setViewer(u); setReady(true); });
    return () => unsub();
  }, []);

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
          <span className="badge timmy" style={{ marginBottom: 14 }}>Free member</span>
          <h2 style={{ marginBottom: 6 }}>You’re in, {displayName}.</h2>
          <p style={{ color: "var(--sub)", marginBottom: 20 }}>
            Signed in as {viewer.email}. Your free account works across the site, the community and the live chat.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="pill" href="/membership">Upgrade membership</Link>
            <Link className="pill soft" href="/live">Go to live</Link>
            <button className="pill soft" onClick={() => { const a = getFirebaseAuth(); if (a) signOut(a); }}>Sign out</button>
          </div>
          <p style={{ color: "var(--sub)", fontSize: 13, marginTop: 18 }}>
            Paid tiers (Po’ Lil Timmy · The Coordinator) turn on with checkout in the membership phase.
          </p>
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
