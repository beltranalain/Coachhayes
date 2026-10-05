"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { BRAND } from "@/lib/siteData";
import GoogleIcon from "@/components/hayes/GoogleIcon";
import { firebaseConfigured, getFirebaseAuth } from "@/lib/firebase";
import { isEnvOwner } from "@/lib/admin";
import { signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, GoogleAuthProvider, signOut } from "firebase/auth";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [logo, setLogo] = useState("");

  // Show the site's uploaded logo on the sign-in card (falls back to the chip).
  useEffect(() => {
    fetch("/api/site-config", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d?.branding?.logo) setLogo(d.branding.logo); })
      .catch(() => {});
  }, []);

  // Honor a ?next=/path so gated areas (e.g. /manage) return here after sign-in.
  const nextUrl = () => {
    try {
      const p = new URLSearchParams(window.location.search).get("next");
      return p && p.startsWith("/") ? p : "/admin/go-live";
    } catch {
      return "/admin/go-live";
    }
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Demo mode: no Firebase yet, just enter the dashboard.
    if (!firebaseConfigured) {
      router.push(nextUrl());
      return;
    }

    setBusy(true);
    try {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error("Auth unavailable.");
      const cred = await signInWithEmailAndPassword(auth, email, password);
      // Env owners are admitted immediately. Everyone else is checked against
      // the team via the server (whoami re-verifies the token + role).
      let allowed = isEnvOwner(cred.user.email);
      if (!allowed) {
        try {
          const token = await cred.user.getIdToken();
          const res = await fetch("/api/admin/whoami", {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });
          allowed = res.ok;
        } catch {
          allowed = false;
        }
      }
      if (!allowed) {
        await signOut(auth);
        setError("This account isn't an admin.");
        return;
      }
      router.push(nextUrl());
    } catch {
      setError("Sign in failed. Check the email and password.");
    } finally {
      setBusy(false);
    }
  }

  // Google sign-in: admit env-owners immediately, otherwise verify the team via
  // the server (whoami). Non-admins are signed back out.
  async function google() {
    setError("");
    const auth = getFirebaseAuth();
    if (!auth) { setError("Auth unavailable."); return; }
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      let cred;
      try {
        cred = await signInWithPopup(auth, provider);
      } catch (e: any) {
        const code = e?.code || "";
        if (["auth/popup-blocked", "auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/operation-not-supported-in-this-environment"].includes(code)) {
          await signInWithRedirect(auth, provider);
          return;
        }
        throw e;
      }
      let allowed = isEnvOwner(cred.user.email);
      if (!allowed) {
        try {
          const token = await cred.user.getIdToken();
          const res = await fetch("/api/admin/whoami", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
          allowed = res.ok;
        } catch { allowed = false; }
      }
      if (!allowed) {
        await signOut(auth);
        setError("This Google account isn't an admin.");
        return;
      }
      router.push(nextUrl());
    } catch (e: any) {
      const code = e?.code || "";
      setError(code === "auth/operation-not-allowed" ? "Enable Google sign-in in Firebase (Authentication → Sign-in method)." : "Google sign-in failed. Try email instead.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="signin-wrap">
      <div className="signin-card">
        <div className="brand">
          {logo ? (
            <img src={logo} alt="" className="brand-mark" style={{ objectFit: "contain", background: "transparent", padding: 0 }} />
          ) : (
            <span className="brand-mark">CH</span>
          )}
          <span className="brand-name">{BRAND.name}<span>Studio Admin</span></span>
        </div>
        <h2>Studio sign in</h2>
        <p className="st">Private dashboard for the creator. Not part of the public site.</p>
        {firebaseConfigured && (
          <>
            <button type="button" className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", gap: 10 }} onClick={google} disabled={busy}>
              <GoogleIcon />
              Continue with Google
            </button>
            <div style={{ textAlign: "center", color: "var(--mute)", fontSize: 12, margin: "12px 0" }}>or use email</div>
          </>
        )}
        <form onSubmit={onSubmit}>
          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="you@yourstudio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" type="submit" style={{ width: "100%" }} disabled={busy}>
            {busy ? "Signing in..." : "Sign in to Studio"}
          </button>
          {error && <p className="form-error">{error}</p>}
          <p className="form-note">
            {firebaseConfigured
              ? "Protected by Firebase Authentication."
              : "Demo mode - connect Firebase to enable real sign-in. Press the button to enter."}
          </p>
        </form>
      </div>
    </div>
  );
}
