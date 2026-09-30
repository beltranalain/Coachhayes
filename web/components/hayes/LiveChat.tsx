"use client";

import { useEffect, useRef, useState } from "react";
import TipModal from "@/components/TipModal";
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

// Hayes-skinned live chat. Reuses the same backend as the legacy chat:
// the Durable Objects WebSocket (NEXT_PUBLIC_CHAT_WS_URL), Firebase auth for
// viewers, and the Stripe tip flow (/api/tips/checkout + TipModal). Rendered
// with the template's .lchat markup so it matches the approved design.
type ChatMessage = {
  id: string;
  name: string;
  text: string;
  ts: number;
  tip?: number;
  source?: "site" | "youtube" | "twitch" | "facebook";
};

const WS_BASE = process.env.NEXT_PUBLIC_CHAT_WS_URL || "";
const ROOM = "live";
const TIP_PRESETS = [2, 5, 10, 20];

function PlatformMark({ source }: { source?: string }) {
  if (source === "youtube")
    return (
      <span className="pmark yt" aria-label="YouTube">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.5 15.6V8.4l6.3 3.6-6.3 3.6z" /></svg>
      </span>
    );
  if (source === "facebook")
    return (
      <span className="pmark fb" aria-label="Facebook">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.6 4.5-4.6 1.3 0 2.6.23 2.6.23v2.9h-1.5c-1.5 0-1.9.9-1.9 1.85V12h3.3l-.53 3.5h-2.8v8.4A12 12 0 0 0 24 12z" /></svg>
      </span>
    );
  // Site message: the brand mark chip.
  return <span className="mark xs" aria-label="This site" />;
}

function googleErr(code?: string): string {
  switch (code) {
    case "auth/operation-not-allowed":
      return "Google sign-in isn't enabled in Firebase yet (Authentication → Sign-in method).";
    case "auth/unauthorized-domain":
      return "This domain isn't authorized for Google sign-in (Firebase → Auth → Settings).";
    default:
      return `Google sign-in failed${code ? ` (${code})` : ""}. Try email instead.`;
  }
}

export default function LiveChat({ hostName = "Coach Hayes" }: { hostName?: string }) {
  const enabled = Boolean(WS_BASE);
  const requireAuth = firebaseConfigured;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState<"all" | "members" | "tips">("all");

  const [viewer, setViewer] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!requireAuth);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [dname, setDname] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [muted, setMuted] = useState<{ banned: boolean; until: number } | null>(null);

  // Tips
  const [tipping, setTipping] = useState(false);
  const [tipAmount, setTipAmount] = useState(5);
  const [tipMsg, setTipMsg] = useState("");
  const [tipBusy, setTipBusy] = useState(false);
  const [tipErr, setTipErr] = useState("");
  const [tipSecret, setTipSecret] = useState<string | null>(null);
  const [tipsOn, setTipsOn] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/site-config", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d?.branding) setTipsOn(d.branding.tipsEnabled !== false); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!requireAuth) return;
    const auth = getFirebaseAuth();
    if (!auth) { setAuthReady(true); return; }
    getRedirectResult(auth).catch((e: any) => { if (e?.code) setAuthErr(googleErr(e.code)); });
    const unsub = onAuthStateChanged(auth, (u) => { setViewer(u); setAuthReady(true); });
    return () => unsub();
  }, [requireAuth]);

  const name = requireAuth ? viewer?.displayName || viewer?.email?.split("@")[0] || "Viewer" : "Guest";
  const canSend = enabled && connected && (!requireAuth || Boolean(viewer));

  useEffect(() => {
    if (!enabled) return;
    let closedByUnmount = false;
    function connect() {
      const ws = new WebSocket(`${WS_BASE}/room/${ROOM}/ws`);
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!closedByUnmount) retryRef.current = setTimeout(connect, 2500);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (event) => {
        let data: any;
        try { data = JSON.parse(event.data); } catch { return; }
        if (data.type === "history" && Array.isArray(data.messages)) setMessages(data.messages);
        else if (data.type === "clear") setMessages([]);
        else if (data.type === "chat") setMessages((prev) => [...prev.slice(-199), data]);
        else if (data.type === "count") setCount(data.count);
        else if (data.type === "muted") setMuted({ banned: Boolean(data.banned), until: Number(data.until) || 0 });
      };
    }
    connect();
    return () => { closedByUnmount = true; if (retryRef.current) clearTimeout(retryRef.current); wsRef.current?.close(); };
  }, [enabled]);

  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [messages]);

  const isMuted = Boolean(muted && (muted.banned || muted.until > Date.now()));

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !canSend || isMuted || !wsRef.current) return;
    const uid = getFirebaseAuth()?.currentUser?.uid || "";
    wsRef.current.send(JSON.stringify({ type: "chat", name, text, uid }));
    setDraft("");
  }

  async function google() {
    const auth = getFirebaseAuth();
    if (!auth) return;
    setAuthErr("");
    const provider = new GoogleAuthProvider();
    try { await signInWithPopup(auth, provider); }
    catch (e: any) {
      const code = e?.code || "";
      if (["auth/popup-blocked", "auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(code)) {
        try { await signInWithRedirect(auth, provider); return; } catch (e2: any) { setAuthErr(googleErr(e2?.code)); return; }
      }
      setAuthErr(googleErr(code));
    }
  }

  async function emailAuth(e: React.FormEvent) {
    e.preventDefault();
    const auth = getFirebaseAuth();
    if (!auth) return;
    setAuthErr(""); setAuthBusy(true);
    try {
      if (mode === "signup") {
        if (!dname.trim()) { setAuthErr("Pick a display name."); return; }
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), pw);
        await updateProfile(cred.user, { displayName: dname.trim() });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), pw);
      }
      setEmail(""); setPw(""); setDname("");
    } catch {
      setAuthErr(mode === "signup" ? "Could not create the account (email may be in use)." : "Sign in failed. Check email and password.");
    } finally { setAuthBusy(false); }
  }

  const tipValue = Math.max(1, Math.min(500, Number(tipAmount) || 0));
  async function startTip() {
    setTipErr(""); setTipBusy(true);
    try {
      const res = await fetch("/api/tips/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: tipValue, message: tipMsg.trim(), name, uid: getFirebaseAuth()?.currentUser?.uid || "" }),
      });
      const d = await res.json();
      if (d.clientSecret) { setTipSecret(d.clientSecret); return; }
      setTipErr(d.error || "Could not start the tip.");
    } catch { setTipErr("Could not start the tip."); }
    finally { setTipBusy(false); }
  }

  const showAuth = enabled && requireAuth && authReady && !viewer;
  const shown = messages.filter((m) => (tab === "tips" ? m.tip : true));

  return (
    <aside className="lchat">
      <div className="lc-head">
        <b>Live chat</b>
        <span className="lc-src">
          {enabled ? (connected ? `${count ?? 1} here · Site + YouTube` : "Connecting…") : "Site + YouTube, merged"}
        </span>
      </div>

      <div className="lc-tabs">
        <button className={`lc-tab${tab === "all" ? " on" : ""}`} onClick={() => setTab("all")}>All</button>
        <button className={`lc-tab${tab === "members" ? " on" : ""}`} onClick={() => setTab("members")}>Members</button>
        <button className={`lc-tab${tab === "tips" ? " on" : ""}`} onClick={() => setTab("tips")}>Tips</button>
      </div>

      <div className="lc-body" ref={bodyRef}>
        {shown.length === 0 && <p style={{ color: "var(--sub)", fontSize: 13 }}>No messages yet. Say hello.</p>}
        {shown.map((m) =>
          m.tip ? (
            <div className="ltip" key={m.id}>
              <b>{m.name} sent ${m.tip.toFixed(2)}</b>
              {m.text ? <span>{m.text}</span> : null}
            </div>
          ) : (
            <div className="lmsg" key={m.id}>
              <span className="src"><PlatformMark source={m.source} /></span>
              <span className="mb">
                <b className={m.name === hostName ? "c-coach" : undefined}>{m.name}</b>
                {m.text}
              </span>
            </div>
          )
        )}
      </div>

      {showAuth ? (
        <div className="lc-foot">
          <p style={{ fontSize: 12.5, fontWeight: 600 }}>Sign in to join the chat</p>
          <button type="button" className="pill sm soft" onClick={google} style={{ width: "100%", justifyContent: "center", gap: 8 }}><GoogleIcon size={16} />Continue with Google</button>
          <form onSubmit={emailAuth} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {mode === "signup" && (
              <input className="lc-in" placeholder="Display name" value={dname} onChange={(e) => setDname(e.target.value)} maxLength={30} />
            )}
            <input className="lc-in" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <input className="lc-in" type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
            <button type="submit" className="pill sm" disabled={authBusy}>{authBusy ? "…" : mode === "signup" ? "Create account" : "Sign in"}</button>
          </form>
          <button type="button" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setAuthErr(""); }} style={{ fontSize: 12, color: "var(--sub)", textDecoration: "underline", alignSelf: "flex-start" }}>
            {mode === "signup" ? "Have an account? Sign in" : "New here? Create an account"}
          </button>
          {authErr && <p style={{ color: "var(--live)", fontSize: 12 }}>{authErr}</p>}
        </div>
      ) : (
        <div className="lc-foot">
          <form className="lc-row" onSubmit={send}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={isMuted ? (muted?.banned ? "You've been removed" : "You're on timeout") : canSend ? `Chatting as ${name}` : "Say something"}
              disabled={!canSend || isMuted}
              maxLength={500}
              aria-label="Chat message"
            />
            <button type="submit" className="pill sm" disabled={!canSend || isMuted}>Send</button>
          </form>
          {tipsOn && canSend && !isMuted && (
            tipping ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="tip-row" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {TIP_PRESETS.map((a) => (
                    <button key={a} type="button" className={`lc-tab${tipAmount === a ? " on" : ""}`} onClick={() => setTipAmount(a)}>${a}</button>
                  ))}
                  <input type="number" min={1} max={500} value={tipAmount} onChange={(e) => setTipAmount(Number(e.target.value))} className="lc-in" style={{ width: 70 }} aria-label="Custom tip" />
                </div>
                <input className="lc-in" placeholder="Add a message (optional)" value={tipMsg} onChange={(e) => setTipMsg(e.target.value)} maxLength={200} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="pill sm" onClick={startTip} disabled={tipBusy}>{tipBusy ? "…" : `Tip $${tipValue}`}</button>
                  <button type="button" className="pill sm soft" onClick={() => { setTipping(false); setTipErr(""); }}>Cancel</button>
                </div>
                {tipErr && <p style={{ color: "var(--live)", fontSize: 12 }}>{tipErr}</p>}
              </div>
            ) : (
              <button type="button" className="pill sm soft lc-tipbtn" onClick={() => setTipping(true)}>Send a tip</button>
            )
          )}
        </div>
      )}

      {tipSecret && (
        <TipModal clientSecret={tipSecret} amount={tipValue} onSuccess={() => { setTipSecret(null); setTipping(false); setTipMsg(""); }} onClose={() => setTipSecret(null)} />
      )}
    </aside>
  );
}
