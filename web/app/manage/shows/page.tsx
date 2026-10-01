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
const blankShow = (): Series => ({ key: `show-${Math.random().toString(36).slice(2, 8)}`, title: "", tag: "", badge: "", blurb: "", href: "/live", by: "", category: "", art: "a1", image: "", visible: true });

// Downscale to a small square-ish thumbnail well under the 200KB inline cap.
function fileToThumb(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 400; let { width: w, height: h } = img;
        if (w > max || h > max) { const s = max / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d")!.drawImage(img, 0, 0, w, h);
        let q = 0.82; let out = c.toDataURL("image/jpeg", q);
        while (out.length > 190_000 && q > 0.4) { q -= 0.12; out = c.toDataURL("image/jpeg", q); }
        resolve(out);
      };
      img.onerror = reject; img.src = String(r.result);
    };
    r.onerror = reject; r.readAsDataURL(file);
  });
}

export default function ShowsPage() {
  const [brand, setBrand] = useState({ name: "Coach Hayes Football", logo: "" });
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const tok = async (): Promise<Record<string, string>> => { const t = await getIdToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };

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

  async function onFile(i: number, f: File) {
    try { const url = await fileToThumb(f); upd(i, { image: url }); } catch { setStatus("Could not read that image."); }
  }

  async function save() {
    setSaving(true); setStatus("Saving…");
    try {
      const res = await fetch("/api/site-config", { method: "POST", headers: { "Content-Type": "application/json", ...(await tok()) }, body: JSON.stringify({ section: "content", data: { series } }) });
      const d = await res.json();
      if (d.saved) setStatus("Saved — live on the site.");
      else if (d.demo) setStatus("Preview only (Firebase not connected).");
      else setStatus(d.error || "Save failed.");
    } catch { setStatus("Save failed."); } finally { setSaving(false); setTimeout(() => setStatus(""), 4000); }
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
                  <div style={{ width: 72, height: 72, borderRadius: "50%", backgroundSize: "cover", backgroundPosition: "center", border: "2px solid var(--hair)", ...(s.image ? { backgroundImage: `url(${s.image})` } : { background: GRAD[s.art] || GRAD.a1 }) }} />
                  <input ref={(el) => { fileRefs.current[i] = el; }} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(i, f); }} />
                  <button className="btn sm" style={{ marginTop: 8, width: "100%" }} onClick={() => fileRefs.current[i]?.click()}>Photo</button>
                  {s.image && <button style={linkBtn} onClick={() => upd(i, { image: "" })}>Remove</button>}
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
    </Shell>
  );
}

const showInput: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--hair)", background: "var(--soft)", color: "var(--ink)", fontSize: 13.5 };
const linkBtn: React.CSSProperties = { display: "block", margin: "6px auto 0", fontSize: 12, color: "var(--sub)", background: "none", border: "none", cursor: "pointer" };
