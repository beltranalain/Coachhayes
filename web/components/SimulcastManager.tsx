"use client";

import { useEffect, useState } from "react";
import { getIdToken } from "@/lib/firebase";

type Dest = { id: string; platform: string; url: string; enabled: boolean; hasKey: boolean };
type Health = { id: string; target: string; alive: boolean; restarts: number; lastError?: string };

const PRESETS: Record<string, string> = {
  YouTube: "rtmp://a.rtmp.youtube.com/live2",
  Facebook: "rtmps://live-api-s.facebook.com:443/rtmp/",
  Twitch: "rtmp://live.twitch.tv/app/",
  Custom: "",
};

export default function SimulcastManager() {
  const [relayConfigured, setRelayConfigured] = useState<boolean | null>(null);
  const [dests, setDests] = useState<Dest[]>([]);
  const [platform, setPlatform] = useState<keyof typeof PRESETS>("YouTube");
  const [customUrl, setCustomUrl] = useState("");
  const [streamKey, setStreamKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [health, setHealth] = useState<Record<string, Health>>({});
  const [relayLive, setRelayLive] = useState(false);

  async function load() {
    try {
      const token = await getIdToken();
      const res = await fetch("/api/simulcast/destinations", { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" });
      const d = await res.json();
      setRelayConfigured(Boolean(d.relayConfigured));
      setDests(d.destinations || []);
    } catch { setRelayConfigured(false); }
  }

  async function pollStatus() {
    try {
      const token = await getIdToken();
      const res = await fetch("/api/simulcast/status", { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" });
      const d = await res.json();
      setRelayLive(Boolean(d.live));
      const map: Record<string, Health> = {};
      for (const h of d.destinations || []) map[h.id] = h;
      setHealth(map);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    load();
    pollStatus();
    const t = setInterval(pollStatus, 8000);
    return () => clearInterval(t);
  }, []);

  async function add() {
    const url = platform === "Custom" ? customUrl.trim() : PRESETS[platform];
    if (!url || !streamKey.trim()) { setMsg("Enter the stream key."); return; }
    setBusy(true); setMsg("");
    try {
      const token = await getIdToken();
      const res = await fetch("/api/simulcast/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ platform, url, key: streamKey.trim() }),
      });
      const d = await res.json();
      if (d.ok) { setMsg(`${platform} added.`); setStreamKey(""); setCustomUrl(""); setDests(d.destinations || []); }
      else setMsg(d.error || "Could not add destination.");
    } catch { setMsg("Request failed."); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    const token = await getIdToken();
    const res = await fetch(`/api/simulcast/destinations?id=${id}`, { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const d = await res.json();
    setDests(d.destinations || []);
  }

  async function toggle(id: string, enabled: boolean) {
    const token = await getIdToken();
    const res = await fetch("/api/simulcast/destinations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ id, enabled }),
    });
    const d = await res.json();
    setDests(d.destinations || []);
  }

  function statusFor(d: Dest) {
    if (!d.enabled) return { text: "paused", cls: "" };
    const h = health[d.id];
    if (relayLive && h) return h.alive ? { text: "streaming", cls: "published" } : { text: "connecting...", cls: "" };
    return { text: "ready", cls: "" };
  }

  // Platform-specific reminder for the "chat in" side (set in Settings).
  function chatNote() {
    if (platform === "YouTube")
      return <>To also merge <strong>YouTube chat</strong> into your show, add your <strong>Channel ID</strong> in <a href="/manage/settings">Settings &rarr; YouTube channel</a>. (The stream key sends video out; the Channel ID reads chat back in - they&apos;re different.) The broadcast must be <strong>Public</strong> (auto) or <strong>Unlisted</strong> (paste its link in the Chat tab) - not Private.</>;
    if (platform === "Twitch")
      return <>To also merge <strong>Twitch chat</strong>, add your <strong>Twitch username</strong> in <a href="/manage/settings">Settings &rarr; Merged live chat</a>.</>;
    if (platform === "Facebook")
      return <>Facebook video will simulcast with this key. Merged <strong>Facebook chat</strong> is coming soon.</>;
    return null;
  }

  return (
    <div className="panel">
      <h3>Simulcast destinations</h3>
      <div className="panel-sub">Send your broadcast out to YouTube, Facebook, or Twitch at the same time. Just click Go Live in the studio - no other software needed.</div>

      {/* Two-part setup: the stream key (here) pushes video out; the channel ID /
          Twitch username (Settings) pulls chat in. Clients kept confusing these. */}
      <div className="notice" style={{ marginTop: 6 }}>
        <strong>Two things to set up per platform:</strong>
        <div style={{ marginTop: 6, fontSize: "13px", lineHeight: 1.5 }}>
          1. <strong>Video out</strong> - paste each platform&apos;s <strong>stream key</strong> below.<br />
          2. <strong>Chat in</strong> (optional) - to merge that platform&apos;s chat into your show, set your <strong>YouTube Channel ID</strong> and <strong>Twitch username</strong> in <a href="/manage/settings">Settings</a>. The stream key alone can&apos;t read chat.
        </div>
      </div>

      <div className="dest-row">
        <div><div className="dest-name">Own platform</div><div className="dest-meta">Your Live page player</div></div>
        <span className="pill published">Always on</span>
      </div>
      {dests.map((d) => {
        const s = statusFor(d);
        const h = health[d.id];
        return (
          <div className="dest-row" key={d.id}>
            <div>
              <div className="dest-name">{d.platform}</div>
              <div className="dest-meta">
                <span className={s.cls ? "pill published" : ""} style={s.cls ? { marginRight: 8 } : undefined}>{s.text}</span>
                {!d.hasKey && <span className="form-error" style={{ fontSize: "12px" }}>no key</span>}
                {h && !h.alive && d.enabled && relayLive && h.lastError && <span className="muted" style={{ fontSize: "12px" }}> - {h.lastError.slice(0, 60)}</span>}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <label className="toggle"><input type="checkbox" checked={d.enabled} onChange={(e) => toggle(d.id, e.target.checked)} /><span className="track" /></label>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => remove(d.id)}>Remove</button>
            </div>
          </div>
        );
      })}

      {relayConfigured === false && (
        <div className="notice" style={{ marginTop: 14 }}>
          <strong>Simulcast not switched on yet.</strong> Your destinations are saved and will start forwarding as soon as the simulcast relay is connected. (One-time setup - see the Help page.)
        </div>
      )}

      <div style={{ marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
        <div className="panel-sub">Add a destination</div>
        <div className="panel-split">
          <div className="form-field">
            <label>Platform</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value as keyof typeof PRESETS)}>
              {Object.keys(PRESETS).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {platform === "Custom" && (
            <div className="form-field"><label>RTMP URL</label><input type="text" value={customUrl} placeholder="rtmp://..." onChange={(e) => setCustomUrl(e.target.value)} /></div>
          )}
        </div>
        <div className="form-field">
          <label>{platform} stream key</label>
          <input type="password" value={streamKey} placeholder="Paste the stream key" onChange={(e) => setStreamKey(e.target.value)} />
          <p className="form-note">YouTube: Studio -&gt; Create -&gt; Go Live -&gt; copy the <strong>Stream key</strong> (not the URL). Set the broadcast to <strong>Public</strong> (recommended - its chat merges in automatically) or <strong>Unlisted</strong> (then paste the live link in the <strong>Chat</strong> tab so its chat pulls in). <strong>Private streams can&apos;t merge chat.</strong> Turn <strong>Dual stream OFF</strong>.</p>
          {chatNote() && <p className="form-note" style={{ marginTop: 6 }}>{chatNote()}</p>}
        </div>
        <button className="btn btn-primary btn-sm" type="button" onClick={add} disabled={busy}>{busy ? "Adding..." : "Add destination"}</button>
        {msg && <p className={msg.includes("added") ? "form-ok" : "form-error"} style={{ marginTop: 10 }}>{msg}</p>}
      </div>
    </div>
  );
}
