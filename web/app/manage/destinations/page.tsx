"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/hayes/admin/Shell";
import { getIdToken } from "@/lib/firebase";

// Destinations — real simulcast targets from /api/simulcast/destinations.
// Stream keys are secret and never returned to the browser (only hasKey).
// No hardcoded/sample data: every row below is a real, stored destination.
type Destination = { id: string; platform: string; url?: string; enabled: boolean; hasKey: boolean };

export default function DestinationsAdmin() {
  const [brand, setBrand] = useState({ name: "Coach Hayes Football", logo: "" });
  const [relayConfigured, setRelayConfigured] = useState(false);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [platform, setPlatform] = useState("YouTube");
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");

  async function load() {
    try {
      const t = await getIdToken();
      const r = await fetch("/api/simulcast/destinations", { headers: t ? { Authorization: `Bearer ${t}` } : {}, cache: "no-store" });
      const d = await r.json();
      setRelayConfigured(Boolean(d.relayConfigured));
      setDestinations(Array.isArray(d.destinations) ? d.destinations : []);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => {
    fetch("/api/site-config", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (d?.branding) setBrand({ name: d.branding.siteName || "Coach Hayes Football", logo: d.branding.logo || "" }); }).catch(() => {});
    load();
  }, []);

  async function toggle(id: string, enabled: boolean) {
    setMsg("");
    try {
      const t = await getIdToken();
      const r = await fetch("/api/simulcast/destinations", { method: "PATCH", headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: JSON.stringify({ id, enabled }) });
      const d = await r.json();
      if (!r.ok || d?.ok === false) setMsg(d?.error || "Could not update that destination.");
      await load();
    } catch { setMsg("Could not update that destination."); }
  }

  async function remove(id: string) {
    setMsg("");
    try {
      const t = await getIdToken();
      const r = await fetch(`/api/simulcast/destinations?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: t ? { Authorization: `Bearer ${t}` } : {} });
      const d = await r.json();
      if (!r.ok || d?.ok === false) setMsg(d?.error || "Could not remove that destination.");
      await load();
    } catch { setMsg("Could not remove that destination."); }
  }

  async function add() {
    setMsg("");
    if (!url.trim() || !key.trim()) { setMsg("Add both an RTMP URL and a stream key."); return; }
    try {
      const t = await getIdToken();
      const r = await fetch("/api/simulcast/destinations", { method: "POST", headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: JSON.stringify({ platform, url: url.trim(), key: key.trim() }) });
      const d = await r.json();
      if (!r.ok || d?.ok === false) { setMsg(d?.error || "Could not add that destination."); return; }
      setMsg("Destination added.");
      setPlatform("YouTube"); setUrl(""); setKey("");
      await load();
    } catch { setMsg("Could not add that destination."); }
  }

  return (
    <Shell title="Destinations" sub={relayConfigured ? "Simulcast to YouTube, Facebook, and X" : "Set up the relay to fan out to other platforms"} brandName={brand.name} logo={brand.logo}>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Relay</h3>
        <p className="cs">The relay takes your single broadcast and fans it out to every enabled destination at once.</p>
        {relayConfigured ? (
          <div className="note" style={{ margin: 0 }}><span className="pill ok">Connected</span> Relay connected — ready to fan out.</div>
        ) : (
          <div className="note" style={{ margin: 0, borderLeftColor: "var(--amber)" }}><span className="pill warn">Not set</span> Relay not set. Set <code>RELAY_URL</code> + <code>RELAY_SECRET</code> on the server to simulcast to YouTube/Facebook/X.</div>
        )}
      </div>

      <div className="row2">
        <div className="stack">
          <div className="card">
            <h3>Destinations</h3>
            <p className="cs">Each enabled destination receives your stream live. Stream keys are stored encrypted and never shown.</p>
            {loading ? (
              <div className="note" style={{ margin: 0 }}>Loading…</div>
            ) : destinations.length === 0 ? (
              <div className="note" style={{ margin: 0 }}>No external destinations yet. Add YouTube, Facebook, or X below to simulcast.</div>
            ) : (
              <div className="rows">
                {destinations.map((d) => (
                  <div key={d.id} className={`r${d.enabled ? " on" : ""}`}>
                    <span className="nm">
                      <b>{d.platform}</b>
                      <span>{d.hasKey ? "Stream key set" : "No stream key"}</span>
                    </span>
                    <span className="act">
                      <button className="sw" aria-pressed={d.enabled} onClick={() => toggle(d.id, !d.enabled)} />
                      <button className="btn sm" onClick={() => remove(d.id)}>Remove</button>
                    </span>
                  </div>
                ))}
              </div>
            )}
            {msg && <div className="note" style={{ marginTop: 14 }}>{msg}</div>}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h3>Add destination</h3>
            <p className="cs">Paste the RTMP URL and stream key from the platform you want to simulcast to.</p>
            <div className="fld"><label>Platform</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
                <option>YouTube</option>
                <option>Facebook</option>
                <option>X</option>
                <option>Custom</option>
              </select>
            </div>
            <div className="fld"><label>RTMP URL</label>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="rtmp://a.rtmp.youtube.com/live2" />
            </div>
            <div className="fld"><label>Stream key</label>
              <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="xxxx-xxxx-xxxx-xxxx" />
            </div>
            <button className="btn acc" style={{ marginTop: 4 }} onClick={add}>Add destination</button>
          </div>
        </div>
      </div>
    </Shell>
  );
}
