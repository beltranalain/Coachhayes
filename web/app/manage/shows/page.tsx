"use client";

import { useEffect, useRef, useState } from "react";
import Shell from "@/components/hayes/admin/Shell";
import { getIdToken } from "@/lib/firebase";
import type { Series } from "@/lib/siteData";

// Shows — the REAL editable series shown across the public site (home tiles,
// Shows page, and the community shows strip). Saved to /api/site-config
// (section "content", field "series"). Each show can carry a thumbnail photo.
// Gradient art wells (mirror .a1–.a5 from the public stylesheet, inlined so they
// render inside the admin scope which doesn't load hayes-ds.css).
const GRAD: Record<string, string> = {
  a1: "linear-gradient(140deg,#E8342A,#7A1410)",
  a2: "linear-gradient(140deg,#0B6BFF,#0A3E96)",
  a3: "linear-gradient(140deg,#34C759,#1C6E33)",
  a4: "linear-gradient(140deg,#FF9F0A,#8A5400)",
  a5: "linear-gradient(140deg,#8E64D0,#452F66)",
};
const ART = Object.keys(GRAD);
const blankShow = (): Series => ({ key: `show-${Math.random().toString(36).slice(2, 8)}`, title: "", tag: "", badge: "", blurb: "", href: "/live", by: "", category: "", art: "a1", image: "", visible: true, video: "" });

// Crop editor geometry. The Shows page renders 16:9 tiles, so we crop to 16:9 -
// the admin preview + export match that exactly (WYSIWYG). Circle/tall surfaces
// then just trim the sides of the 16:9, keeping the centered subject visible.
const PW = 320, PH = 180; // on-screen crop viewport (16:9)
const OW = 640, OH = 360; // exported thumbnail (16:9)

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject; r.readAsDataURL(file);
  });
}

// Encode a canvas as a JPEG data URL under the inline-size cap (several photos
// share the single site-config doc, which has Firestore's 1MB limit).
function canvasToThumb(c: HTMLCanvasElement): string {
  let q = 0.82, out = c.toDataURL("image/jpeg", q);
  while (out.length > 130_000 && q > 0.4) { q -= 0.12; out = c.toDataURL("image/jpeg", q); }
  return out;
}

export default function ShowsPage() {
  const [brand, setBrand] = useState({ name: "Coach Hayes Football", logo: "" });
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});
  // Crop editor: which show we're cropping, the source image, and the pan/zoom.
  const [crop, setCrop] = useState<null | { i: number; natW: number; natH: number; z: number; ox: number; oy: number }>(null);
  const cropImg = useRef<HTMLImageElement | null>(null);
  const cropCanvas = useRef<HTMLCanvasElement | null>(null);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const tok = async (): Promise<Record<string, string>> => { const t = await getIdToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };

  // Keep the image covering the 16:9 viewport (no empty gaps) at the given zoom.
  function clampOffset(ox: number, oy: number, natW: number, natH: number, z: number) {
    const cover = Math.max(PW / natW, PH / natH);
    const dw = natW * cover * z, dh = natH * cover * z;
    return { ox: Math.min(0, Math.max(PW - dw, ox)), oy: Math.min(0, Math.max(PH - dh, oy)) };
  }

  // Redraw the live crop preview whenever pan/zoom changes.
  useEffect(() => {
    if (!crop || !cropImg.current || !cropCanvas.current) return;
    const ctx = cropCanvas.current.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, PW, PH);
    const cover = Math.max(PW / crop.natW, PH / crop.natH);
    ctx.drawImage(cropImg.current, crop.ox, crop.oy, crop.natW * cover * crop.z, crop.natH * cover * crop.z);
  }, [crop]);

  function setZoom(z: number) {
    setCrop((c) => { if (!c) return c; const cl = clampOffset(c.ox, c.oy, c.natW, c.natH, z); return { ...c, z, ...cl }; });
  }
  function onCropPointerDown(e: React.PointerEvent) {
    if (!crop) return; (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, ox: crop.ox, oy: crop.oy };
  }
  function onCropPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    setCrop((c) => { if (!c) return c; const nx = drag.current!.ox + (e.clientX - drag.current!.sx); const ny = drag.current!.oy + (e.clientY - drag.current!.sy); const cl = clampOffset(nx, ny, c.natW, c.natH, c.z); return { ...c, ...cl }; });
  }
  function onCropPointerUp() { drag.current = null; }

  function applyCrop() {
    const img = cropImg.current; if (!crop || !img) return;
    try {
      const out = document.createElement("canvas"); out.width = OW; out.height = OH;
      const octx = out.getContext("2d"); if (!octx) return;
      const rx = OW / PW, ry = OH / PH, cover = Math.max(PW / crop.natW, PH / crop.natH);
      octx.drawImage(img, crop.ox * rx, crop.oy * ry, crop.natW * cover * crop.z * rx, crop.natH * cover * crop.z * ry);
      upd(crop.i, { image: canvasToThumb(out) });
      setStatus("Photo cropped — remember to Save shows.");
      setTimeout(() => setStatus(""), 4000);
    } catch { setStatus("Could not crop that image."); }
    setCrop(null);
  }

  useEffect(() => {
    fetch("/api/site-config", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      if (d?.branding) setBrand({ name: d.branding.siteName || "Coach Hayes Football", logo: d.branding.logo || "" });
      const list = d?.content?.series;
      setSeries(Array.isArray(list) ? list : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const upd = (i: number, part: Partial<Series>) => setSeries((arr) => arr.map((s, j) => (j === i ? { ...s, ...part } : s)));
  const add = () => setSeries((arr) => [...arr, blankShow()]);
  const remove = (i: number) => setSeries((arr) => arr.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => setSeries((arr) => { const j = i + dir; if (j < 0 || j >= arr.length) return arr; const n = [...arr]; [n[i], n[j]] = [n[j], n[i]]; return n; });

  // Open the crop editor for a freshly chosen file, centered to start.
  async function onFile(i: number, f: File) {
    try {
      const src = await readDataUrl(f);
      const img = new Image();
      img.onload = () => {
        cropImg.current = img;
        const cover = Math.max(PW / img.naturalWidth, PH / img.naturalHeight);
        const dw = img.naturalWidth * cover, dh = img.naturalHeight * cover;
        setCrop({ i, natW: img.naturalWidth, natH: img.naturalHeight, z: 1, ox: (PW - dw) / 2, oy: (PH - dh) / 2 });
      };
      img.onerror = () => setStatus("Could not read that image.");
      img.src = src;
    } catch { setStatus("Could not read that image."); }
  }

  async function save() {
    setSaving(true); setStatus("Saving…");
    try {
      const res = await fetch("/api/site-config", { method: "POST", headers: { "Content-Type": "application/json", ...(await tok()) }, body: JSON.stringify({ section: "content", data: { series } }) });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.saved) {
        // Create/update one community post per visible show (with its video).
        try {
          await fetch("/api/community/sync-shows", { method: "POST", headers: { "Content-Type": "application/json", ...(await tok()) }, body: JSON.stringify({ shows: series, brandName: brand.name, brandLogo: brand.logo }) });
        } catch {}
        setStatus("Saved — live on the site, and posted to the community.");
      }
      else if (d.demo) setStatus("Preview only — Firebase not connected.");
      else setStatus(`Save failed (${res.status}${d.error ? ": " + d.error : ""}).`);
    } catch (e: any) { setStatus(`Save failed — ${e?.message || "network error"}.`); } finally { setSaving(false); }
    // Clear only the success message after a bit; leave errors visible so they're not missed.
    setTimeout(() => setStatus((s) => (s.startsWith("Saved") ? "" : s)), 4000);
  }

  const visibleCount = series.filter((s) => s.visible !== false).length;

  return (
    <Shell title="Shows" sub={series.length ? `${series.length} show${series.length === 1 ? "" : "s"} · ${visibleCount} visible` : "The slate that appears across your site"} brandName={brand.name} logo={brand.logo}>
      <div className="card">
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
          <div><h3>Shows</h3><p className="cs" style={{ margin: 0 }}>These series appear on the home page, the Shows page, and the community shows strip. Add a photo to replace the colour gradient.</p></div>
          <button className="btn sm" style={{ marginLeft: "auto" }} onClick={add}>+ Add show</button>
        </div>

        {loading ? (
          <div className="note" style={{ margin: 0 }}>Loading…</div>
        ) : series.length === 0 ? (
          <div className="note" style={{ margin: 0 }}>No shows yet. Add your first show — it appears across the public site once visible.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {series.map((s, i) => (
              <div key={s.key || i} className="showrow" style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 16, alignItems: "start", padding: 14, border: "1px solid var(--hair)", borderRadius: 12 }}>
                {/* Thumbnail */}
                <div style={{ textAlign: "center" }}>
                  <div title="Click to upload a thumbnail photo" onClick={() => fileRefs.current[i]?.click()} style={{ width: 128, height: 72, borderRadius: 10, backgroundSize: "cover", backgroundPosition: "center", border: "2px solid var(--hair)", cursor: "pointer", ...(s.image ? { backgroundImage: `url(${s.image})` } : { backgroundImage: GRAD[s.art] || GRAD.a1 }) }} />
                  <input ref={(el) => { fileRefs.current[i] = el; }} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(i, f); }} />
                  <button className="btn sm" style={{ marginTop: 8, width: "100%" }} onClick={() => fileRefs.current[i]?.click()}>{s.image ? "Change photo" : "Add photo"}</button>
                  {s.image && <button style={linkBtn} onClick={() => upd(i, { image: "" })}>Remove photo</button>}
                </div>

                {/* Fields */}
                <div style={{ display: "grid", gap: 8 }}>
                  <input value={s.title} onChange={(e) => upd(i, { title: e.target.value })} placeholder="Show title (e.g. Canes Talk Live)" style={showInput} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <input value={s.tag} onChange={(e) => upd(i, { tag: e.target.value })} placeholder="Tag (e.g. Live · Wed)" style={showInput} />
                    <input value={(s.category || "").replace(/\n/g, " ")} onChange={(e) => upd(i, { category: e.target.value })} placeholder="Category (e.g. Live Talk)" style={showInput} />
                  </div>
                  <input value={s.href} onChange={(e) => upd(i, { href: e.target.value })} placeholder="Link (e.g. /live)" style={showInput} />
                  <input value={s.blurb} onChange={(e) => upd(i, { blurb: e.target.value })} placeholder="Short blurb (optional)" style={showInput} />
                  <input value={s.video || ""} onChange={(e) => upd(i, { video: e.target.value })} placeholder="YouTube/Hudl video link — plays in the community feed (optional)" style={showInput} />
                  {!s.image && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: "var(--sub)" }}>Gradient:</span>
                      {ART.map((a) => (
                        <button key={a} onClick={() => upd(i, { art: a })} title={a} style={{ width: 22, height: 22, borderRadius: 6, background: GRAD[a], border: s.art === a ? "2px solid var(--acc)" : "2px solid transparent", cursor: "pointer" }} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--sub)", cursor: "pointer" }}>
                    <input type="checkbox" checked={s.visible !== false} onChange={(e) => upd(i, { visible: e.target.checked })} /> Visible
                  </label>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn sm" onClick={() => move(i, -1)} disabled={i === 0} title="Move up">↑</button>
                    <button className="btn sm" onClick={() => move(i, 1)} disabled={i === series.length - 1} title="Move down">↓</button>
                  </div>
                  <button style={{ ...linkBtn, color: "var(--live)" }} onClick={() => remove(i)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18 }}>
          <button className="btn" style={{ background: "var(--acc)", color: "var(--accInk)", padding: "11px 22px", borderRadius: 10, fontWeight: 600 }} onClick={save} disabled={saving}>Save shows</button>
          {status && <span style={{ fontSize: 13, color: status.includes("failed") || status.includes("not") ? "var(--live)" : "var(--green)" }}>{status}</span>}
        </div>
      </div>

      {crop && (
        <div onClick={() => setCrop(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "grid", placeItems: "center", zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--card)", border: "1px solid var(--hair)", borderRadius: 14, padding: 20, width: "min(360px, 92vw)" }}>
            <h3 style={{ margin: "0 0 4px" }}>Crop photo</h3>
            <p className="cs" style={{ margin: "0 0 14px", fontSize: 13, color: "var(--sub)" }}>Drag to position, slide to zoom. This 16:9 frame is exactly what shows on the Shows page.</p>
            <div style={{ position: "relative", width: PW, height: PH, margin: "0 auto", borderRadius: 10, overflow: "hidden", background: "#0b0a09", border: "1px solid var(--hair)", touchAction: "none" }}>
              <canvas ref={cropCanvas} width={PW} height={PH} onPointerDown={onCropPointerDown} onPointerMove={onCropPointerMove} onPointerUp={onCropPointerUp} style={{ cursor: "grab", display: "block" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
              <span style={{ fontSize: 13, color: "var(--sub)" }}>Zoom</span>
              <input type="range" min={1} max={3} step={0.02} value={crop.z} onChange={(e) => setZoom(Number(e.target.value))} style={{ flex: 1 }} />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn sm" onClick={() => setCrop(null)}>Cancel</button>
              <button className="btn" style={{ background: "var(--acc)", color: "var(--accInk)", padding: "9px 18px", borderRadius: 10, fontWeight: 600 }} onClick={applyCrop}>Use photo</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

const showInput: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--hair)", background: "var(--soft)", color: "var(--ink)", fontSize: 13.5 };
const linkBtn: React.CSSProperties = { display: "block", margin: "6px auto 0", fontSize: 12, color: "var(--sub)", background: "none", border: "none", cursor: "pointer" };
