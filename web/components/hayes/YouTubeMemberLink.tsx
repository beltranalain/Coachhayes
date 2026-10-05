"use client";

import { useEffect, useRef, useState } from "react";
import { getIdToken } from "@/lib/firebase";

// Member-side: connect your YouTube membership to unlock the matching tier here.
// Uses Google Identity Services to get a YouTube read-only token WITHOUT touching
// the member's platform sign-in (works whether they joined with Google or email).
const CLIENT_ID = process.env.NEXT_PUBLIC_YOUTUBE_OAUTH_CLIENT_ID || "";
const SCOPE = "https://www.googleapis.com/auth/youtube.readonly";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { google?: any }
}

export default function YouTubeMemberLink({ onLinked }: { onLinked?: () => void }) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientRef = useRef<any>(null);

  useEffect(() => {
    if (!CLIENT_ID) return;
    const init = () => {
      if (window.google?.accounts?.oauth2 && !clientRef.current) {
        clientRef.current = window.google.accounts.oauth2.initTokenClient({ client_id: CLIENT_ID, scope: SCOPE, callback: onToken });
        setReady(true);
      }
    };
    const existing = document.getElementById("gis-client") as HTMLScriptElement | null;
    if (existing) {
      if (window.google?.accounts?.oauth2) init(); else existing.addEventListener("load", init);
    } else {
      const s = document.createElement("script");
      s.id = "gis-client"; s.src = "https://accounts.google.com/gsi/client"; s.async = true; s.defer = true;
      s.onload = init; document.body.appendChild(s);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function onToken(resp: any) {
    if (!resp?.access_token) { setBusy(false); setMsg({ ok: false, text: "YouTube access was cancelled." }); return; }
    try {
      const t = await getIdToken();
      const r = await fetch("/api/youtube/link", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
        body: JSON.stringify({ accessToken: resp.access_token }),
      });
      const d = await r.json();
      if (r.ok && d.member) { setMsg({ ok: true, text: "Membership found — your access is unlocked." }); onLinked?.(); }
      else if (r.ok && d.member === false) setMsg({ ok: false, text: d.message || "No active membership found on that YouTube account." });
      else setMsg({ ok: false, text: d.error || "Couldn’t verify your membership." });
    } catch { setMsg({ ok: false, text: "Couldn’t verify your membership." }); } finally { setBusy(false); }
  }

  function connect() {
    if (!clientRef.current) return;
    setBusy(true); setMsg(null);
    clientRef.current.requestAccessToken();
  }

  if (!CLIENT_ID) return null; // integration not set up -> hide entirely

  return (
    <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--hair)" }}>
      <b>Support us on YouTube?</b>
      <p style={{ color: "var(--sub)", fontSize: 13, margin: "4px 0 10px" }}>
        If you’re a paid member on our YouTube channel, connect it to unlock the same access here — free. We only check your membership; we never see any payment info.
      </p>
      <button className="pill soft" onClick={connect} disabled={!ready || busy}>{busy ? "Checking…" : "Connect my YouTube membership"}</button>
      {msg && <p style={{ color: msg.ok ? "var(--green)" : "var(--live)", fontSize: 13, marginTop: 10 }}>{msg.text}</p>}
    </div>
  );
}
