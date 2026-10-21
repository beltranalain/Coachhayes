"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { firebaseConfigured, getFirebaseAuth, getIdToken } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";

// "Link my YouTube membership" — a signed-in viewer proves they own a YouTube
// account (Google sign-in with the youtube.readonly scope), and we check it
// against the channel owner's member list, granting the matching site tier. No
// billing is touched. Works once the channel owner has connected YouTube in the
// admin (otherwise the server returns a friendly "not connected yet" message).
export default function LinkYouTube({ label }: { label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);

  async function link() {
    setMsg(""); setOk(false);
    const auth = firebaseConfigured ? getFirebaseAuth() : null;
    if (!auth) { setMsg("Sign-in isn't available right now."); return; }
    if (!auth.currentUser) { router.push("/account?next=/membership"); return; }

    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope("https://www.googleapis.com/auth/youtube.readonly");
      const result = await signInWithPopup(auth, provider);
      const accessToken = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
      if (!accessToken) { setMsg("Couldn't get YouTube access — please try again."); return; }

      const idToken = await getIdToken();
      const r = await fetch("/api/youtube/link", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
        body: JSON.stringify({ accessToken }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.member) { setOk(true); setMsg(`Linked! Your ${d.tier || "membership"} is now active on the site.`); router.refresh(); }
      else if (r.ok && d.member === false) setMsg(d.message || "We couldn't find an active membership on that YouTube account.");
      else setMsg(d.error || "Couldn't link right now. Please try again.");
    } catch (e: any) {
      const code = e?.code || "";
      setMsg(code.includes("popup-closed") || code.includes("cancelled") ? "Linking was cancelled." : "YouTube linking failed. Please try again.");
    } finally { setBusy(false); }
  }

  return (
    <div>
      <button type="button" className="pill sm soft" onClick={link} disabled={busy}>
        {busy ? "Linking…" : label}
      </button>
      {msg && <p style={{ fontSize: 13, marginTop: 10, color: ok ? "var(--green)" : "var(--sub)" }}>{msg}</p>}
    </div>
  );
}
