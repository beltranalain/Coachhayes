"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/hayes/admin/Shell";
import { getIdToken } from "@/lib/firebase";
import type { Series } from "@/lib/siteData";

// Shows — curate the coach's YouTube playlists (auto-synced) into the site's
// Shows. Toggle which are visible, reorder them, override the title/blurb — or
// add fully-manual custom shows. New playlists/videos sync automatically.
type Pl = { id: string; title: string; description: string; thumbnail: string; itemCount: number; override: { visible?: boolean; order?: number; title?: string; blurb?: string }; defaultVisible: boolean };
type Row = { id: string; pl: Pl; visible: boolean; title: string; blurb: string };

const blankManual = (): Series => ({ key: `manual-${Date.now().toString(36)}`, title: "", tag: "Series", badge: "", blurb: "", href: "/live", by: "", category: "", art: "a1", image: "", visible: true, video: "" });

export default function ShowsPage() {
  const [brand, setBrand] = useState({ name: "Coach Hayes Football", logo: "" });
  const [rows, setRows] = useState<Row[]>([]);
  const [manual, setManual] = useState<Series[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/site-config", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (d?.branding) setBrand({ name: d.branding.siteName || "Coach Hayes Football", logo: d.branding.logo || "" }); }).catch(() => {});
    fetch("/api/admin/shows", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      setConfigured(d?.configured !== false);
      const pls: Pl[] = Array.isArray(d?.playlists) ? d.playlists : [];
      const ordered = pls
        .map((pl, i) => ({ pl, ord: pl.override?.order ?? i, visible: pl.override?.visible ?? pl.defaultVisible, title: pl.override?.title || "", blurb: pl.override?.blurb || "" }))
        .sort((a, b) => a.ord - b.ord)
        .map((x) => ({ id: x.pl.id, pl: x.pl, visible: x.visible, title: x.title, blurb: x.blurb }));
      setRows(ordered);
      setManual(Array.isArray(d?.manual) ? d.manual : []);
    }).catch(() => setConfigured(false)).finally(() => setLoading(false));
  }, []);

  function patch(id: string, p: Partial<Row>) { setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r))); }
  function move(i: number, dir: -1 | 1) {
    setRows((rs) => { const j = i + dir; if (j < 0 || j >= rs.length) return rs; const c = [...rs]; [c[i], c[j]] = [c[j], c[i]]; return c; });
  }
  function patchManual(i: number, p: Partial<Series>) { setManual((m) => m.map((s, idx) => (idx === i ? { ...s, ...p } : s))); }

  async function save() {
    setSaving(true); setMsg("");
    try {
      const overrides: Record<string, any> = {};
      rows.forEach((r, i) => {
        const o: any = { visible: r.visible, order: i };
        if (r.title.trim()) o.title = r.title.trim();
        if (r.blurb.trim()) o.blurb = r.blurb.trim();
        overrides[r.id] = o;
      });
      const token = await getIdToken();
      const res = await fetch("/api/admin/shows", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ overrides, manual: manual.filter((s) => s.title.trim()) }) });
      const d = await res.json();
      setMsg(d.saved ? "Saved. Your Shows page updates now." : d.error || "Save failed.");
    } catch { setMsg("Save failed."); } finally { setSaving(false); }
  }

  const visibleCount = rows.filter((r) => r.visible).length + manual.filter((s) => s.title.trim() && s.visible !== false).length;

  return (
    <Shell title="Shows" sub={configured ? `${rows.length} playlists · ${visibleCount} visible` : "Curate your series"} brandName={brand.name} logo={brand.logo}>
      {msg && <div className="note" style={{ marginBottom: 14 }}>{msg}</div>}

      <div className="card">
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div><h3>Your shows (from YouTube)</h3><p className="cs" style={{ margin: 0 }}>Your playlists become shows automatically — new playlists and videos sync on their own. Toggle which appear on the site, reorder them, or rename.</p></div>
          <button className="btn acc" style={{ marginLeft: "auto" }} disabled={saving} onClick={save}>{saving ? "Saving…" : "Save changes"}</button>
        </div>

        {loading ? (
          <div className="note" style={{ margin: "16px 0 0" }}>Loading your playlists…</div>
        ) : !configured ? (
          <div className="note" style={{ margin: "16px 0 0", borderLeftColor: "var(--amber)" }}><b>YouTube isn’t connected.</b> Add YOUTUBE_API_KEY to pull your playlists in as shows.</div>
        ) : (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {rows.map((r, i) => (
              <div key={r.id} style={{ display: "grid", gridTemplateColumns: "116px 1fr auto", gap: 14, alignItems: "center", border: "1px solid var(--hair)", borderRadius: 12, padding: 12, opacity: r.visible ? 1 : 0.55 }}>
                <div style={{ aspectRatio: "16/9", borderRadius: 8, backgroundColor: "var(--card)", backgroundImage: `url("${(r.pl.thumbnail || "").replace(/"/g, "%22")}")`, backgroundSize: "cover", backgroundPosition: "center" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
                  <input value={r.title} onChange={(e) => patch(r.id, { title: e.target.value })} placeholder={r.pl.title} />
                  <input value={r.blurb} onChange={(e) => patch(r.id, { blurb: e.target.value })} placeholder={r.pl.description ? r.pl.description.slice(0, 80) : "Short description (optional)"} />
                  <span className="cs" style={{ margin: 0 }}>{r.pl.itemCount} episodes · <a className="link" href={`/shows/${r.id}`} target="_blank" rel="noreferrer">preview ›</a></span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, whiteSpace: "nowrap" }}>
                    <input type="checkbox" checked={r.visible} onChange={(e) => patch(r.id, { visible: e.target.checked })} /> Visible
                  </label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                    <button className="btn sm" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down">↓</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual custom shows */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div><h3>Custom shows</h3><p className="cs" style={{ margin: 0 }}>Hand-made shows that aren’t a YouTube playlist (optional). These show alongside the synced ones.</p></div>
          <button className="btn" onClick={() => setManual((m) => [...m, blankManual()])}>+ Add custom show</button>
        </div>
        {manual.length === 0 ? (
          <div className="note" style={{ margin: "14px 0 0" }}>No custom shows. Your YouTube playlists above cover the series automatically.</div>
        ) : (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {manual.map((s, i) => (
              <div key={s.key} style={{ border: "1px solid var(--hair)", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="row2e" style={{ margin: 0 }}>
                  <div className="fld" style={{ margin: 0 }}><label>Title</label><input value={s.title} onChange={(e) => patchManual(i, { title: e.target.value })} /></div>
                  <div className="fld" style={{ margin: 0 }}><label>Link (page or URL)</label><input value={s.href} onChange={(e) => patchManual(i, { href: e.target.value })} placeholder="/live or https://…" /></div>
                </div>
                <div className="fld" style={{ margin: 0 }}><label>Blurb</label><input value={s.blurb} onChange={(e) => patchManual(i, { blurb: e.target.value })} /></div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}><input type="checkbox" checked={s.visible !== false} onChange={(e) => patchManual(i, { visible: e.target.checked })} /> Visible</label>
                  <button className="btn sm" style={{ marginLeft: "auto", color: "var(--live)" }} onClick={() => setManual((m) => m.filter((_, idx) => idx !== i))}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ textAlign: "right" }}><button className="btn acc" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save changes"}</button></div>
    </Shell>
  );
}
