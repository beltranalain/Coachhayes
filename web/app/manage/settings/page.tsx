"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/hayes/admin/Shell";
import { getIdToken } from "@/lib/firebase";

// Admin Settings — wired Branding editor. Loads + saves the real branding doc
// via /api/site-config (section:"branding"). The whole public site + admin
// sidebar read these values (site name, tagline, accent, host, tips toggle).
type Branding = {
  siteName: string; tagline: string; domain: string; accent: string; background: string; live: string;
  hostName: string; channelBug: string; showChannelBug: boolean; tipsEnabled: boolean;
  youtubeChannelId: string; logo: string;
};
const BLANK: Branding = { siteName: "", tagline: "", domain: "", accent: "#0B6BFF", background: "#0A0908", live: "#E8402A", hostName: "", channelBug: "", showChannelBug: false, tipsEnabled: true, youtubeChannelId: "", logo: "" };

export default function SettingsAdmin() {
  const [b, setB] = useState<Branding>(BLANK);
  const [logoName, setLogoName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const tok = async (): Promise<Record<string, string>> => { const t = await getIdToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };
  const set = (patch: Partial<Branding>) => setB((s) => ({ ...s, ...patch }));

  useEffect(() => {
    fetch("/api/site-config", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      if (d?.branding) setB({ ...BLANK, ...d.branding });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function onLogo(file: File) {
    if (file.size > 700_000) { setMsg("Logo is too large — use an image under ~700KB."); return; }
    const reader = new FileReader();
    reader.onload = () => { set({ logo: String(reader.result) }); setLogoName(file.name); };
    reader.readAsDataURL(file);
  }

  async function save() {
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/site-config", { method: "POST", headers: { "Content-Type": "application/json", ...(await tok()) }, body: JSON.stringify({ section: "branding", data: b }) });
      const d = await res.json();
      if (d.saved) setMsg("Branding saved — it's live across the site.");
      else if (d.demo) setMsg("Demo mode — connect Firebase to save.");
      else setMsg(d.error || "Save failed.");
    } catch { setMsg("Save failed."); } finally { setBusy(false); }
  }

  return (
    <Shell title="Settings" sub="Branding, connections and ownership" brandName={b.siteName || "Coach Hayes Football"} logo={b.logo}>
      {msg && <div className="note" style={{ marginBottom: 14 }}>{msg}</div>}
      <div className="row2">
        <div className="stack">
          <div className="card">
            <h3>Branding</h3>
            <p className="cs">Applied to the site, the apps and the on-air graphics. Saves instantly to the live site.</p>
            {loading ? <div className="note" style={{ margin: 0 }}>Loading…</div> : (
              <>
                <div className="fld"><label>Site name</label><input value={b.siteName} onChange={(e) => set({ siteName: e.target.value })} /></div>
                <div className="fld"><label>Tagline</label><input value={b.tagline} onChange={(e) => set({ tagline: e.target.value })} /></div>
                <div className="fld"><label>Domain</label><input value={b.domain} onChange={(e) => set({ domain: e.target.value })} placeholder="coachhayesfootball.com" /></div>
                <div className="fld"><label>Host name</label><input value={b.hostName} onChange={(e) => set({ hostName: e.target.value })} placeholder="Coach Hayes" /></div>
                <div className="row3e" style={{ margin: 0, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div className="fld"><label>Accent</label><input type="color" value={b.accent} onChange={(e) => set({ accent: e.target.value })} style={{ height: 40, padding: 4 }} /></div>
                  <div className="fld"><label>Background</label><input type="color" value={b.background} onChange={(e) => set({ background: e.target.value })} style={{ height: 40, padding: 4 }} /></div>
                  <div className="fld"><label>Live color</label><input type="color" value={b.live} onChange={(e) => set({ live: e.target.value })} style={{ height: 40, padding: 4 }} /></div>
                </div>
                <div className="fld"><label>Logo</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {b.logo ? <img src={b.logo} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "contain", background: "var(--soft)" }} /> : null}
                    <label className="btn sm" style={{ cursor: "pointer" }}>
                      {b.logo ? "Replace" : "Upload logo"}
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onLogo(f); }} />
                    </label>
                    {b.logo ? <button className="btn sm btn-danger" onClick={() => { set({ logo: "" }); setLogoName(""); }}>Remove</button> : null}
                    {logoName && <span className="cs">{logoName}</span>}
                  </div>
                </div>
                <div className="fld"><label>YouTube channel ID</label><input value={b.youtubeChannelId} onChange={(e) => set({ youtubeChannelId: e.target.value })} placeholder="UC…" /></div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px 0 10px", fontSize: 13 }}>
                  <input type="checkbox" checked={b.tipsEnabled} onChange={(e) => set({ tipsEnabled: e.target.checked })} style={{ width: "auto" }} /> Show tip buttons in chat
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 12px", fontSize: 13 }}>
                  <input type="checkbox" checked={b.showChannelBug} onChange={(e) => set({ showChannelBug: e.target.checked })} style={{ width: "auto" }} /> Show channel bug on the live page
                </label>
                {b.showChannelBug && <div className="fld"><label>Channel bug label</label><input value={b.channelBug} onChange={(e) => set({ channelBug: e.target.value })} placeholder="Coach Hayes Live" /></div>}
                <button className="btn acc" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save branding"}</button>
              </>
            )}
          </div>

          <div className="card">
            <h3>Ownership</h3>
            <p className="cs">What happens if you ever stop.</p>
            <div className="note" style={{ marginTop: 0 }}><b>You own all of it.</b> The domain, the database, the repository, the app listings and the audience list. Ending support stops monitoring and updates — not the platform.</div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h3>Connections</h3>
            <p className="cs">Everything runs on your own accounts. These are configured via environment keys on the server.</p>
            <div className="rows">
              <Conn name="Cloudflare Stream" meta="Live input + playback" />
              <Conn name="Simulcast relay" meta="MediaMTX — set RELAY_URL to enable" />
              <Conn name="YouTube" meta={b.youtubeChannelId ? `Channel ${b.youtubeChannelId}` : "Set the channel ID above"} />
              <Conn name="Stripe" meta="Your account · merchant of record" />
              <Conn name="Anthropic (AI scout)" meta="Set ANTHROPIC_API_KEY to enable" />
            </div>
            <p className="cs" style={{ marginTop: 12 }}>Connection status is managed with server environment keys — ask your developer to set or rotate them.</p>
          </div>

          <div className="card">
            <h3>Preview</h3>
            <p className="cs">How your brand reads right now.</p>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0" }}>
              <span style={{ width: 44, height: 44, borderRadius: 10, background: b.logo ? `center/contain no-repeat url(${b.logo})` : b.accent, display: "inline-block" }} />
              <div>
                <b style={{ display: "block", fontSize: 16 }}>{b.siteName || "Coach Hayes Football"}</b>
                <span className="cs">{b.tagline || "From a coach’s perspective"}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span className="pill" style={{ background: `color-mix(in srgb, ${b.accent} 18%, transparent)`, color: b.accent }}>Accent</span>
              <span className="pill" style={{ background: `color-mix(in srgb, ${b.live} 18%, transparent)`, color: b.live }}>Live</span>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Conn({ name, meta }: { name: string; meta: string }) {
  return (
    <div className="r">
      <span className="nm"><b>{name}</b><span>{meta}</span></span>
    </div>
  );
}
