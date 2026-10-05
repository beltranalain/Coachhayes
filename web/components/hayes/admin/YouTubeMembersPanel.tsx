"use client";

import { useCallback, useEffect, useState } from "react";
import { getIdToken } from "@/lib/firebase";

// Admin panel: connect the channel owner's YouTube, sync the member list, and
// map each YouTube membership level to a platform tier. Members then self-link
// on their account page. No billing data is read or stored.
const TIER_OPTS = [{ v: "coordinator", l: "The Coordinator" }, { v: "timmy", l: "Po’ Lil Timmy" }];

type Status = {
  configured: boolean; connected: boolean; connectedChannelTitle: string;
  memberCount: number; levels: Array<{ id: string; name: string }>;
  levelCounts: Record<string, number>; mapping: Record<string, string>;
  defaultTier: string; lastSyncAt: number;
};

export default function YouTubeMembersPanel() {
  const [st, setSt] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [defaultTier, setDefaultTier] = useState("coordinator");

  const authH = async (): Promise<Record<string, string>> => { const t = await getIdToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/youtube", { headers: await authH(), cache: "no-store" });
      const d = await r.json();
      setSt(d); setMapping(d.mapping || {}); setDefaultTier(d.defaultTier || "coordinator");
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    // Surface the result of the owner OAuth round-trip (?yt=...).
    const p = new URLSearchParams(window.location.search);
    const yt = p.get("yt");
    if (yt === "connected") setMsg({ ok: true, text: "YouTube connected. Click “Sync members” to pull your list." });
    else if (yt === "norefresh") setMsg({ ok: false, text: "Connected, but Google didn’t return a refresh token. Click Connect again and approve access." });
    else if (yt === "error") setMsg({ ok: false, text: "The YouTube connection didn’t complete. Please try again." });
    if (yt) window.history.replaceState({}, "", window.location.pathname);
  }, [load]);

  async function connect() {
    setBusy("connect"); setMsg(null);
    try {
      const r = await fetch("/api/admin/youtube/connect", { method: "POST", headers: await authH() });
      const d = await r.json();
      if (d.url) { window.location.href = d.url; return; }
      setMsg({ ok: false, text: d.error || "Couldn’t start the connection." });
    } catch { setMsg({ ok: false, text: "Couldn’t start the connection." }); } finally { setBusy(""); }
  }

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action); setMsg(null);
    try {
      const r = await fetch("/api/admin/youtube", { method: "POST", headers: { "Content-Type": "application/json", ...(await authH()) }, body: JSON.stringify({ action, ...extra }) });
      const d = await r.json();
      if (r.ok && d.ok) {
        if (action === "sync") setMsg({ ok: true, text: `Synced ${d.memberCount} member${d.memberCount === 1 ? "" : "s"}.` });
        if (action === "mapping") setMsg({ ok: true, text: "Saved." });
        if (action === "disconnect") setMsg({ ok: true, text: "Disconnected." });
        await load();
      } else setMsg({ ok: false, text: d.error || "Something went wrong." });
    } catch { setMsg({ ok: false, text: "Something went wrong." }); } finally { setBusy(""); }
  }

  return (
    <div className="card">
      <h3>YouTube memberships</h3>
      <p className="cs">Give your paying YouTube members the same access here — automatically. They connect their YouTube account once and their tier unlocks. This never touches YouTube billing; it only reads who is a current member.</p>

      {loading ? (
        <div className="note" style={{ margin: "10px 0 0" }}>Loading…</div>
      ) : !st?.configured ? (
        <div className="note" style={{ margin: "10px 0 0", borderLeftColor: "var(--amber)" }}>
          To turn this on, add your YouTube connection keys in the project settings — <b>YOUTUBE_OAUTH_CLIENT_ID</b> and <b>YOUTUBE_OAUTH_CLIENT_SECRET</b> — then reload this page. (These come from a Google sign-in setup, not the regular YouTube key.)
        </div>
      ) : !st.connected ? (
        <div style={{ marginTop: 12 }}>
          <button className="pill" onClick={connect} disabled={busy === "connect"}>{busy === "connect" ? "…" : "Connect YouTube"}</button>
          <p className="cs" style={{ marginTop: 10 }}>You’ll sign in once as the channel owner and allow read access to your members list.</p>
        </div>
      ) : (
        <>
          <div className="note" style={{ margin: "12px 0", borderLeftColor: "var(--green)" }}>
            <b>Connected{st.connectedChannelTitle ? ` as ${st.connectedChannelTitle}` : ""}.</b>{" "}
            {st.memberCount ? `${st.memberCount} member${st.memberCount === 1 ? "" : "s"}` : "Not synced yet"}
            {st.lastSyncAt ? ` · last synced ${new Date(st.lastSyncAt).toLocaleString()}` : ""}.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <button className="pill" onClick={() => act("sync")} disabled={busy === "sync"}>{busy === "sync" ? "Syncing…" : "Sync members"}</button>
            <button className="pill soft" onClick={() => act("disconnect")} disabled={busy === "disconnect"}>Disconnect</button>
          </div>

          <div style={{ borderTop: "1px solid var(--hair)", paddingTop: 14 }}>
            <b style={{ fontSize: 14 }}>Which access does each YouTube level unlock?</b>
            {(st.levels || []).length === 0 ? (
              <p className="cs" style={{ marginTop: 6 }}>Click “Sync members” first to load your YouTube membership levels.</p>
            ) : (
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {st.levels.map((lv) => (
                  <div key={lv.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ flex: "1 1 200px" }}>{lv.name} <span className="muted">({st.levelCounts?.[lv.id] || 0})</span></span>
                    <select className="acc-in" style={{ width: 180 }} value={mapping[lv.id] || defaultTier} onChange={(e) => setMapping((m) => ({ ...m, [lv.id]: e.target.value }))}>
                      {TIER_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
                  <span style={{ flex: "1 1 200px" }}>Any other member defaults to</span>
                  <select className="acc-in" style={{ width: 180 }} value={defaultTier} onChange={(e) => setDefaultTier(e.target.value)}>
                    {TIER_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
                <button className="pill" style={{ alignSelf: "flex-start", marginTop: 4 }} onClick={() => act("mapping", { mapping, defaultTier })} disabled={busy === "mapping"}>{busy === "mapping" ? "Saving…" : "Save mapping"}</button>
              </div>
            )}
          </div>
        </>
      )}
      {msg && <p style={{ color: msg.ok ? "var(--green)" : "var(--live)", fontSize: 13, marginTop: 12 }}>{msg.text}</p>}
    </div>
  );
}
