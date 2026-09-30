"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/hayes/admin/Shell";
import { getIdToken } from "@/lib/firebase";

// Go Live — the mock's exact markup, WIRED to the real broadcast engine:
//   • live status + viewers   -> /api/stream/status
//   • destinations + health   -> /api/simulcast/destinations, /api/simulcast/status
//   • start / end broadcast   -> /api/simulcast/start | /stop
//   • tips today              -> /api/admin/tips
//   • show presets            -> site config series
// Off air shows the real quiet state; going live fills it with live numbers.
type Dest = { id: string; platform: string; enabled: boolean; hasKey: boolean };
type Health = { id: string; alive: boolean; restarts: number };
const money = (n: number) => "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });

export default function GoLivePage() {
  const [brand, setBrand] = useState({ name: "Coach Hayes Football", logo: "", domain: "coachhayesfootball.com" });
  const [shows, setShows] = useState<{ key: string; name: string }[]>([]);
  const [preset, setPreset] = useState("");
  const [live, setLive] = useState(false);
  const [viewers, setViewers] = useState(0);
  const [dests, setDests] = useState<Dest[]>([]);
  const [health, setHealth] = useState<Record<string, Health>>({});
  const [relayLive, setRelayLive] = useState(false);
  const [relayConfigured, setRelayConfigured] = useState(false);
  const [restarts, setRestarts] = useState(0);
  const [tipsToday, setTipsToday] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/site-config", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      if (d?.branding) setBrand({ name: d.branding.siteName || "Coach Hayes Football", logo: d.branding.logo || "", domain: d.branding.domain || "coachhayesfootball.com" });
      const s = (d?.content?.series || []).map((x: any) => ({ key: x.key, name: x.title })).filter((x: any) => x.name);
      setShows(s);
      if (s[0]) setPreset(s[0].key);
    }).catch(() => {});
    (async () => {
      try {
        const token = await getIdToken();
        const r = await fetch("/api/admin/tips", { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" });
        if (r.ok) { const d = await r.json(); const s = new Date(); s.setHours(0, 0, 0, 0); setTipsToday((d.tips || []).filter((t: any) => (t.ts || 0) >= s.getTime()).reduce((a: number, t: any) => a + (Number(t.amount) || 0), 0)); }
      } catch {}
    })();
    loadDests();
    const poll = () => { pollStream(); pollSimulcast(); };
    poll(); const t = setInterval(poll, 5000); return () => clearInterval(t);
  }, []);

  async function pollStream() { try { const r = await fetch("/api/stream/status", { cache: "no-store" }); const d = await r.json(); setLive(Boolean(d.live)); setViewers(Number(d.viewers) || 0); } catch {} }
  async function loadDests() { try { const token = await getIdToken(); const r = await fetch("/api/simulcast/destinations", { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" }); const d = await r.json(); setRelayConfigured(Boolean(d.relayConfigured)); setDests(d.destinations || []); } catch {} }
  async function pollSimulcast() { try { const token = await getIdToken(); const r = await fetch("/api/simulcast/status", { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" }); const d = await r.json(); setRelayLive(Boolean(d.live)); const map: Record<string, Health> = {}; let rs = 0; for (const h of d.destinations || []) { map[h.id] = h; rs += Number(h.restarts) || 0; } setHealth(map); setRestarts(rs); } catch {} }
  async function toggleDest(id: string, enabled: boolean) { try { const token = await getIdToken(); const r = await fetch("/api/simulcast/destinations", { method: "PATCH", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ id, enabled }) }); const d = await r.json(); setDests(d.destinations || []); } catch {} }
  async function broadcast(action: "start" | "stop") { setBusy(true); try { const token = await getIdToken(); await fetch(`/api/simulcast/${action}`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {} }); await Promise.all([pollStream(), pollSimulcast()]); } catch {} finally { setBusy(false); } }

  const onAir = live || relayLive;
  const enabledDests = dests.filter((d) => d.enabled);

  return (
    <Shell
      title="Go live"
      sub={onAir ? `On air · ${viewers.toLocaleString()} watching` : "Off air — pick a show and start the broadcast."}
      brandName={brand.name}
      logo={brand.logo}
      actions={<span className={`onair${onAir ? "" : " off"}`}><i />{onAir ? "On air" : "Offline"}</span>}
    >
      <div className="row4">
        <div className="card kpi"><b>{onAir ? viewers.toLocaleString() : "0"}</b><span>Watching now</span><div className="d">{onAir ? "Live" : "Off air"}</div></div>
        <div className="card kpi"><b>{onAir ? viewers.toLocaleString() : "0"}</b><span>On this site</span><div className="d">{brand.domain}</div></div>
        <div className="card kpi"><b>{money(tipsToday)}</b><span>Tips today</span><div className="d">From viewers</div></div>
        <div className="card kpi"><b>{enabledDests.length}</b><span>Destinations on</span><div className="d">{relayConfigured ? "Relay connected" : "Relay not set"}</div></div>
      </div>

      <div className="row2">
        <div className="card">
          <h3>Broadcast</h3>
          <p className="cs">Pick the show first. It decides which channel the broadcast is created on and which destinations turn on.</p>
          <Link href="/manage/studio" className="btn" style={{ display: "flex", width: "100%", padding: 15, borderRadius: 14, marginBottom: 14, background: "var(--acc)", color: "var(--accInk)", fontFamily: "var(--fdisp)", letterSpacing: "-.02em", fontSize: 16, flexDirection: "column", gap: 3, textAlign: "center" }}>
            Open the studio<span style={{ fontFamily: "var(--fbody)", fontSize: 12.5, fontWeight: 400, opacity: 0.9 }}>Turn on your camera + mic, bring in guests, and go live from the browser.</span>
          </Link>
          <p className="cs" style={{ marginTop: 0 }}>Already streaming from OBS or the studio? Use the destination controls below to fan out to YouTube/Facebook.</p>
          {shows.length > 0 && (
            <div className="chips" role="group" aria-label="Show preset">
              {shows.map((s) => <button key={s.key} className={`chipf${preset === s.key ? " on" : ""}`} onClick={() => setPreset(s.key)}>{s.name}</button>)}
            </div>
          )}
          {onAir ? (
            <button className="btn red" disabled={busy} onClick={() => broadcast("stop")} style={{ width: "100%", padding: 17, borderRadius: 14, fontSize: 18, fontFamily: "var(--fdisp)", letterSpacing: "-.03em", flexDirection: "column", gap: 4 }}>
              End broadcast<span style={{ fontFamily: "var(--fbody)", fontSize: 12.5, fontWeight: 400, opacity: 0.9 }}>Stops every destination at once. The recording files itself to the library.</span>
            </button>
          ) : (
            <button className="btn" disabled={busy} onClick={() => broadcast("start")} style={{ width: "100%", padding: 17, borderRadius: 14, fontSize: 18, fontFamily: "var(--fdisp)", letterSpacing: "-.03em", background: "var(--acc)", color: "var(--accInk)", flexDirection: "column", gap: 4 }}>
              Start broadcast<span style={{ fontFamily: "var(--fbody)", fontSize: 12.5, fontWeight: 400, opacity: 0.9 }}>Goes live on the site and every enabled destination.</span>
            </button>
          )}
          <div className="rows" style={{ marginTop: 16 }}>
            <div className="r on"><button className="sw" aria-pressed="true" disabled aria-label="Site" /><span className="nm"><b>{brand.domain}</b><span>Player, chat and the recording</span></span><span className="st"><i />{onAir ? `${viewers.toLocaleString()} watching` : "Ready"}</span></div>
            {dests.map((d) => { const h = health[d.id]; return (
              <div className={`r${d.enabled ? " on" : ""}`} key={d.id}><button className="sw" aria-pressed={d.enabled} aria-label={d.platform} onClick={() => toggleDest(d.id, !d.enabled)} /><span className="nm"><b>{d.platform}</b><span>{d.hasKey ? "Stream key set" : "No stream key"}</span></span><span className="st"><i />{!d.enabled ? "Off" : h?.alive ? "Receiving" : onAir ? "Connecting…" : "Ready"}</span></div>
            ); })}
            {dests.length === 0 && <div className="r"><span className="nm"><b>No external destinations</b><span>Add YouTube / Facebook in Destinations</span></span><span className="st"><i />—</span></div>}
          </div>
          <div className="note"><b>Site is locked on.</b> It carries the player, the chat and the recording — turning it off would leave the archive empty.</div>
        </div>

        <div className="stack">
          <div className="card">
            <h3>Stream health</h3>
            <p className="cs">From the relay, every five seconds.</p>
            <div className="row2e" style={{ margin: 0 }}>
              <div className="g"><b className={onAir ? "ok" : ""}>{onAir ? "live" : "—"}</b><span>Relay status</span></div>
              <div className="g"><b>{enabledDests.length}</b><span>Destinations on</span></div>
              <div className="g"><b>{relayConfigured ? "yes" : "no"}</b><span>Relay configured</span></div>
              <div className="g"><b className={restarts === 0 ? "ok" : ""}>{restarts}</b><span>Restarts</span></div>
            </div>
            <p className="cs" style={{ margin: "14px 0 0" }}>{relayConfigured ? "Live bitrate and dropped frames appear here while broadcasting." : "Set RELAY_URL + RELAY_SECRET to see live bitrate and dropped frames."}</p>
          </div>
          <div className="card">
            <h3>Guests</h3>
            <p className="cs">Bring guests in from the green room. Stage limit six.</p>
            <div className="rows">
              <div className="r"><span className="ava">{brand.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("")}</span><span className="nm"><b>Host</b><span>You · camera and mic</span></span><span className="act"><span className="pill ok">Ready</span></span></div>
            </div>
            <p style={{ marginTop: 14 }}><Link className="link" href="/manage/guests">Open the green room ›</Link></p>
          </div>
        </div>
      </div>
    </Shell>
  );
}
