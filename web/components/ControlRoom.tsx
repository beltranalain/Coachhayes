"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { broadcast, type TransitionStyle } from "@/lib/broadcast";
import { getIdToken } from "@/lib/firebase";
import SimulcastManager from "@/components/SimulcastManager";
import LivePipModal from "@/components/LivePipModal";
import { PRIMARY_CHANNEL } from "@/lib/channels";
import { connectTwitchChat } from "@/lib/twitchChat";

const WS_BASE = process.env.NEXT_PUBLIC_CHAT_WS_URL || "";
type Tab = "onair" | "chat" | "guests" | "destinations" | "looks" | "sounds" | "audio" | "rundown" | "media";
type ChatMessage = { id: string; name: string; text: string; uid?: string; tip?: number; source?: "site" | "youtube" | "twitch" | "facebook" };

// Source badge: the site's own logo for site messages, platform logos for
// YouTube/Twitch/Facebook messages.
function srcBadge(source?: string, logo?: string) {
  const s = source || "site";
  if (s === "youtube") return <span className="src-ic" title="YouTube"><svg width="20" height="14" viewBox="0 0 28 20"><rect width="28" height="20" rx="5" fill="#FF0033" /><path d="M11 6l7 4-7 4z" fill="#fff" /></svg></span>;
  if (s === "twitch") return <span className="src-ic" title="Twitch"><svg width="16" height="16" viewBox="0 0 24 24" fill="#9146FF"><path d="M4 2 3 6v13h4v3h3l3-3h4l6-6V2H4zm16 9-3 3h-4l-3 3v-3H7V4h13v7zM16 6h-2v5h2V6zm-5 0H9v5h2V6z" /></svg></span>;
  if (s === "facebook") return <span className="src-ic" title="Facebook"><svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7v-3.5h3.1V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9v2.2h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z" /></svg></span>;
  return logo ? <img className="src-logo" src={logo} alt="Site" /> : <span className="src src-site">Site</span>;
}
type CamBox = { x: number; y: number; w: number; h: number };
type OverlayBox = { x: number; y: number; w: number };
type SceneCfg = { enabled: boolean; mode: "none" | "chroma" | "ml"; chroma: string; background: string; frame: string; logo: string; tickerOn: boolean; tickerLabel: string; ticker: string; camBox: CamBox; supportersOn: boolean; panelOn: boolean; panelTitle: string; panelImage: string; clockOn: boolean; overlayImage: string; overlayBox: OverlayBox };
type BumperCfg = { enabled: boolean; mode: "card" | "video"; headline: string; subtext: string; background: string; videoUrl: string; startsAt: number };
type SoundPad = { id: string; label: string; url: string };
type ScheduleItem = { when: string; title: string; note: string; startsAt?: number };
type RundownItem = { title: string; image: string; seconds: number };
type RundownCfg = { enabled: boolean; title: string; showTimer: boolean; activeIndex: number; items: RundownItem[] };

// Resize a picked image for a scene layer (cover fill or contain). Frame/logo
// keep transparency (PNG); background uses WebP.
function resizeScene(file: File, w: number, h: number, cover: boolean, png: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const ctx = c.getContext("2d"); if (!ctx) throw new Error("no ctx");
        const scale = cover ? Math.max(w / img.width, h / img.height) : Math.min(w / img.width, h / img.height);
        const dw = img.width * scale, dh = img.height * scale;
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        resolve(png ? c.toDataURL("image/png") : c.toDataURL("image/webp", 0.8));
      } catch (e) { reject(e); } finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}

// "m:ss" (or plain seconds) <-> seconds, for the per-topic countdown length.
function parseClock(v: string): number {
  const s = v.trim();
  if (!s) return 0;
  if (s.includes(":")) {
    const [m, sec] = s.split(":");
    return Math.max(0, (parseInt(m, 10) || 0) * 60 + (parseInt(sec, 10) || 0));
  }
  return Math.max(0, parseInt(s, 10) || 0);
}
function formatClock(secs: number): string {
  if (!secs) return "";
  return `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, "0")}`;
}

// Turn URLs in a chat message into clickable links.
function linkify(text: string) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((p, i) =>
    /^https?:\/\//.test(p)
      ? <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow">{p}</a>
      : <span key={i}>{p}</span>
  );
}

// Live preview of a waiting guest's camera (before the host admits them), so the
// host can screen what's on their feed. Re-attaches the stream on every render
// (cheap) so it picks up the track once it arrives.
function GuestPreview({ sessionId }: { sessionId: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const s = broadcast.guestStream(sessionId);
    if (ref.current && ref.current.srcObject !== s) { ref.current.srcObject = s; if (s) ref.current.play?.().catch(() => {}); }
  });
  return <video ref={ref} autoPlay playsInline muted style={{ width: 128, height: 72, objectFit: "cover", borderRadius: 6, background: "#000", border: "1px solid var(--line)", flexShrink: 0 }} />;
}

export default function ControlRoom() {
  const [, force] = useReducer((x) => x + 1, 0);
  const [tab, setTab] = useState<Tab>("onair");
  // Studio redesign UI state: split-button device menus, overflow menu, mic meter
  const [camMenu, setCamMenu] = useState(false);
  const [micMenu, setMicMenu] = useState(false);
  const [moreMenu, setMoreMenu] = useState(false);
  const [micLvl, setMicLvl] = useState(0);
  const [chatFilter, setChatFilter] = useState<"all" | "members" | "tips">("all");
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [siteLogo, setSiteLogo] = useState(""); // brand logo, shown as the site badge in chat
  const [hostName, setHostNameState] = useState("Host"); // host display name (tile + chat)
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [reveal, setReveal] = useState(false);
  const [scene, setScene] = useState<SceneCfg>({ enabled: false, mode: "chroma", chroma: "#00b140", background: "", frame: "", logo: "", tickerOn: false, tickerLabel: "", ticker: "", camBox: { x: 0, y: 0, w: 1, h: 1 }, supportersOn: false, panelOn: false, panelTitle: "", panelImage: "", clockOn: false, overlayImage: "", overlayBox: { x: 0.04, y: 0.08, w: 0.20 } });
  const [sceneMsg, setSceneMsg] = useState("");
  const [bumper, setBumper] = useState<BumperCfg>({ enabled: false, mode: "card", headline: "Starting soon", subtext: "", background: "", videoUrl: "", startsAt: 0 });
  const [bumperMsg, setBumperMsg] = useState("");
  const [introUp, setIntroUp] = useState<{ busy: boolean; msg: string }>({ busy: false, msg: "" });
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [sounds, setSounds] = useState<SoundPad[]>([]);
  const [soundLabel, setSoundLabel] = useState("");
  const [soundMsg, setSoundMsg] = useState("");
  // Live audience: people connected to the live page (proxy for on-site viewers)
  // + a running estimated cost for this broadcast session.
  const [onSite, setOnSite] = useState(0);
  const [sessionCost, setSessionCost] = useState(0);
  const [liveDelivery, setLiveDelivery] = useState<"own" | "youtube">("own");
  const [ytChannelId, setYtChannelId] = useState(PRIMARY_CHANNEL.channelId);
  const [ytLiveUrl, setYtLiveUrl] = useState(""); // ACTIVE link the poller uses (Unlisted streams)
  const [ytLiveDraft, setYtLiveDraft] = useState(""); // what's typed in the box before Save
  const [ytLiveStatus, setYtLiveStatus] = useState<"idle" | "checking" | "live" | "offline">("idle");
  const [ytLinkMsg, setYtLinkMsg] = useState("");
  const [twitchChannel, setTwitchChannel] = useState("");
  const [activeCam, setActiveCam] = useState("");
  const [rundown, setRundown] = useState<RundownCfg>({ enabled: false, title: "RUNDOWN", showTimer: true, activeIndex: 0, items: [] });
  const [rundownMsg, setRundownMsg] = useState("");
  const [pip, setPip] = useState(false);
  const onSiteRef = useRef(0);
  const wasLiveRef = useRef(false);

  // Site player source: own Cloudflare player (paid per-viewer) or the free
  // YouTube embed (unlimited viewers at $0). Saved to branding so the live page reads it.
  async function saveDelivery(mode: "own" | "youtube") {
    setLiveDelivery(mode);
    try {
      const token = await getIdToken();
      await fetch("/api/site-config", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ section: "branding", data: { liveDelivery: mode } }),
      });
    } catch { /* best-effort */ }
  }
  const [pressed, setPressed] = useState<string | null>(null);

  // Go Live also starts the simulcast relay (forwards the browser broadcast to
  // YouTube/etc). The relay scales to zero, so the first call may need a few
  // tries while it cold-boots. Never blocks going live - best-effort.
  async function goLive() {
    await broadcast.goLive();
    const token = await getIdToken().catch(() => null);
    const hdr: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    for (let i = 0; i < 10; i++) {
      if (!broadcast.live) break;
      try {
        const r = await fetch("/api/simulcast/start", { method: "POST", headers: hdr });
        const d = await r.json().catch(() => ({}));
        if (r.ok && (d.ok || d.forwarded > 0 || d.note)) break;
      } catch { /* retry */ }
      await new Promise((res) => setTimeout(res, 4000));
    }
  }
  async function endBroadcast() {
    broadcast.stop();
    try {
      const token = await getIdToken();
      await fetch("/api/simulcast/stop", { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {} });
    } catch { /* best-effort */ }
  }
  // Warm the relay on mount (so Go Live doesn't race its cold start); stop on
  // unmount so a closed tab never strands a relay session. While live, a 60s
  // heartbeat keeps the scale-to-zero machine awake.
  useEffect(() => {
    getIdToken().then((t) => fetch("/api/simulcast/warm", { method: "POST", headers: t ? { Authorization: `Bearer ${t}` } : {} }).catch(() => {})).catch(() => {});
    const beat = setInterval(() => {
      if (!broadcast.live) return;
      getIdToken().then((t) => fetch("/api/simulcast/status", { headers: t ? { Authorization: `Bearer ${t}` } : {}, cache: "no-store" }).catch(() => {})).catch(() => {});
    }, 60000);
    return () => {
      clearInterval(beat);
      getIdToken().then((t) => fetch("/api/simulcast/stop", { method: "POST", headers: t ? { Authorization: `Bearer ${t}` } : {}, keepalive: true }).catch(() => {})).catch(() => {});
    };
  }, []);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const overlayWs = useRef<WebSocket | null>(null);
  const chatWs = useRef<WebSocket | null>(null);
  const sceneBgInput = useRef<HTMLInputElement | null>(null);
  const sceneFrameInput = useRef<HTMLInputElement | null>(null);
  const sceneLogoInput = useRef<HTMLInputElement | null>(null);
  const soundInput = useRef<HTMLInputElement | null>(null);
  const bumperBgInput = useRef<HTMLInputElement | null>(null);
  const bumperVideoInput = useRef<HTMLInputElement | null>(null);
  const bumperLocalInput = useRef<HTMLInputElement | null>(null);
  const panelImgInput = useRef<HTMLInputElement | null>(null);
  const overlayImgInput = useRef<HTMLInputElement | null>(null);
  const rundownInput = useRef<HTMLInputElement | null>(null);
  const rundownFileIdx = useRef<number>(-1); // which topic row an upload targets
  const mediaInput = useRef<HTMLInputElement | null>(null);

  // Load the saved scene + sounds and apply them to the engine.
  useEffect(() => {
    fetch("/api/site-config", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.branding?.logo) { broadcast.setBrandLogo(d.branding.logo); setSiteLogo(d.branding.logo); }
        if (d?.branding?.accent) broadcast.setBrandAccent(d.branding.accent);
        if (d?.branding?.liveDelivery) setLiveDelivery(d.branding.liveDelivery);
        if (d?.branding?.youtubeChannelId) setYtChannelId(d.branding.youtubeChannelId);
        if (d?.branding?.twitchChannel !== undefined) setTwitchChannel(d.branding.twitchChannel || "");
        if (d?.branding?.hostName) { broadcast.setHostName(d.branding.hostName); setHostNameState(d.branding.hostName); }
        if (d?.scene) { const sc = { tickerOn: false, tickerLabel: "", ticker: "", camBox: { x: 0, y: 0, w: 1, h: 1 }, supportersOn: false, panelOn: false, panelTitle: "", panelImage: "", clockOn: false, overlayImage: "", overlayBox: { x: 0.04, y: 0.08, w: 0.20 }, ...d.scene } as SceneCfg; setScene(sc); broadcast.setScene(sc); }
        if (d?.bumper) { const bm = { enabled: false, mode: "card", headline: "Starting soon", subtext: "", background: "", videoUrl: "", startsAt: 0, ...d.bumper } as BumperCfg; setBumper(bm); broadcast.setBumper(bm); }
        if (d?.rundown) { const rn = { enabled: false, title: "RUNDOWN", showTimer: true, activeIndex: 0, items: [], ...d.rundown } as RundownCfg; rn.items = (rn.items || []).map((it: any) => ({ title: it?.title ?? "", image: it?.image ?? "", seconds: Number(it?.seconds) || 0 })); setRundown(rn); broadcast.setRundown(rn); }
        if (Array.isArray(d?.schedule)) setSchedule(d.schedule);
        if (Array.isArray(d?.sounds)) {
          setSounds(d.sounds);
          d.sounds.forEach((p: SoundPad) => { if (p?.id && p?.url) broadcast.loadSound(p.id, p.url); });
        }
      })
      .catch(() => {});
  }, []);

  async function saveSounds(items: SoundPad[]) {
    try {
      const token = await getIdToken();
      const res = await fetch("/api/site-config", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ section: "sounds", data: { items } }),
      });
      const d = await res.json();
      setSoundMsg(d.saved ? "Saved." : d.error || "Preview only - connect Firebase to save.");
    } catch { setSoundMsg("Could not save."); }
  }

  function pickSound(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setSoundMsg("");
    if (file.size > 240_000) { setSoundMsg("That clip is too large. Use a shorter or smaller sound (under ~240KB)."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      if (!url.startsWith("data:audio")) { setSoundMsg("That doesn't look like an audio file."); return; }
      const label = soundLabel.trim() || file.name.replace(/\.[^.]+$/, "").slice(0, 30) || "Sound";
      const id = (crypto as any)?.randomUUID?.() || Date.now() + "";
      const pad: SoundPad = { id, label, url };
      broadcast.loadSound(id, url);
      const next = [...sounds, pad];
      setSounds(next);
      setSoundLabel("");
      saveSounds(next);
    };
    reader.onerror = () => setSoundMsg("Could not read that file.");
    reader.readAsDataURL(file);
  }

  function removeSound(id: string) {
    broadcast.unloadSound(id);
    const next = sounds.filter((p) => p.id !== id);
    setSounds(next);
    saveSounds(next);
  }

  function tapPad(id: string) {
    broadcast.playSound(id);
    setPressed(id);
    setTimeout(() => setPressed((p) => (p === id ? null : p)), 180);
  }

  function updateScene(patch: Partial<SceneCfg>) {
    setScene((s) => { const next = { ...s, ...patch }; broadcast.setScene(next); return next; });
  }
  // Move/resize the camera window. The engine clamps (min size + on-screen), so
  // we mirror its clamped box back into state for the sliders/presets.
  function updateCamBox(patch: Partial<CamBox>) {
    broadcast.setCamBox(patch);
    setScene((s) => ({ ...s, camBox: { ...broadcast.camBox } }));
  }
  const CAM_PRESETS: [string, CamBox][] = [
    ["Full frame", { x: 0, y: 0, w: 1, h: 1 }],
    ["Right side", { x: 0.40, y: 0, w: 0.60, h: 1 }],
    ["Left side", { x: 0, y: 0, w: 0.60, h: 1 }],
    ["Corner box", { x: 0.64, y: 0.64, w: 0.34, h: 0.34 }],
  ];
  async function pickSceneImg(e: React.ChangeEvent<HTMLInputElement>, kind: "background" | "frame" | "logo" | "panel" | "overlay") {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    try {
      const url = kind === "background" ? await resizeScene(file, 1280, 720, true, false)
        : kind === "frame" ? await resizeScene(file, 1280, 720, true, true)
        : kind === "panel" || kind === "overlay" ? await resizeScene(file, 800, 800, false, true)
        : await resizeScene(file, 400, 160, false, true);
      const field = kind === "panel" ? "panelImage" : kind === "overlay" ? "overlayImage" : kind;
      updateScene({ [field]: url } as Partial<SceneCfg>);
    } catch { setSceneMsg("Could not read that image."); }
  }
  // Move/resize the free image overlay; mirror the engine's clamped box back.
  function updateOverlayBox(patch: Partial<OverlayBox>) {
    broadcast.setOverlayBox(patch);
    setScene((s) => ({ ...s, overlayBox: { ...broadcast.overlayBox } }));
  }
  async function saveScene() {
    setSceneMsg("");
    try {
      const token = await getIdToken();
      const res = await fetch("/api/site-config", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ section: "scene", data: scene }),
      });
      const d = await res.json();
      setSceneMsg(d.saved ? "Scene saved." : d.error || "Preview only - connect Firebase to save.");
    } catch { setSceneMsg("Could not save."); }
  }

  // ---- Rundown (PTI-style topic rail) ----
  function updateRundown(patch: Partial<RundownCfg>) {
    setRundown((r) => { const next = { ...r, ...patch }; broadcast.setRundown(next); return next; });
  }
  function updateRundownItem(i: number, patch: Partial<RundownItem>) {
    setRundown((r) => {
      const items = r.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it));
      const next = { ...r, items };
      broadcast.setRundown(next);
      return next;
    });
  }
  function addRundownItem() {
    updateRundown({ items: [...rundown.items, { title: "", image: "", seconds: 0 }] });
  }
  function removeRundownItem(i: number) {
    setRundown((r) => {
      const items = r.items.filter((_, idx) => idx !== i);
      const activeIndex = Math.max(0, Math.min(r.activeIndex, items.length - 1));
      const next = { ...r, items, activeIndex };
      broadcast.setRundown(next);
      return next;
    });
  }
  function setRundownActive(i: number) {
    updateRundown({ activeIndex: i });
    broadcast.setRundownActive(i);
  }
  async function pickRundownImg(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    const idx = rundownFileIdx.current; rundownFileIdx.current = -1;
    if (!file || idx < 0) return;
    try { updateRundownItem(idx, { image: await resizeScene(file, 480, 300, true, false) }); }
    catch { setRundownMsg("Could not read that image."); }
  }
  async function saveRundown() {
    setRundownMsg("");
    try {
      const token = await getIdToken();
      const res = await fetch("/api/site-config", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ section: "rundown", data: rundown }),
      });
      const d = await res.json();
      setRundownMsg(d.saved ? "Rundown saved." : d.error || "Preview only - connect Firebase to save.");
    } catch { setRundownMsg("Could not save."); }
  }

  // ---- Media: roll a video/music file live ----
  function pickMedia(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = "";
    if (f) { broadcast.playMedia(f); force(); }
  }

  // ---- Multi-camera: instant switch between video inputs (with a fade) ----
  function switchCam(id: string) {
    broadcast.beginTransition();
    broadcast.ensureCamera(id, undefined);
    setActiveCam(id);
    force();
  }

  // ---- Scenes: one-tap program looks (bound to keys 1-4) ----
  function applyScene(key: "camera" | "spotlight" | "studio" | "intro") {
    broadcast.beginTransition();
    if (key === "intro") { updateBumper({ enabled: true }); force(); return; }
    if (broadcast.bumperEnabled) updateBumper({ enabled: false });
    if (broadcast.mediaPlaying) broadcast.stopMedia();
    if (key === "studio") { broadcast.setSceneEnabled(true); broadcast.setLayout("grid"); }
    else { broadcast.setSceneEnabled(false); broadcast.setLayout(key === "spotlight" ? "spotlight" : "grid"); }
    force();
  }
  // Which scene is currently showing (for the active button state).
  function activeScene(): string {
    if (broadcast.bumperEnabled) return "intro";
    if (broadcast.sceneEnabled) return "studio";
    return broadcast.layout === "spotlight" ? "spotlight" : "camera";
  }

  // ---- Intro / "starting soon" bumper ----
  function updateBumper(patch: Partial<BumperCfg>) {
    setBumper((b) => { const next = { ...b, ...patch }; broadcast.setBumper(next); return next; });
  }
  async function pickBumperBg(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    try { updateBumper({ background: await resizeScene(file, 1280, 720, true, false) }); }
    catch { setBumperMsg("Could not read that image."); }
  }
  // Tie the countdown to the soonest future scheduled show (or clear it).
  function toggleCountdown(on: boolean) {
    if (!on) { updateBumper({ startsAt: 0 }); return; }
    const now = Date.now();
    const next = schedule
      .map((s) => Number(s.startsAt) || 0)
      .filter((t) => t > now)
      .sort((a, b) => a - b)[0] || 0;
    if (!next) { setBumperMsg("No upcoming scheduled show found. Add one in Schedule first."); updateBumper({ startsAt: 0 }); return; }
    setBumperMsg("");
    updateBumper({ startsAt: next });
  }
  async function persistBumper(data: BumperCfg): Promise<{ saved?: boolean; error?: string }> {
    const token = await getIdToken();
    const res = await fetch("/api/site-config", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ section: "bumper", data }),
    });
    return res.json();
  }
  async function saveBumper() {
    setBumperMsg("");
    // A local (blob:) intro video can't be persisted - it only exists in this
    // tab and would come back as a dead link. Save everything else; don't store
    // the temporary URL.
    const isLocal = bumper.videoUrl.startsWith("blob:");
    const data = isLocal ? { ...bumper, videoUrl: "" } : bumper;
    try {
      const d = await persistBumper(data);
      setBumperMsg(d.saved
        ? (isLocal ? "Intro settings saved. The device-only video isn't stored - upload to Cloudflare to keep a video." : "Intro saved.")
        : d.error || "Preview only - connect Firebase to save.");
    } catch { setBumperMsg("Could not save."); }
  }

  // Upload an intro video straight to Cloudflare Stream, then poll until a
  // CORS-enabled MP4 is ready and store it as the bumper video (drawable on the
  // program canvas without tainting it). Auto-saves so it survives a refresh.
  async function uploadIntroVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBumperMsg("");
    setIntroUp({ busy: true, msg: "Starting upload..." });
    try {
      const token = await getIdToken();
      const auth: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      // 1. One-time direct-upload URL.
      const res = await fetch("/api/stream/upload", { method: "POST", headers: auth });
      const d = await res.json();
      if (!res.ok || !d.uploadURL || !d.uid) {
        const raw = d.error || "Could not start the upload.";
        // Cloudflare rejects uploads when the Stream account has no storage
        // minutes. Make it unmistakably a billing setting, not an app bug, and
        // point to the free "this device" option below.
        const quota = /exceed|quota|capacity|storage/i.test(raw);
        setIntroUp({ busy: false, msg: quota
          ? "Cloudflare Stream has no storage minutes on this account, so uploads are blocked. This is a Cloudflare billing setting, not the app - add minutes in Cloudflare - Stream. To test for free right now, use \"Use a file from this device\" below."
          : raw });
        return;
      }
      const uid = d.uid as string;

      // 2. Upload the file directly to Cloudflare with progress.
      await new Promise<void>((resolve, reject) => {
        const form = new FormData();
        form.append("file", file);
        const xhr = new XMLHttpRequest();
        xhr.open("POST", d.uploadURL);
        xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) setIntroUp({ busy: true, msg: `Uploading... ${Math.round((ev.loaded / ev.total) * 100)}%` }); };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
        xhr.onerror = () => reject(new Error("Upload failed."));
        xhr.send(form);
      });

      // 3. Poll until Cloudflare finishes processing + the MP4 download is ready.
      setIntroUp({ busy: true, msg: "Processing video..." });
      const started = Date.now();
      let url = "";
      while (Date.now() - started < 10 * 60 * 1000) { // give up after 10 min
        await new Promise((r) => setTimeout(r, 4000));
        const t2 = await getIdToken();
        const pr = await fetch("/api/stream/mp4", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(t2 ? { Authorization: `Bearer ${t2}` } : {}) },
          body: JSON.stringify({ uid }),
        });
        const s = await pr.json();
        if (s.stage === "ready" && s.url) { url = s.url; break; }
        if (s.stage === "error") { setIntroUp({ busy: false, msg: s.error || "Cloudflare could not prepare the video." }); return; }
        if (s.stage === "processing") setIntroUp({ busy: true, msg: `Processing video... ${s.pct || 0}%` });
        else setIntroUp({ busy: true, msg: `Preparing playback... ${s.pct || 0}%` });
      }
      if (!url) { setIntroUp({ busy: false, msg: "Timed out preparing the video. Try again in a minute." }); return; }

      // 4. Store it, switch to video mode, and save so it persists.
      let next: BumperCfg = bumper;
      setBumper((b) => { next = { ...b, videoUrl: url, mode: "video" }; broadcast.setBumper(next); return next; });
      const saveRes = await persistBumper(next);
      setIntroUp({ busy: false, msg: saveRes.saved ? "Intro video ready and saved." : "Video ready - click Save intro to keep it." });
    } catch (err: any) {
      setIntroUp({ busy: false, msg: err?.message || "Upload failed." });
    }
  }

  // Free alternative to the Cloudflare upload: use a file straight off this
  // device. The clip is composited into the program canvas locally (and goes out
  // over the broadcast that way), so it needs no hosting or Stream minutes. The
  // trade-off: it lives only in this browser tab - a reload or another device
  // won't have it, so it's ideal for testing. Upload to Cloudflare to keep it.
  function pickIntroLocal(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (bumper.videoUrl.startsWith("blob:")) { try { URL.revokeObjectURL(bumper.videoUrl); } catch {} }
    const url = URL.createObjectURL(file);
    updateBumper({ videoUrl: url, mode: "video" });
    setIntroUp({ busy: false, msg: "Using a file from this device - free, and it plays on this tab only. Upload to Cloudflare to keep it across reloads and other devices." });
  }

  useEffect(() => broadcast.subscribe(force), []);
  useEffect(() => { if (!activeCam && cams[0]) setActiveCam(cams[0].deviceId); }, [cams, activeCam]);
  useEffect(() => () => { broadcast.stopReplayBuffer(); broadcast.stopVerticalRecording(); }, []); // free recorders when leaving the studio
  // Poll the host mic level a few times/sec to animate the Studio mic meter.
  useEffect(() => { const id = setInterval(() => setMicLvl(broadcast.hostInputLevel()), 180); return () => clearInterval(id); }, []);
  // Resume the (suspended) AudioContext on the first user gesture so the mic
  // meter is live during preview — browsers block audio until a gesture.
  useEffect(() => {
    const wake = () => { broadcast.resumeAudio(); };
    window.addEventListener("pointerdown", wake, { once: true });
    window.addEventListener("keydown", wake, { once: true });
    return () => { window.removeEventListener("pointerdown", wake); window.removeEventListener("keydown", wake); };
  }, []);

  // Keyboard shortcuts for live control (ignored while typing in a field).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case "1": applyScene("camera"); break;
        case "2": applyScene("spotlight"); break;
        case "3": applyScene("studio"); break;
        case "4": applyScene("intro"); break;
        case "m": case "M": broadcast.setMicOn(!broadcast.micOn); force(); break;
        case "c": case "C": broadcast.setCameraOn(!broadcast.cameraOn); force(); break;
        case "b": case "B": if (broadcast.banner) hideBanner(); else showBanner(); break;
        default: return;
      }
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [title, subtitle]);

  // Start the engine and mount its composited canvas as the program preview.
  useEffect(() => {
    broadcast.init().then(() => {
      navigator.mediaDevices.enumerateDevices().then((d) => {
        setCams(d.filter((x) => x.kind === "videoinput"));
        setMics(d.filter((x) => x.kind === "audioinput"));
      });
    });
    const el = broadcast.canvas;
    if (el && stageRef.current && el.parentElement !== stageRef.current) {
      el.style.width = "100%"; el.style.height = "100%"; el.style.objectFit = "cover"; el.style.display = "block";
      stageRef.current.appendChild(el);
    }

    // Drag the pinned comment, banner, PIP camera, or (in custom layout) a
    // camera tile around. Scroll over a tile in custom layout to resize it.
    let drag: null | "pin" | "banner" | "pip" | "tile" = null, ox = 0, oy = 0, dragKey = "";
    const toCanvas = (e: PointerEvent) => {
      const r = el!.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (broadcast.width / r.width), y: (e.clientY - r.top) * (broadcast.height / r.height) };
    };
    const onDown = (e: PointerEvent) => {
      if (!el) return;
      const p = toCanvas(e);
      if (broadcast.hitPin(p.x, p.y)) { drag = "pin"; const b = broadcast.pinBox(); ox = p.x - b.x; oy = p.y - b.y; }
      else if (broadcast.hitBanner(p.x, p.y)) { drag = "banner"; const b = broadcast.bannerBox(); ox = p.x - b.x; oy = p.y - b.y; }
      else if (broadcast.hitPip(p.x, p.y)) { drag = "pip"; const b = broadcast.pipBox(); ox = p.x - b.x; oy = p.y - b.y; }
      else { const k = broadcast.hitTile(p.x, p.y); if (k) { drag = "tile"; dragKey = k; const b = broadcast.tileBox(k); ox = p.x - b.x; oy = p.y - b.y; } }
      if (drag) { el.style.cursor = "grabbing"; el.setPointerCapture?.(e.pointerId); e.preventDefault(); }
    };
    const onMove = (e: PointerEvent) => {
      if (!el) return;
      const p = toCanvas(e);
      if (drag === "pin") broadcast.setPinPos(p.x - ox, p.y - oy);
      else if (drag === "banner") broadcast.setBannerPos(p.x - ox, p.y - oy);
      else if (drag === "pip") broadcast.setPipPos(p.x - ox, p.y - oy);
      else if (drag === "tile") broadcast.setTilePos(dragKey, p.x - ox, p.y - oy);
      else el.style.cursor = broadcast.hitPin(p.x, p.y) || broadcast.hitBanner(p.x, p.y) || broadcast.hitPip(p.x, p.y) || broadcast.hitTile(p.x, p.y) ? "grab" : "default";
    };
    const onUp = () => { if (drag) { drag = null; dragKey = ""; if (el) el.style.cursor = "grab"; } };
    // Scroll to resize a tile in custom layout.
    const onWheel = (e: WheelEvent) => {
      if (!el || broadcast.layout !== "custom") return;
      const p = toCanvas(e as unknown as PointerEvent);
      const k = broadcast.hitTile(p.x, p.y);
      if (!k) return;
      e.preventDefault();
      broadcast.resizeTile(k, e.deltaY < 0 ? 1.06 : 0.94);
    };
    el?.addEventListener("pointerdown", onDown);
    el?.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    el?.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el?.removeEventListener("pointerdown", onDown);
      el?.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      el?.removeEventListener("wheel", onWheel);
      if (el && el.parentElement) el.parentElement.removeChild(el);
    };
  }, []);

  // Chat (monitor + pin source) + overlay (OBS mirror) sockets.
  useEffect(() => {
    if (!WS_BASE) return;
    const ow = new WebSocket(`${WS_BASE}/room/overlay/ws`); overlayWs.current = ow;
    const cw = new WebSocket(`${WS_BASE}/room/live/ws`);
    cw.onmessage = (e) => { let d: any; try { d = JSON.parse(e.data); } catch { return; }
      if (d.type === "history" && Array.isArray(d.messages)) setChat(d.messages.slice(-60));
      else if (d.type === "clear") setChat([]);
      else if (d.type === "chat") setChat((p) => [...p.slice(-59), d]);
      else if (d.type === "count") { const n = Math.max(0, (Number(d.count) || 0) - 1); onSiteRef.current = n; setOnSite(n); }
      else if (d.type === "tip") broadcast.showTipAlert(d.name, d.amount, d.message); };
    chatWs.current = cw;
    // Accumulate this session's on-site delivery cost while live: on-site
    // viewers x elapsed minutes x $0.001. Resets each time you go live.
    const costTimer = setInterval(() => {
      if (broadcast.live) {
        if (!wasLiveRef.current) { wasLiveRef.current = true; setSessionCost(0); }
        setSessionCost((c) => c + onSiteRef.current * (15 / 60) * 0.001);
      } else { wasLiveRef.current = false; }
    }, 15000);
    return () => { ow.close(); cw.close(); clearInterval(costTimer); };
  }, []);

  // Push an external (YouTube/Twitch) message into the chat room. The worker
  // stores + broadcasts it to everyone (site + studio) and de-dupes by extId.
  const injectChat = (m: { name: string; text: string; source: string; extId: string }) => {
    const cw = chatWs.current;
    if (cw && cw.readyState === WebSocket.OPEN) cw.send(JSON.stringify({ type: "chat", uid: "", ...m }));
  };

  // Remember the (optional) Unlisted live link across refreshes during a show.
  useEffect(() => { try { const v = localStorage.getItem("ssyt-liveurl"); if (v) { setYtLiveUrl(v); setYtLiveDraft(v); } } catch {} }, []);

  // Save the pasted link so the poller picks it up (and we can show it "took").
  function saveYtLink() {
    const v = ytLiveDraft.trim();
    setYtLiveUrl(v);
    try { v ? localStorage.setItem("ssyt-liveurl", v) : localStorage.removeItem("ssyt-liveurl"); } catch {}
    setYtLiveStatus(v || broadcast.live ? "checking" : "idle");
    setYtLinkMsg(v ? "Saved - watching this stream's chat." : "Cleared.");
  }

  // Merge YouTube live chat. Polls a server route (keeps the API key server-side)
  // at YouTube's recommended interval; the backlog on the first pass is skipped
  // so we only inject messages that arrive from now on. Runs while broadcasting,
  // OR whenever a live link is pasted - so chat merges even for a YouTube-native
  // stream (or while testing) without needing the platform Go Live to be on air.
  useEffect(() => {
    if (!broadcast.live && !ytLiveUrl) { setYtLiveStatus("idle"); return; }
    setYtLiveStatus("checking");
    let stop = false, liveChatId = "", pageToken = "", firstPass = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (stop) return;
      let delay = 6000;
      try {
        const token = await getIdToken();
        const qs = new URLSearchParams();
        if (liveChatId) qs.set("liveChatId", liveChatId);
        if (pageToken) qs.set("pageToken", pageToken);
        if (ytLiveUrl) qs.set("liveUrl", ytLiveUrl); // Unlisted stream override wins over channel auto-detect
        if (ytChannelId) qs.set("channelId", ytChannelId);
        const r = await fetch(`/api/chat/youtube?${qs.toString()}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" });
        const d = await r.json();
        if (d.live && d.liveChatId) {
          liveChatId = d.liveChatId;
          if (!stop) setYtLiveStatus("live");
          if (!firstPass && Array.isArray(d.messages)) {
            for (const m of d.messages) injectChat({ name: m.name, text: m.text, source: "youtube", extId: "yt_" + m.id });
          }
          pageToken = d.pageToken || pageToken;
          delay = Math.min(Math.max(Number(d.pollingMs) || 6000, 3000), 15000);
          firstPass = false;
        } else {
          liveChatId = ""; pageToken = ""; firstPass = true; delay = 12000; // not live yet / ended
          if (!stop) setYtLiveStatus("offline");
        }
      } catch { delay = 12000; if (!stop) setYtLiveStatus("offline"); }
      if (!stop) timer = setTimeout(poll, delay);
    }
    poll();
    return () => { stop = true; clearTimeout(timer); };
  }, [broadcast.live, ytChannelId, ytLiveUrl]);

  // Merge Twitch chat while broadcasting (anonymous read, real-time).
  useEffect(() => {
    if (!broadcast.live || !twitchChannel) return;
    return connectTwitchChat(twitchChannel, (m) => injectChat({ name: m.name, text: m.text, source: "twitch", extId: "tw_" + m.id }));
  }, [broadcast.live, twitchChannel]);

  // Push graphics to BOTH the browser composite (engine) and the OBS overlay.
  const pushOverlay = (cmd: Record<string, unknown>) => overlayWs.current?.send(JSON.stringify({ type: "overlay", ...cmd }));
  const showBanner = () => { if (!title.trim()) return; broadcast.setBanner(title, subtitle); pushOverlay({ action: "banner", title, subtitle }); };
  const hideBanner = () => { broadcast.hideBanner(); pushOverlay({ action: "hideBanner" }); };
  const clearAll = () => { broadcast.clearGraphics(); pushOverlay({ action: "clear" }); };
  const pin = (m: ChatMessage) => { broadcast.setPinned(m.name, m.text, m.source); pushOverlay({ action: "comment", name: m.name, text: m.text, source: m.source }); };
  // Host posts into the live chat (shows as the host on the site; links allowed).
  const sendChat = () => {
    const text = chatDraft.trim();
    const cw = chatWs.current;
    if (!text || !cw || cw.readyState !== WebSocket.OPEN) return;
    cw.send(JSON.stringify({ type: "chat", name: hostName, text, uid: "" }));
    setChatDraft("");
  };
  const unpin = () => { broadcast.clearPinned(); pushOverlay({ action: "hideComment" }); };
  const [modMsg, setModMsg] = useState("");
  const [timeoutFor, setTimeoutFor] = useState<ChatMessage | null>(null); // open the duration modal
  const [customMin, setCustomMin] = useState("10");
  const moderate = async (action: "ban" | "timeout" | "unban", m: ChatMessage, seconds?: number) => {
    if (!m.uid) { setModMsg("This viewer isn't signed in, so they can't be moderated."); return; }
    setModMsg("");
    try {
      const token = await getIdToken();
      const res = await fetch("/api/chat/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action, room: "live", uid: m.uid, name: m.name, seconds }),
      });
      setModMsg(res.ok ? `${m.name} ${action === "ban" ? "removed" : action === "timeout" ? "timed out" : "restored"}.` : "Could not apply that.");
    } catch { setModMsg("Moderation request failed."); }
  };
  const isPinned = (m: ChatMessage) => !!broadcast.pinned && broadcast.pinned.name === m.name && broadcast.pinned.text === m.text;

  const live = broadcast.live;
  const ingest = broadcast.ingest;

  return (
    <>
      <div className="admin-topbar">
        <div>
          <h1>Go Live</h1>
          <div className="sub">Your whole show on one screen. Camera, guests, graphics - all composited in the browser.</div>
        </div>
        <div className="admin-actions">
          <span className={`live-pill${live ? " is-live" : ""}`}><span className="dot" /><span>{live ? "On air" : "Off air"}</span></span>
        </div>
      </div>

      <div className="cr-studio">
      <div className="cr-main">
        {/* ---- Program ---- */}
        <div className="panel">
          <h3>Program</h3>
          <div className="panel-sub">Exactly what goes out - camera, guests, and on-air graphics burned in.</div>
          <div className="cr-stage">
            <div className="player-wrap" ref={stageRef} style={{ padding: 0, overflow: "hidden" }} />
            <span className="cr-watching"><span className="wd" />{onSite} watching</span>
          </div>

          {/* Primary action + split-button device toggles (Option B) */}
          <div className="cr-actionbar">
            {!live ? (
              <button className="cr-golive" type="button" onClick={goLive} disabled={broadcast.connecting || ingest === null}>
                <span className="gdot" />{broadcast.connecting ? "Connecting…" : "Go Live"}
              </button>
            ) : (
              <button className="cr-golive stop" type="button" onClick={endBroadcast}>Stop broadcast</button>
            )}
            <div className="cr-toggles">
              <div className={`cr-tgl${broadcast.cameraOn ? " on" : ""}`}>
                <button className="cr-tglmain" type="button" onClick={() => { broadcast.setCameraOn(!broadcast.cameraOn); force(); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="6" width="12" height="12" rx="2" /><path d="M15 10l6-3v10l-6-3z" /></svg>
                  <span>Camera</span><em>{broadcast.cameraOn ? "On" : "Off"}</em>
                </button>
                <button className="cr-tglcar" type="button" aria-label="Pick camera" onClick={() => { setCamMenu((v) => !v); setMicMenu(false); setMoreMenu(false); }}>▾</button>
                {camMenu && (
                  <div className="cr-menu" style={{ left: 0, right: "auto" }}>
                    {cams.map((c, i) => (
                      <button key={c.deviceId} type="button" className={`cr-mi${activeCam === c.deviceId ? " on" : ""}`} onClick={() => { switchCam(c.deviceId); setCamMenu(false); }}>{c.label || `Camera ${i + 1}`}</button>
                    ))}
                  </div>
                )}
              </div>
              <div className={`cr-tgl${broadcast.micOn ? " on" : ""}`}>
                <button className="cr-tglmain" type="button" onClick={() => { broadcast.setMicOn(!broadcast.micOn); force(); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0M12 17v4" /></svg>
                  <span>Mic</span><em>{broadcast.micOn ? "On" : "Off"}</em>
                </button>
                <button className="cr-tglcar" type="button" aria-label="Pick microphone" onClick={() => { setMicMenu((v) => !v); setCamMenu(false); setMoreMenu(false); }}>▾</button>
                {micMenu && (
                  <div className="cr-menu" style={{ left: 0, right: "auto" }}>
                    {mics.length === 0 && <span className="cr-mi" style={{ cursor: "default", opacity: .6 }}>No microphones found</span>}
                    {mics.map((m, i) => (
                      <button key={m.deviceId} type="button" className="cr-mi" onClick={() => { broadcast.ensureCamera(undefined, m.deviceId); setMicMenu(false); }}>{m.label || `Microphone ${i + 1}`}</button>
                    ))}
                  </div>
                )}
              </div>
              <button className={`cr-tgl single${broadcast.screenSharing ? " on" : ""}`} type="button" onClick={() => { broadcast.screenSharing ? broadcast.stopScreenShare() : broadcast.startScreenShare(); force(); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8" /></svg>
                <span>Screen</span><em>{broadcast.screenSharing ? "Sharing" : "Share"}</em>
              </button>
            </div>
          </div>

          {/* Live mic level meter (full audio lives in the Audio tab) */}
          <div className="cr-micmeter">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0M12 17v4" /></svg>
            <div className="cr-meter"><span className="cr-mfill" style={{ width: `${broadcast.micOn ? Math.min(100, Math.round(micLvl * 320)) : 0}%` }} /></div>
            <span className="dest-meta">Mic level</span>
            <button type="button" className="cr-audlink" onClick={() => setTab("audio")}>Audio settings →</button>
          </div>

          {/* Layout / screen-share layout + overflow menu */}
          <div className="cr-row2">
            {broadcast.screenSharing ? (
              <div className="cr-group"><span className="cr-glabel">Screen</span><div className="cr-seg">
                <button className={broadcast.screenLayout === "full" ? "on" : ""} type="button" onClick={() => broadcast.setScreenLayout("full")}>Full</button>
                <button className={broadcast.screenLayout === "pip" ? "on" : ""} type="button" onClick={() => broadcast.setScreenLayout("pip")}>PIP</button>
                <button className={broadcast.screenLayout === "split" ? "on" : ""} type="button" onClick={() => broadcast.setScreenLayout("split")}>Split</button>
              </div></div>
            ) : (
              <div className="cr-group"><span className="cr-glabel">Layout</span><div className="cr-seg">
                <button className={broadcast.layout === "grid" ? "on" : ""} type="button" onClick={() => { broadcast.beginTransition(); broadcast.setLayout("grid"); force(); }}>Grid</button>
                <button className={broadcast.layout === "spotlight" ? "on" : ""} type="button" onClick={() => { broadcast.beginTransition(); broadcast.setLayout("spotlight"); force(); }}>Spotlight</button>
                <button className={broadcast.layout === "custom" ? "on" : ""} type="button" onClick={() => { broadcast.beginTransition(); broadcast.setLayout("custom"); force(); }}>Custom</button>
              </div></div>
            )}
            <div className="cr-morewrap">
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setMoreMenu((v) => !v); setCamMenu(false); setMicMenu(false); }}>More ▾</button>
              {moreMenu && (
                <div className="cr-menu" style={{ right: 0 }}>
                  {broadcast.recording ? (
                    <button type="button" className="cr-mi" onClick={() => { broadcast.stopRecording(); setMoreMenu(false); }}>Stop recording</button>
                  ) : (
                    <button type="button" className="cr-mi" onClick={() => { broadcast.startRecording(); setMoreMenu(false); }}>Record locally</button>
                  )}
                  <button type="button" className="cr-mi" onClick={() => { setPip(true); setMoreMenu(false); }}>Open live page</button>
                  {broadcast.screenSharing ? (
                    <button type="button" className="cr-mi" onClick={() => { broadcast.stopScreenShare(); setMoreMenu(false); }}>Stop screen share</button>
                  ) : (
                    <button type="button" className="cr-mi" onClick={() => { broadcast.startScreenShare(); setMoreMenu(false); }}>Share screen</button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* One-tap program "scenes" (also keys 1-4). Studio = branded scene. */}
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
              <span className="dest-meta">Scenes <span style={{ opacity: .7 }}>(press 1-4)</span></span>
              <label className="cr-transition">
                <span className="dest-meta">Transition</span>
                <select value={broadcast.transitionStyle} onChange={(e) => { broadcast.setTransitionStyle(e.target.value as TransitionStyle); force(); }}>
                  <option value="cut">Cut</option>
                  <option value="fade">Fade</option>
                  <option value="dip">Dip to black</option>
                  <option value="slide">Slide</option>
                  <option value="wipe">Wipe</option>
                  <option value="zoom">Zoom</option>
                </select>
              </label>
            </div>
            <div className="filters" style={{ margin: 0 }}>
              {([["camera", "1 · Camera"], ["spotlight", "2 · Spotlight"], ["studio", "3 · Studio"], ["intro", "4 · Intro"]] as ["camera" | "spotlight" | "studio" | "intro", string][]).map(([k, label]) => (
                <button key={k} type="button" className={`filter-btn${activeScene() === k ? " active" : ""}`} onClick={() => applyScene(k)}>{label}</button>
              ))}
            </div>
            {broadcast.layout === "custom" && (
              <p className="form-note" style={{ marginTop: 6 }}><strong>Custom layout:</strong> drag any camera tile on the preview to move it; scroll over a tile to resize it.</p>
            )}
          </div>

          {/* Camera zoom. If the webcam exposes a real lens zoom, use it (this
              actually widens the field of view for a 2nd person). Otherwise fall
              back to a software crop and say so plainly. */}
          {broadcast.camZoom.supported ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
                <span className="dest-meta" style={{ minWidth: 92 }}>Camera zoom</span>
                <span className="dest-meta">Wide</span>
                <input type="range" min={broadcast.camZoom.min} max={broadcast.camZoom.max} step={broadcast.camZoom.step} value={broadcast.camZoom.value} onChange={(e) => { broadcast.setCameraZoomHw(Number(e.target.value)); force(); }} style={{ flex: 1, maxWidth: 240 }} />
                <span className="dest-meta">Tight</span>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => { broadcast.setCameraZoomHw(broadcast.camZoom.min); force(); }}>Widest</button>
              </div>
              <p className="form-note" style={{ marginTop: 6 }}>Controls your webcam&apos;s lens - slide toward <strong>Wide</strong> to fit a second person.</p>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
                <span className="dest-meta" style={{ minWidth: 92 }}>Camera crop</span>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => { broadcast.setHostZoom(broadcast.hostZoom - 0.1); force(); }}>&minus;</button>
                <input type="range" min={1} max={3} step={0.05} value={broadcast.hostZoom} onChange={(e) => { broadcast.setHostZoom(Number(e.target.value)); force(); }} style={{ flex: 1, maxWidth: 220 }} />
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => { broadcast.setHostZoom(broadcast.hostZoom + 0.1); force(); }}>+</button>
                <span className="dest-meta" style={{ width: 46, textAlign: "right" }}>{Math.round(broadcast.hostZoom * 100)}%</span>
                {broadcast.hostZoom !== 1 && <button className="btn btn-ghost btn-sm" type="button" onClick={() => { broadcast.setHostZoom(1); force(); }}>Reset</button>}
              </div>
            </>
          )}

          {pip && <LivePipModal onClose={() => setPip(false)} />}
          {ingest === null && <div className="notice" style={{ marginTop: 14 }}><strong>Cloudflare Stream not connected.</strong> Preview works; Go Live turns on once the Stream keys are set.</div>}
          {broadcast.error && <p className="form-error" style={{ marginTop: 10 }}>{broadcast.error}</p>}
          {live && <p className="form-ok" style={{ marginTop: 10 }}>Live on your site and simulcasting to YouTube.</p>}
          {/* Stats row + delivery/see-stream moved to the Destinations tab to keep the main area clean. */}
          <span style={{ display: "none" }}>{sessionCost}</span>
        </div>

        {/* ---- Show controls ---- */}
        <div>
          <div className="filters" style={{ marginBottom: 16 }}>
            {([["onair", "On air"], ["chat", "Chat"], ["guests", "Guests"], ["audio", "Audio"], ["looks", "Looks"], ["rundown", "Rundown"], ["sounds", "Sounds"], ["media", "Media"], ["destinations", "Destinations"]] as [Tab, string][]).map(([k, label]) => (
              <button key={k} className={`filter-btn${tab === k ? " active" : ""}`} type="button" onClick={() => setTab(k)}>{label}</button>
            ))}
          </div>

          {tab === "chat" && (
            <div className="panel">
              <div className="mod-row" style={{ alignItems: "center", marginBottom: 4 }}>
                <h3 style={{ margin: 0 }}>Chat settings</h3>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => { if (confirm("Clear the live chat for everyone?")) { broadcast.clearChat(); setModMsg("Chat cleared."); } }}>Clear chat</button>
              </div>
              <div className="panel-sub">The live conversation is in the right rail. Moderation and YouTube pull-in are set here.</div>
              <div className="dest-row" style={{ marginTop: 6 }}>
                <div><div className="dest-name">Reset chat when I go live</div><div className="dest-meta">Start each broadcast with a clean chat</div></div>
                <label className="toggle"><input type="checkbox" checked={broadcast.autoClearChat} onChange={(e) => broadcast.setAutoClearChat(e.target.checked)} /><span className="track" /></label>
              </div>

              {/* YouTube chat pull-in: Public auto-detects; Unlisted needs the link; Private can't be read. */}
              <div className="form-field" style={{ marginTop: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span>YouTube live link (only needed for Unlisted streams)</span>
                  {(() => {
                    const map = {
                      idle: { t: "Not connected", c: "var(--mute)", d: "var(--mute)" },
                      checking: { t: "Checking...", c: "var(--accent)", d: "var(--accent)" },
                      live: { t: "Live - chat connected", c: "#39d98a", d: "#39d98a" },
                      offline: { t: "Not live", c: "var(--live)", d: "var(--live)" },
                    } as const;
                    const s = map[ytLiveStatus];
                    return (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: s.c, border: `1px solid ${s.c}`, borderRadius: 999, padding: "2px 9px" }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.d }} />{s.t}
                      </span>
                    );
                  })()}
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="text" value={ytLiveDraft} placeholder="https://www.youtube.com/watch?v=..." maxLength={200} onChange={(e) => setYtLiveDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveYtLink(); } }} style={{ flex: 1, background: "var(--bg2)", border: "1px solid var(--line)", color: "var(--cream)", borderRadius: 8, padding: "9px 12px", font: "inherit", fontSize: 13 }} />
                  <button className="btn btn-primary btn-sm" type="button" onClick={saveYtLink} disabled={ytLiveDraft.trim() === ytLiveUrl.trim()}>Save</button>
                </div>
                {ytLinkMsg && <p className="form-ok" style={{ margin: "6px 0 0", fontSize: 12.5 }}>{ytLinkMsg}</p>}
                <p className="form-note" style={{ marginTop: 6 }}>
                  <b>Public</b> streams pull chat in automatically (a couple of minutes after going live). <b>Unlisted</b> streams aren&apos;t searchable - paste the live video link here and click <b>Save</b> to pull their chat instantly. <b>Private</b> streams can&apos;t be read by YouTube&apos;s API, so set the broadcast to Public or Unlisted to merge its chat.
                </p>
              </div>
              {modMsg && <p className="form-ok" style={{ fontSize: "12.5px", marginTop: 10 }}>{modMsg}</p>}
            </div>
          )}

          {tab === "onair" && (
            <div className="panel">
              <h3>On-air graphics</h3>
              <div className="panel-sub">These appear on the broadcast itself (burned into the video).</div>
              <div className="form-field"><label>Banner title</label><input type="text" value={title} placeholder="Your Studio" onChange={(e) => setTitle(e.target.value)} /></div>
              <div className="form-field"><label>Subtitle (optional)</label><input type="text" value={subtitle} placeholder="Segment 2" onChange={(e) => setSubtitle(e.target.value)} /></div>
              <div className="form-field">
                <label>Name-tag style</label>
                <div className="filters" style={{ margin: 0 }}>
                  {([["bar", "Bar"], ["rounded", "Rounded"], ["pill", "Pill"]] as ["bar" | "rounded" | "pill", string][]).map(([k, label]) => (
                    <button key={k} type="button" className={`filter-btn${broadcast.bannerStyle === k ? " active" : ""}`} onClick={() => { broadcast.setBannerStyle(k); force(); }}>{label}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
                <button className="btn btn-primary btn-sm" type="button" onClick={showBanner}>Show banner</button>
                <button className="btn btn-ghost btn-sm" type="button" onClick={hideBanner}>Hide banner</button>
                <button className="btn btn-ghost btn-sm" type="button" onClick={clearAll}>Clear all</button>
              </div>
              <p className="form-note" style={{ marginTop: -8, marginBottom: 16 }}>Drag the banner on the program preview to place it anywhere.</p>
              <div className="panel-sub">To pin a chat message onto the broadcast, use the <strong>Pin</strong> button on any message in the Live chat (right), then drag it on the program preview.</div>
              {broadcast.pinned && (
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span className="dest-meta">Pinned: <strong style={{ color: "var(--amber)" }}>{broadcast.pinned.name}</strong> - drag it on the preview to reposition.</span>
                  <button className="btn btn-ghost btn-sm" type="button" onClick={unpin}>Unpin</button>
                </div>
              )}
            </div>
          )}

          {tab === "guests" && (
            <div className="panel">
              <h3>Invite a guest</h3>
              <div className="panel-sub">Send this link - they join in the browser, then you <strong>preview their camera</strong> and Admit them to the program. Nothing they send goes on air until you admit.</div>
              <div className="copybox" style={{ marginBottom: 16 }}>
                <input type="text" readOnly value={broadcast.inviteUrl()} />
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => navigator.clipboard?.writeText(broadcast.inviteUrl())}>Copy</button>
              </div>
              <div className="mod-row" style={{ alignItems: "center", marginBottom: 4 }}>
                <div className="panel-sub" style={{ marginBottom: 0 }}>In the room</div>
                {(() => {
                  const audioGuests = broadcast.roster.filter((p) => p.sessionId && broadcast.admitted.has(p.sessionId) && p.hasAudio);
                  if (audioGuests.length === 0) return null;
                  const anyUnmuted = audioGuests.some((p) => !broadcast.mutedGuests.has(p.sessionId!));
                  return (
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => (anyUnmuted ? broadcast.muteAllGuests() : broadcast.unmuteAllGuests())}>
                      {anyUnmuted ? "Mute all" : "Unmute all"}
                    </button>
                  );
                })()}
              </div>
              <div className="dest-row"><div><div className="dest-name">Your Studio (you)</div><div className="dest-meta">host</div></div><span className="pill published">On</span></div>
              {broadcast.roster.length === 0 && <p className="muted" style={{ fontSize: "13px", marginTop: 10 }}>No guests yet. Share the link above.</p>}
              {broadcast.roster.map((p) => {
                const onStage = Boolean(p.sessionId && broadcast.admitted.has(p.sessionId));
                return (
                  <div className="dest-row" key={p.id}>
                    <div style={{ minWidth: 0 }}>
                      <div className="dest-name">{p.name}{onStage && <span className="pill published" style={{ marginLeft: 8 }}>On air</span>}{onStage && p.sessionId && broadcast.isGuestMuted(p.sessionId) && <span className="pill draft" style={{ marginLeft: 6 }}>Muted</span>}</div>
                      <div className="dest-meta">{p.hasVideo ? "video" : "no video"} · {p.hasAudio ? "audio" : "muted"}</div>
                    </div>
                    {onStage ? (
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        {p.hasAudio && (
                          <button className="btn btn-ghost btn-sm" type="button" onClick={() => broadcast.toggleGuestMute(p.sessionId!)}>
                            {broadcast.isGuestMuted(p.sessionId!) ? "Unmute" : "Mute"}
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => broadcast.removeGuest(p.sessionId!)}>Remove</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
                        {p.hasVideo && p.sessionId && <GuestPreview sessionId={p.sessionId} />}
                        <button className="btn btn-primary btn-sm" type="button" disabled={!p.sessionId || !broadcast.realtimeReady} onClick={() => broadcast.admitGuest(p.sessionId!)}>Admit</button>
                      </div>
                    )}
                  </div>
                );
              })}
              {!broadcast.realtimeReady && (
                <p className="notice" style={{ marginTop: 14 }}><strong>Connecting to Cloudflare Realtime...</strong> Guests can join now; once the studio connection is up you can admit them to the program.</p>
              )}
            </div>
          )}

          {tab === "audio" && (
            <div className="panel">
              <h3>Audio levels</h3>
              <div className="panel-sub">Set what viewers hear - the host mic and each guest in the broadcast mix.</div>
              <div className="dest-row" style={{ alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="dest-name">Host mic{!broadcast.micOn && <span className="pill draft" style={{ marginLeft: 6 }}>Off</span>}</div>
                  <div className="dest-meta">Your microphone</div>
                </div>
                <input type="range" min={0} max={1.5} step={0.05} value={broadcast.hostLevel} onChange={(e) => { broadcast.setHostLevel(Number(e.target.value)); force(); }} style={{ width: 150 }} />
                <span className="dest-meta" style={{ width: 42, textAlign: "right" }}>{Math.round(broadcast.hostLevel * 100)}%</span>
              </div>
              <div className="dest-row" style={{ alignItems: "center" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="dest-name">Enhance mic</div>
                  <div className="dest-meta">Noise + echo removal, auto-gain, and a gentle voice compressor. Turn off if you use a pro mic/interface.</div>
                </div>
                <label className="toggle"><input type="checkbox" checked={broadcast.micEnhance} onChange={(e) => { broadcast.setMicEnhance(e.target.checked); force(); }} /><span className="track" /></label>
              </div>
              {(() => {
                const guests = broadcast.roster.filter((p) => p.sessionId && broadcast.admitted.has(p.sessionId) && p.hasAudio);
                if (guests.length === 0) return <p className="muted" style={{ fontSize: "13px", marginTop: 10 }}>No guests on air. Admit a guest (Guests tab) to set their level.</p>;
                return guests.map((p) => (
                  <div className="dest-row" key={p.id} style={{ alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="dest-name">{p.name}{broadcast.isGuestMuted(p.sessionId!) && <span className="pill draft" style={{ marginLeft: 6 }}>Muted</span>}</div>
                      <div className="dest-meta">guest</div>
                    </div>
                    <input type="range" min={0} max={1.5} step={0.05} value={broadcast.getGuestLevel(p.sessionId!)} disabled={broadcast.isGuestMuted(p.sessionId!)} onChange={(e) => { broadcast.setGuestLevel(p.sessionId!, Number(e.target.value)); force(); }} style={{ width: 150 }} />
                    <span className="dest-meta" style={{ width: 42, textAlign: "right" }}>{Math.round(broadcast.getGuestLevel(p.sessionId!) * 100)}%</span>
                  </div>
                ));
              })()}
              <p className="form-note" style={{ marginTop: 12 }}>100% is normal. Boost a quiet source above 100%, or lower one that&apos;s too loud. Muting is on the Guests tab.</p>
            </div>
          )}

          {tab === "looks" && (
            <div className="panel">
              <h3>Branded scene</h3>
              <div className="panel-sub">Put the host over a background (green-screen), with a frame + logo - a TV-broadcast look. The Program preview updates live.</div>
              <input ref={sceneBgInput} type="file" accept="image/*" hidden onChange={(e) => pickSceneImg(e, "background")} />
              <input ref={sceneFrameInput} type="file" accept="image/*" hidden onChange={(e) => pickSceneImg(e, "frame")} />
              <input ref={sceneLogoInput} type="file" accept="image/*" hidden onChange={(e) => pickSceneImg(e, "logo")} />

              <div className="dest-row">
                <div><div className="dest-name">Enable scene</div><div className="dest-meta">Overrides the normal camera view</div></div>
                <label className="toggle"><input type="checkbox" checked={scene.enabled} onChange={(e) => updateScene({ enabled: e.target.checked })} /><span className="track" /></label>
              </div>

              <div className="form-field" style={{ marginTop: 12 }}>
                <label>Camera placement</label>
                <div className="filters" style={{ margin: 0 }}>
                  {CAM_PRESETS.map(([label, box]) => {
                    const active = Math.abs(scene.camBox.x - box.x) < 0.02 && Math.abs(scene.camBox.y - box.y) < 0.02 && Math.abs(scene.camBox.w - box.w) < 0.02 && Math.abs(scene.camBox.h - box.h) < 0.02;
                    return <button key={label} type="button" className={`filter-btn${active ? " active" : ""}`} onClick={() => updateCamBox(box)}>{label}</button>;
                  })}
                </div>
                <p className="form-note" style={{ marginTop: 6 }}>Pick a starting point, then fine-tune the exact position and size below. Leave room for a branded overlay (upload it as the Frame below), like a talk-show layout.</p>
                {/* Free position + size. Values are % of the frame; the engine keeps the box on-screen. */}
                <div className="cam-sliders">
                  {([["x", "Left", 0, 100], ["y", "Top", 0, 100], ["w", "Width", 10, 100], ["h", "Height", 10, 100]] as [keyof CamBox, string, number, number][]).map(([k, label, min, max]) => (
                    <div className="cam-slider" key={k}>
                      <span className="dest-meta" style={{ width: 54 }}>{label}</span>
                      <input type="range" min={min} max={max} step={1} value={Math.round(scene.camBox[k] * 100)} onChange={(e) => updateCamBox({ [k]: Number(e.target.value) / 100 } as Partial<CamBox>)} style={{ flex: 1 }} />
                      <span className="dest-meta" style={{ width: 42, textAlign: "right" }}>{Math.round(scene.camBox[k] * 100)}%</span>
                    </div>
                  ))}
                </div>
                <button className="btn btn-ghost btn-sm" type="button" style={{ marginTop: 8 }} onClick={() => updateCamBox({ x: 0, y: 0, w: 1, h: 1 })}>Reset to full frame</button>
              </div>

              <div className="form-field" style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                <label>Show layout extras</label>
                <div className="dest-row">
                  <div><div className="dest-name">Side panel</div><div className="dest-meta">Branded panel in the gap beside a side-windowed camera (placeholder until you upload a Frame)</div></div>
                  <label className="toggle"><input type="checkbox" checked={scene.panelOn} onChange={(e) => { const on = e.target.checked; const full = scene.camBox.x < 0.01 && scene.camBox.y < 0.01 && scene.camBox.w > 0.99 && scene.camBox.h > 0.99; if (on && full) updateCamBox({ x: 0.40, y: 0, w: 0.60, h: 1 }); updateScene({ panelOn: on }); }} /><span className="track" /></label>
                </div>
                {scene.panelOn && (
                  <>
                    <input ref={panelImgInput} type="file" accept="image/*" hidden onChange={(e) => pickSceneImg(e, "panel")} />
                    <div className="scene-up" style={{ marginTop: 8 }}>
                      <div className="scene-prev logo" style={scene.panelImage ? { backgroundImage: `url(${scene.panelImage})` } : undefined}>{!scene.panelImage && "Panel image"}</div>
                      <div className="scene-up-btns">
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => panelImgInput.current?.click()}>{scene.panelImage ? "Change image" : "Upload image"}</button>
                        {scene.panelImage && <button className="btn btn-ghost btn-sm" type="button" onClick={() => updateScene({ panelImage: "" })}>Clear</button>}
                      </div>
                    </div>
                    <input type="text" value={scene.panelTitle} maxLength={48} placeholder="Show title (e.g. CANES TALK LIVE)" onChange={(e) => updateScene({ panelTitle: e.target.value })} style={{ marginTop: 8 }} />
                    <p className="form-note" style={{ marginTop: 6 }}>The panel shows this image (any logo/graphic) above the title. No image = your site logo is used. Transparent PNGs look best.</p>
                    {!(scene.camBox.x >= 0.25 || scene.camBox.x + scene.camBox.w <= 0.75) && (
                      <p className="form-note" style={{ marginTop: 6, color: "var(--live)" }}>Camera is full-frame - there's no gap for the panel. Pick <strong>Right side</strong> or <strong>Left side</strong> above.</p>
                    )}
                  </>
                )}

                <div className="dest-row" style={{ marginTop: 6 }}>
                  <div><div className="dest-name">Supporters ticker</div><div className="dest-meta">Scrolling list of recent tips along the bottom (real tips only)</div></div>
                  <label className="toggle"><input type="checkbox" checked={scene.supportersOn} onChange={(e) => updateScene({ supportersOn: e.target.checked })} /><span className="track" /></label>
                </div>

                <div className="dest-row" style={{ marginTop: 6 }}>
                  <div><div className="dest-name">Custom ticker</div><div className="dest-meta">Scroll your own text along the bottom - phone #, sponsors, promos</div></div>
                  <label className="toggle"><input type="checkbox" checked={scene.tickerOn} onChange={(e) => updateScene({ tickerOn: e.target.checked })} /><span className="track" /></label>
                </div>
                {scene.tickerOn && (
                  <>
                    <div className="form-field" style={{ marginTop: 8 }}>
                      <label>Label (optional)</label>
                      <input type="text" value={scene.tickerLabel} maxLength={40} placeholder="e.g. COACH HAYES" onChange={(e) => updateScene({ tickerLabel: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label>Messages (one per line)</label>
                      <textarea rows={3} value={scene.ticker} maxLength={2000} placeholder={"Call in: 862-799-9956\nMerch 10% off - code TIMMY10\nFollow @coachhayes"} onChange={(e) => updateScene({ ticker: e.target.value })} />
                    </div>
                  </>
                )}

                <div className="dest-row" style={{ marginTop: 6 }}>
                  <div><div className="dest-name">Show clock</div><div className="dest-meta">Elapsed count-up timer, top-left</div></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {scene.clockOn && <button className="btn btn-ghost btn-sm" type="button" onClick={() => broadcast.resetClock()}>Reset</button>}
                    <label className="toggle"><input type="checkbox" checked={scene.clockOn} onChange={(e) => updateScene({ clockOn: e.target.checked })} /><span className="track" /></label>
                  </div>
                </div>

                {/* Free image overlay: add any graphic and place/size it anywhere. */}
                <input ref={overlayImgInput} type="file" accept="image/*" hidden onChange={(e) => pickSceneImg(e, "overlay")} />
                <div className="dest-row" style={{ marginTop: 6 }}>
                  <div><div className="dest-name">Image overlay</div><div className="dest-meta">Drop any image on the screen, then place + size it freely (logo, sponsor, player)</div></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => overlayImgInput.current?.click()}>{scene.overlayImage ? "Change" : "Add image"}</button>
                    {scene.overlayImage && <button className="btn btn-ghost btn-sm" type="button" onClick={() => updateScene({ overlayImage: "" })}>Remove</button>}
                  </div>
                </div>
                {scene.overlayImage && (
                  <div className="cam-sliders" style={{ marginTop: 8 }}>
                    {([["x", "Left", 0, 100], ["y", "Top", 0, 100], ["w", "Size", 5, 100]] as [keyof OverlayBox, string, number, number][]).map(([k, label, min, max]) => (
                      <div className="cam-slider" key={k}>
                        <span className="dest-meta" style={{ width: 54 }}>{label}</span>
                        <input type="range" min={min} max={max} step={1} value={Math.round(scene.overlayBox[k] * 100)} onChange={(e) => updateOverlayBox({ [k]: Number(e.target.value) / 100 } as Partial<OverlayBox>)} style={{ flex: 1 }} />
                        <span className="dest-meta" style={{ width: 42, textAlign: "right" }}>{Math.round(scene.overlayBox[k] * 100)}%</span>
                      </div>
                    ))}
                  </div>
                )}

                <p className="form-note" style={{ marginTop: 8 }}>Supporters, custom ticker, clock and image overlay show in any scene; the side panel needs the camera windowed to a side. If both tickers are on, your custom text sits above the supporters list. Click <strong>Save scene</strong> to keep these.</p>
              </div>

              <div className="form-field" style={{ marginTop: 12 }}>
                <label>Background removal</label>
                <select value={scene.mode} onChange={(e) => updateScene({ mode: e.target.value as SceneCfg["mode"] })}>
                  <option value="none">None (host fills the frame)</option>
                  <option value="ml">AI virtual background (no green screen)</option>
                  <option value="chroma">Green screen (chroma key)</option>
                </select>
              </div>

              {scene.mode === "ml" && (
                <p className="form-note" style={{ marginTop: -4, marginBottom: 8 }}>In-browser AI removes your background - no green screen. First time, give it a few seconds to load the model, then upload a background below.</p>
              )}
              {scene.mode === "chroma" && (
                <div className="form-field">
                  <label>Green-screen color</label>
                  <div className="color-row">
                    <input type="color" value={scene.chroma} onChange={(e) => updateScene({ chroma: e.target.value })} />
                    <input type="text" value={scene.chroma} onChange={(e) => updateScene({ chroma: e.target.value })} />
                  </div>
                </div>
              )}

              <div className="scene-uploads">
                <div className="scene-up">
                  <div className="scene-prev" style={scene.background ? { backgroundImage: `url(${scene.background})` } : undefined}>{!scene.background && "Background"}</div>
                  <div className="scene-up-btns">
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => sceneBgInput.current?.click()}>{scene.background ? "Change" : "Upload"}</button>
                    {scene.background && <button className="btn btn-ghost btn-sm" type="button" onClick={() => updateScene({ background: "" })}>Clear</button>}
                  </div>
                </div>
                <div className="scene-up">
                  <div className="scene-prev" style={scene.frame ? { backgroundImage: `url(${scene.frame})` } : undefined}>{!scene.frame && "Frame"}</div>
                  <div className="scene-up-btns">
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => sceneFrameInput.current?.click()}>{scene.frame ? "Change" : "Upload"}</button>
                    {scene.frame && <button className="btn btn-ghost btn-sm" type="button" onClick={() => updateScene({ frame: "" })}>Clear</button>}
                  </div>
                </div>
                <div className="scene-up">
                  <div className="scene-prev logo" style={scene.logo ? { backgroundImage: `url(${scene.logo})` } : undefined}>{!scene.logo && "Logo"}</div>
                  <div className="scene-up-btns">
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => sceneLogoInput.current?.click()}>{scene.logo ? "Change" : "Upload"}</button>
                    {scene.logo && <button className="btn btn-ghost btn-sm" type="button" onClick={() => updateScene({ logo: "" })}>Clear</button>}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16 }}>
                <button className="btn btn-primary btn-sm" type="button" onClick={saveScene}>Save scene</button>
                {sceneMsg && <span className="form-ok" style={{ margin: 0 }}>{sceneMsg}</span>}
              </div>
              <p className="form-note" style={{ marginTop: 12 }}>Frame should be a transparent 16:9 PNG. For green-screen, light the screen evenly and pick the exact green.</p>
            </div>
          )}

          {tab === "rundown" && (
            <div className="panel">
              <input ref={rundownInput} type="file" accept="image/*" hidden onChange={pickRundownImg} />
              <h3>Rundown</h3>
              <div className="panel-sub">A PTI-style topic list down the right side of the broadcast. The current topic is highlighted and its image shows at the top. Click <strong>Set live</strong> on a topic to move to it.</div>

              <div className="dest-row">
                <div><div className="dest-name">Show rundown</div><div className="dest-meta">Overlays the topic rail on the broadcast</div></div>
                <label className="toggle"><input type="checkbox" checked={rundown.enabled} onChange={(e) => updateRundown({ enabled: e.target.checked })} /><span className="track" /></label>
              </div>

              <div className="panel-split">
                <div className="form-field"><label>Header label</label><input type="text" value={rundown.title} maxLength={24} placeholder="RUNDOWN" onChange={(e) => updateRundown({ title: e.target.value })} /></div>
                <div className="form-field">
                  <label>On-topic timer</label>
                  <label className="toggle" style={{ marginTop: 6 }}><input type="checkbox" checked={rundown.showTimer} onChange={(e) => updateRundown({ showTimer: e.target.checked })} /><span className="track" /></label>
                </div>
              </div>

              <div className="rundown-list">
                {rundown.items.map((it, i) => (
                  <div key={i} className={`rundown-row${i === rundown.activeIndex ? " active" : ""}`}>
                    <div className="rundown-thumb" style={it.image ? { backgroundImage: `url(${it.image})` } : undefined}>{!it.image && "No image"}</div>
                    <div className="rundown-fields">
                      <input type="text" value={it.title} maxLength={40} placeholder={`Topic ${i + 1}`} onChange={(e) => updateRundownItem(i, { title: e.target.value })} />
                      <div className="rundown-len">
                        <label>Length</label>
                        <input
                          type="text"
                          key={`len-${i}-${it.seconds}`}
                          defaultValue={formatClock(it.seconds)}
                          placeholder="m:ss (blank = count up)"
                          onBlur={(e) => updateRundownItem(i, { seconds: parseClock(e.target.value) })}
                        />
                      </div>
                      <div className="rundown-btns">
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => { rundownFileIdx.current = i; rundownInput.current?.click(); }}>{it.image ? "Change image" : "Add image"}</button>
                        {it.image && <button className="btn btn-ghost btn-sm" type="button" onClick={() => updateRundownItem(i, { image: "" })}>Clear</button>}
                        <button className={`btn btn-sm ${i === rundown.activeIndex ? "btn-primary" : "btn-ghost"}`} type="button" onClick={() => setRundownActive(i)}>{i === rundown.activeIndex ? "Live" : "Set live"}</button>
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => removeRundownItem(i)}>Remove</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button className="btn btn-ghost btn-sm" type="button" onClick={addRundownItem} style={{ marginTop: 12 }}>Add topic</button>

              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16 }}>
                <button className="btn btn-primary btn-sm" type="button" onClick={saveRundown}>Save rundown</button>
                {rundownMsg && <span className="form-ok" style={{ margin: 0 }}>{rundownMsg}</span>}
              </div>
              <p className="form-note" style={{ marginTop: 12 }}>Images look best around 16:9 (a headshot or logo per topic). Set a <strong>Length</strong> to count down (turns red in the last 10s, then counts up in red as <strong>+m:ss</strong> overtime). Leave Length blank to just count up. The clock resets when you set a new topic live.</p>
            </div>
          )}

          {tab === "looks" && (
            <div className="panel">
              <h3>Intro / starting-soon screen</h3>
              <div className="panel-sub">A branded holding screen that goes out on the broadcast before your show starts, so early viewers see something professional instead of a cold open. The Program preview updates live.</div>
              <input ref={bumperBgInput} type="file" accept="image/*" hidden onChange={pickBumperBg} />

              <div className="dest-row">
                <div><div className="dest-name">Show the starting-soon screen on air</div><div className="dest-meta">The program feed shows the bumper instead of the camera</div></div>
                <label className="toggle"><input type="checkbox" checked={bumper.enabled} onChange={(e) => updateBumper({ enabled: e.target.checked })} /><span className="track" /></label>
              </div>

              <div className="form-field" style={{ marginTop: 12 }}>
                <label>Mode</label>
                <select value={bumper.mode} onChange={(e) => updateBumper({ mode: e.target.value as BumperCfg["mode"] })}>
                  <option value="card">Starting-soon card</option>
                  <option value="video">Intro video</option>
                </select>
              </div>

              <div className="form-field"><label>Headline</label><input type="text" value={bumper.headline} maxLength={80} placeholder="Starting soon" onChange={(e) => updateBumper({ headline: e.target.value })} /></div>
              <div className="form-field"><label>Subtext (optional)</label><input type="text" value={bumper.subtext} maxLength={160} placeholder="The show begins shortly - stay tuned." onChange={(e) => updateBumper({ subtext: e.target.value })} /></div>

              {bumper.mode === "card" && (
                <div className="scene-uploads">
                  <div className="scene-up">
                    <div className="scene-prev" style={bumper.background ? { backgroundImage: `url(${bumper.background})` } : undefined}>{!bumper.background && "Background"}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => bumperBgInput.current?.click()}>{bumper.background ? "Change" : "Upload"}</button>
                      {bumper.background && <button className="btn btn-ghost btn-sm" type="button" onClick={() => updateBumper({ background: "" })}>Clear</button>}
                    </div>
                  </div>
                </div>
              )}

              {bumper.mode === "video" && (
                <div className="form-field">
                  <label>Intro video</label>
                  <input ref={bumperVideoInput} type="file" accept="video/*" hidden onChange={uploadIntroVideo} />
                  <input ref={bumperLocalInput} type="file" accept="video/*" hidden onChange={pickIntroLocal} />
                  <div className="scene-uploads">
                    <div className="scene-up">
                      <div className="scene-prev">
                        {bumper.videoUrl
                          ? <video src={bumper.videoUrl} muted loop playsInline autoPlay style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
                          : "No video"}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button className="btn btn-primary btn-sm" type="button" disabled={introUp.busy} onClick={() => bumperLocalInput.current?.click()}>
                          {bumper.videoUrl ? "Replace (this device)" : "Use a file from this device"}
                        </button>
                        <button className="btn btn-ghost btn-sm" type="button" disabled={introUp.busy} onClick={() => bumperVideoInput.current?.click()}>
                          {introUp.busy ? "Working..." : "Upload to Cloudflare (keeps it)"}
                        </button>
                        {bumper.videoUrl && !introUp.busy && <button className="btn btn-ghost btn-sm" type="button" onClick={() => { if (bumper.videoUrl.startsWith("blob:")) { try { URL.revokeObjectURL(bumper.videoUrl); } catch {} } updateBumper({ videoUrl: "" }); }}>Clear</button>}
                      </div>
                    </div>
                  </div>
                  {introUp.msg && <p className={/fail|could ?n.?t|timed out|exceed|quota|capacity|storage|not connected|error|unable/i.test(introUp.msg) ? "form-error" : "form-note"} style={{ marginTop: 8 }}>{introUp.msg}</p>}
                  <p className="form-note" style={{ marginTop: 6 }}><b>From this device</b> is free and instant - the clip is composited locally and goes out on your broadcast, but it only lives in this browser tab (a reload clears it). <b>Upload to Cloudflare</b> stores it so it survives reloads and works from any device - that uses Cloudflare Stream storage, which is a paid add-on (why uploads need minutes on the account).</p>
                  <details style={{ marginTop: 8 }}>
                    <summary className="form-note" style={{ cursor: "pointer" }}>Advanced: paste a video URL instead</summary>
                    <input type="text" value={bumper.videoUrl} maxLength={500} placeholder="https://.../video.mp4" style={{ marginTop: 8 }} onChange={(e) => updateBumper({ videoUrl: e.target.value })} />
                    <p className="form-note" style={{ marginTop: 6 }}>Only CORS-enabled MP4 links play in the broadcast. Uploading above handles this for you.</p>
                  </details>
                </div>
              )}

              <div className="dest-row" style={{ marginTop: 18 }}>
                <div><div className="dest-name">Count down to the next scheduled show</div><div className="dest-meta">Shows a live "Starting in..." timer{bumper.startsAt > 0 ? " (set)" : ""}</div></div>
                <label className="toggle"><input type="checkbox" checked={bumper.startsAt > 0} onChange={(e) => toggleCountdown(e.target.checked)} /><span className="track" /></label>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16 }}>
                <button className="btn btn-primary btn-sm" type="button" onClick={saveBumper}>Save intro</button>
                {bumperMsg && <span className="form-ok" style={{ margin: 0 }}>{bumperMsg}</span>}
              </div>
              <p className="form-note" style={{ marginTop: 12 }}>Turn this on before you go live, then turn it off to reveal the show. The card mode is always safe; the video mode needs a CORS-enabled URL.</p>
            </div>
          )}

          {tab === "media" && (
            <div className="panel">
              <input ref={mediaInput} type="file" accept="video/*,audio/*" hidden onChange={pickMedia} />
              <h3>Media</h3>
              <div className="panel-sub">Play a video or music file into your live broadcast. A video fills the screen while it plays; a music file plays over your current camera. Use the level slider to balance it against your mic.</div>
              <div className="notice" style={{ marginTop: 8 }}><strong>Want your face over the video?</strong> Turn on a <strong>Branded scene</strong> (Looks tab) with <strong>Background removal</strong> (AI or green screen). The playing video then becomes your scene background and your camera composites on top of it.</div>
              {!broadcast.mediaPlaying ? (
                <button className="btn btn-primary btn-sm" type="button" onClick={() => mediaInput.current?.click()}>Choose file to play</button>
              ) : (
                <>
                  <div className="dest-row">
                    <div><div className="dest-name">Now playing</div><div className="dest-meta">{broadcast.mediaName}{broadcast.mediaHasVideo ? " - video" : " - audio"}</div></div>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => { broadcast.stopMedia(); force(); }}>Stop</button>
                  </div>
                  <div className="dest-row" style={{ marginTop: 6 }}>
                    <div><div className="dest-name">Media level</div><div className="dest-meta">How loud the media is in the broadcast</div></div>
                    <input type="range" min={0} max={1.5} step={0.05} value={broadcast.mediaLevel} onChange={(e) => { broadcast.setMediaLevel(Number(e.target.value)); force(); }} style={{ width: 150 }} />
                  </div>
                </>
              )}
              <p className="form-note" style={{ marginTop: 12 }}>The media audio goes out to your viewers (not your own speakers) to avoid mic echo - watch the Program preview to follow along. Playback starts right away; press Stop to return to the camera.</p>

              <div style={{ marginTop: 20, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
                <h3 style={{ marginTop: 0 }}>Instant replay</h3>
                <div className="panel-sub">Keeps a rolling buffer of roughly the last 30-40 seconds. Roll it back on-air or save it as a clip (great for Shorts). Turn it on before the moment you want to catch.</div>
                {!broadcast.replayActive ? (
                  <button className="btn btn-primary btn-sm" type="button" onClick={() => { broadcast.startReplayBuffer(); force(); }}>Start replay buffer</button>
                ) : (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <button className="btn btn-primary btn-sm" type="button" onClick={() => broadcast.replayNow()}>Replay last ~30s</button>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => broadcast.saveClip()}>Save clip</button>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => { broadcast.stopReplayBuffer(); force(); }}>Stop buffer</button>
                    <span className="pill published">Buffering</span>
                  </div>
                )}
                <p className="form-note" style={{ marginTop: 10 }}>Replay runs separately from your live stream, so it can&apos;t affect broadcast quality. It uses extra CPU while on - start it when you need it. Clip length lands around 20-40s.</p>
              </div>

              <div style={{ marginTop: 20, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
                <h3 style={{ marginTop: 0 }}>Vertical recording (Shorts)</h3>
                <div className="panel-sub">Records a 9:16 vertical version of your program (center-cropped) to a file - ready for Shorts, TikTok, and Reels. Runs separately from the live stream.</div>
                {!broadcast.verticalRecording ? (
                  <button className="btn btn-primary btn-sm" type="button" onClick={() => { broadcast.startVerticalRecording(); force(); }}>Start vertical recording</button>
                ) : (
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => { broadcast.stopVerticalRecording(); force(); }}><span className="rec-dot" />Stop &amp; save vertical</button>
                )}
                <p className="form-note" style={{ marginTop: 10 }}>Keep your subject centered for the best vertical crop. The file downloads when you stop.</p>
              </div>
            </div>
          )}

          {tab === "sounds" && (
            <div className="panel">
              <h3>Soundboard</h3>
              <div className="panel-sub">Tap a pad to fire a sound effect. It goes out on the broadcast (viewers hear it) and in your monitor. You can add several pads.</div>
              <input ref={soundInput} type="file" accept="audio/*" hidden onChange={pickSound} />

              {sounds.length === 0 ? (
                <p className="muted" style={{ fontSize: "13px" }}>No pads yet. Add a sound below.</p>
              ) : (
                <div className="sound-grid">
                  {sounds.map((p) => (
                    <div className={`sound-pad${pressed === p.id ? " pressed" : ""}`} key={p.id} role="button" tabIndex={0}
                      onClick={() => tapPad(p.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tapPad(p.id); } }}>
                      <button className="sound-x" type="button" title="Remove pad" onClick={(e) => { e.stopPropagation(); removeSound(p.id); }}>×</button>
                      <span className="sound-label">{p.label}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => broadcast.stopSounds()}>Stop all</button>
              </div>

              <div className="panel-sub" style={{ marginTop: 22 }}>Add a sound</div>
              <div className="form-field"><label>Label</label><input type="text" value={soundLabel} maxLength={30} placeholder="Airhorn" onChange={(e) => setSoundLabel(e.target.value)} /></div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button className="btn btn-primary btn-sm" type="button" onClick={() => soundInput.current?.click()}>Choose audio file</button>
                {soundMsg && <span className="form-ok" style={{ margin: 0 }}>{soundMsg}</span>}
              </div>
              <p className="form-note" style={{ marginTop: 12 }}>Short clips only (under ~240KB) so they load instantly and stay under the storage limit. Up to 12 pads.</p>
            </div>
          )}

          {tab === "destinations" && (
            <>
              <div className="panel">
                <h3>How site viewers watch</h3>
                <div className="panel-sub">Choose the player your live page uses. This is a cost/quality trade-off.</div>
                <div className="filters" style={{ margin: "0 0 8px" }}>
                  <button type="button" className={`filter-btn${liveDelivery === "own" ? " active" : ""}`} onClick={() => saveDelivery("own")}>Own player &middot; paid</button>
                  <button type="button" className={`filter-btn${liveDelivery === "youtube" ? " active" : ""}`} onClick={() => saveDelivery("youtube")}>YouTube embed &middot; free</button>
                </div>
                <p className="form-note" style={{ margin: 0 }}>
                  {liveDelivery === "youtube"
                    ? "Your live page shows YouTube's player - unlimited viewers cost $0. Best for large audiences (you keep the branded site; YouTube pays the bandwidth)."
                    : "Your live page uses your own low-latency player - you pay ~$0.001 per on-site viewer-minute. Best for smaller/loyal audiences + tips."}
                </p>
                <div className="deliver-row" style={{ marginTop: 14 }}>
                  <span className="deliver-label">See the stream</span>
                  <div className="filters" style={{ margin: 0 }}>
                    <a className="filter-btn" href="/live" target="_blank" rel="noreferrer">Watch on website</a>
                    <a className="filter-btn" href={`https://www.youtube.com/channel/${ytChannelId}/live`} target="_blank" rel="noreferrer">Watch on YouTube</a>
                  </div>
                </div>
              </div>
              <SimulcastManager />
              <div className="panel">
              <h3>OBS - optional pro mode</h3>
              <div className="panel-sub">Only if you want to stream from OBS instead of the browser. Paste into OBS -&gt; Settings -&gt; Stream (Custom).</div>
              {ingest ? (
                <>
                  <label className="form-note" style={{ marginBottom: 6, display: "block" }}>Server (RTMPS)</label>
                  <div className="copybox" style={{ marginBottom: 14 }}><input type="text" readOnly value={ingest.rtmpsUrl} /><button className="btn btn-ghost btn-sm" type="button" onClick={() => navigator.clipboard?.writeText(ingest.rtmpsUrl)}>Copy</button></div>
                  <label className="form-note" style={{ marginBottom: 6, display: "block" }}>Stream key</label>
                  <div className="copybox"><input type={reveal ? "text" : "password"} readOnly value={ingest.streamKey} /><button className="btn btn-ghost btn-sm" type="button" onClick={() => setReveal((v) => !v)}>{reveal ? "Hide" : "Show"}</button><button className="btn btn-ghost btn-sm" type="button" onClick={() => navigator.clipboard?.writeText(ingest.streamKey)}>Copy</button></div>
                </>
              ) : <p className="muted" style={{ fontSize: "13.5px" }}>Connect Cloudflare Stream to get your OBS keys.</p>}
              </div>
            </>
          )}
        </div>
      </div>
      <aside className="cr-chat">
            <div className="panel">
              <h3 style={{ margin: 0 }}>Live chat</h3>
              <div className="panel-sub" style={{ marginBottom: 10 }}>Site + YouTube, merged.</div>
              <div className="cr-chatfilters">
                {([["all", "All"], ["members", "Members"], ["tips", "Tips"]] as ["all" | "members" | "tips", string][]).map(([k, label]) => (
                  <button key={k} type="button" className={`cr-cf${chatFilter === k ? " on" : ""}`} onClick={() => setChatFilter(k)}>{label}</button>
                ))}
              </div>
              {modMsg && <p className="form-ok" style={{ fontSize: "12.5px", marginBottom: 8 }}>{modMsg}</p>}
              <div className="cr-msgs">
                {chat.length === 0 && <p className="muted" style={{ fontSize: "13px" }}>No messages yet.</p>}
                {chat.filter((m) => chatFilter === "all" || (chatFilter === "members" && !!m.uid) || (chatFilter === "tips" && !!m.tip)).map((m) => {
                  const pinned = isPinned(m);
                  return (
                    <div className="mod-row cr-msg" key={m.id}>
                      <div className={`msg${m.tip ? " tipmsg" : ""}`} style={{ minWidth: 0 }}>
                        {m.tip ? <><span className="tipamt">${m.tip.toFixed(2)}</span><b>{m.name}</b>{m.text ? <span> {m.text}</span> : null}</> : <>{srcBadge(m.source, siteLogo)}<b>{m.name}</b> {linkify(m.text)}</>}
                      </div>
                      <div className="mod-actions">
                        {m.text && (
                          <button className={`cr-pin${pinned ? " on" : ""}`} type="button" title={pinned ? "Unpin from broadcast" : "Pin to broadcast"} onClick={() => (pinned ? unpin() : pin(m))}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 4h6l-1 6 3 3H7l3-3-1-6zM12 16v4" /></svg>{pinned ? "Pinned" : "Pin"}
                          </button>
                        )}
                        {m.uid && <>
                          <button className="btn btn-ghost btn-xs" type="button" title="Timeout for a set time" onClick={() => setTimeoutFor(m)}>Timeout</button>
                          <button className="btn btn-ghost btn-xs" type="button" title="Remove from chat" onClick={() => moderate("ban", m)}>Ban</button>
                        </>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Host posts into the chat (links become clickable for viewers). */}
              <form onSubmit={(e) => { e.preventDefault(); sendChat(); }} style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <input type="text" value={chatDraft} onChange={(e) => setChatDraft(e.target.value)} placeholder="Chat with the show - paste links here" maxLength={500} style={{ flex: 1, background: "var(--bg2)", border: "1px solid var(--line)", color: "var(--cream)", borderRadius: 8, padding: "9px 12px", font: "inherit", fontSize: 13 }} />
                <button className="btn btn-primary btn-sm" type="submit" disabled={!chatDraft.trim()}>Send</button>
              </form>

              {timeoutFor && (
                <div className="modal-backdrop" onClick={() => setTimeoutFor(null)}>
                  <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                    <h3 style={{ marginTop: 0 }}>Timeout {timeoutFor.name}</h3>
                    <div className="panel-sub">They can still watch, but can&apos;t chat until the timeout ends.</div>
                    <div className="filters" style={{ marginTop: 14, marginBottom: 0 }}>
                      {([["1 min", 60], ["5 min", 300], ["15 min", 900], ["1 hour", 3600], ["24 hours", 86400]] as [string, number][]).map(([label, secs]) => (
                        <button key={secs} type="button" className="filter-btn" onClick={() => { moderate("timeout", timeoutFor, secs); setTimeoutFor(null); }}>{label}</button>
                      ))}
                    </div>
                    <div className="form-field" style={{ marginTop: 14 }}>
                      <label>Custom (minutes)</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input type="number" min={1} max={1440} value={customMin} onChange={(e) => setCustomMin(e.target.value)} />
                        <button className="btn btn-primary btn-sm" type="button" onClick={() => { const s = Math.max(1, Math.min(1440, Number(customMin) || 10)) * 60; moderate("timeout", timeoutFor, s); setTimeoutFor(null); }}>Apply</button>
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} type="button" onClick={() => setTimeoutFor(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
      </aside>
      </div>
    </>
  );
}
