"use client";

import { useEffect, useRef, useState } from "react";
import { SERIES, DEFAULT_CONTENT, type SiteContent, type Series } from "@/lib/siteData";
import { saveSection, loadConfig } from "@/lib/saveSection";
import PreviewSiteModal from "@/components/PreviewSiteModal";

const ART_OPTIONS = ["a1", "a2", "a3", "a4", "a5", "a6"];

// Resize a picked image to a 600x600 cover portrait (WebP data URL) so it stays
// small enough to store inline in Firestore.
function resizePortrait(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const S = 600;
        const c = document.createElement("canvas"); c.width = S; c.height = S;
        const ctx = c.getContext("2d"); if (!ctx) throw new Error("no ctx");
        const scale = Math.max(S / img.width, S / img.height);
        const dw = img.width * scale, dh = img.height * scale;
        ctx.drawImage(img, (S - dw) / 2, (S - dh) / 2, dw, dh);
        const webp = c.toDataURL("image/webp", 0.82);
        resolve(webp.startsWith("data:image/webp") ? webp : c.toDataURL("image/jpeg", 0.82));
      } catch (e) { reject(e); } finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}

// Resize a picked image to a 16:9 cover thumbnail (WebP data URL) small enough
// to store inline in Firestore, for a series card.
function resizeThumb(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const W = 640, H = 360;
        const c = document.createElement("canvas"); c.width = W; c.height = H;
        const ctx = c.getContext("2d"); if (!ctx) throw new Error("no ctx");
        const scale = Math.max(W / img.width, H / img.height);
        const dw = img.width * scale, dh = img.height * scale;
        ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
        const webp = c.toDataURL("image/webp", 0.82);
        resolve(webp.startsWith("data:image/webp") ? webp : c.toDataURL("image/jpeg", 0.82));
      } catch (e) { reject(e); } finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}

export default function AdminContent() {
  const [form, setForm] = useState<SiteContent>(DEFAULT_CONTENT);
  const thumbInput = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "demo" | "error">("idle");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(false);
  const portraitInput = useRef<HTMLInputElement | null>(null);

  async function pickPortrait(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    try { set("portrait", await resizePortrait(file)); }
    catch { setMessage("Could not read that image."); }
  }

  useEffect(() => {
    loadConfig()
      .then((cfg) => {
        if (cfg?.content) setForm({ ...DEFAULT_CONTENT, ...cfg.content });
        if (Array.isArray(cfg?.channels)) setChannels(cfg.channels.map((c: any) => ({ name: c.name || "", handle: c.handle || "", channelId: c.channelId || "" })));
      })
      .catch(() => {});
  }, []);

  // ---- Connected YouTube channels (add / remove / save) ----
  type ChRow = { name: string; handle: string; channelId: string };
  const [channels, setChannels] = useState<ChRow[]>([]);
  const [chDraft, setChDraft] = useState<ChRow>({ name: "", handle: "", channelId: "" });
  const [chStatus, setChStatus] = useState("");
  function addChannel() {
    const id = chDraft.channelId.trim();
    if (!/^UC[\w-]+$/.test(id)) { setChStatus("Enter a valid Channel ID - it starts with \"UC\"."); return; }
    if (channels.some((c) => c.channelId === id)) { setChStatus("That channel is already added."); return; }
    setChannels([...channels, { name: chDraft.name.trim() || chDraft.handle.trim() || "Channel", handle: chDraft.handle.trim(), channelId: id }]);
    setChDraft({ name: "", handle: "", channelId: "" });
    setChStatus("Added. Click Save channels to publish + sync their videos.");
  }
  function removeChannel(i: number) { setChannels(channels.filter((_, idx) => idx !== i)); }
  async function saveChannels() {
    setChStatus("Saving...");
    try {
      const r = await saveSection("channels", { items: channels });
      setChStatus(r.saved ? "Channels saved. Their videos now sync into the site." : "Preview only - connect Firebase to save.");
    } catch (e: any) { setChStatus(e.message || "Could not save."); }
  }

  function set<K extends keyof SiteContent>(key: K, value: SiteContent[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // ---- Series editing ----
  const series = form.series ?? SERIES;
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<Series | null>(null);
  function setSeries(next: Series[]) { set("series", next); }
  function openEdit(i: number) { setEditIdx(i); setDraft({ ...series[i] }); }
  function openAdd() {
    setEditIdx(series.length); // one past the end marks a brand-new series
    setDraft({ key: "series-" + Date.now(), title: "", tag: "", badge: "", blurb: "", href: "/library", by: "", category: "", art: "a1", visible: true });
  }
  function removeSeries(i: number) {
    if (!confirm("Remove this series from the site?")) return;
    setSeries(series.filter((_, idx) => idx !== i));
  }
  function toggleVisible(i: number) {
    setSeries(series.map((s, idx) => (idx === i ? { ...s, visible: s.visible === false } : s)));
  }
  function d<K extends keyof Series>(k: K, v: Series[K]) { setDraft((p) => (p ? { ...p, [k]: v } : p)); }
  async function pickThumb(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    try { d("image", await resizeThumb(file)); }
    catch { setMessage("Could not read that image."); }
  }
  function saveDraft() {
    if (editIdx == null || !draft) return;
    const clean: Series = { ...draft, title: draft.title.trim() || "Untitled series" };
    setSeries(editIdx >= series.length ? [...series, clean] : series.map((s, idx) => (idx === editIdx ? clean : s)));
    setEditIdx(null); setDraft(null);
  }

  async function save() {
    setStatus("saving");
    setMessage("");
    try {
      const res = await saveSection("content", form);
      if (res.saved) {
        setStatus("saved");
        setMessage("Saved. Your changes are live on the site.");
      } else {
        setStatus("demo");
        setMessage("Preview only - connect Firebase to save changes.");
      }
    } catch (e: any) {
      setStatus("error");
      setMessage(e.message || "Could not save.");
    }
  }

  return (
    <>
      <div className="admin-topbar">
        <div>
          <h1>Content</h1>
          <div className="sub">Edit the words and sections viewers see. No code required.</div>
        </div>
        <div className="admin-actions">
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setPreview(true)}>Preview site</button>
          <button className="btn btn-primary btn-sm" type="button" onClick={save} disabled={status === "saving"}>
            {status === "saving" ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>

      {preview && <PreviewSiteModal onClose={() => setPreview(false)} />}

      {message && (
        <div className={status === "error" ? "form-error" : "form-ok"} style={{ marginBottom: 18 }}>
          {message}
        </div>
      )}

      <div className="two-col">
        <div>
          <div className="panel">
            <h3>About page</h3>
            <div className="panel-sub">The story text on the About page. Blank lines start a new paragraph.</div>
            <div className="form-field">
              <label>About text</label>
              <textarea style={{ minHeight: 200 }} value={form.aboutText} onChange={(e) => set("aboutText", e.target.value)} />
            </div>
            <div className="uploader">
              <div className="logo-prev">
                {form.portrait ? <img src={form.portrait} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} /> : "SC"}
              </div>
              <div className="up-info"><div className="up-t">About portrait</div><div className="up-s">Shown on the About page. Saved with your content (click Save changes).</div></div>
              <input ref={portraitInput} type="file" accept="image/*" hidden onChange={pickPortrait} />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => portraitInput.current?.click()}>{form.portrait ? "Change" : "Upload"}</button>
                {form.portrait && <button className="btn btn-ghost btn-sm" type="button" onClick={() => set("portrait", "")}>Remove</button>}
              </div>
            </div>
          </div>

          <div className="panel">
            <h3>Contact details</h3>
            <div className="panel-sub">Shown on the Contact page and footer.</div>
            <div className="panel-split">
              <div className="form-field"><label>General email</label><input type="email" value={form.emailGeneral} onChange={(e) => set("emailGeneral", e.target.value)} /></div>
              <div className="form-field"><label>Booking email</label><input type="email" value={form.emailBooking} onChange={(e) => set("emailBooking", e.target.value)} /></div>
            </div>
          </div>

          <div className="panel">
            <h3>Page headings &amp; text</h3>
            <div className="panel-sub">The words at the top of each page. The big title is on two lines - the second line shows in your accent color.</div>

            <h4 style={{ margin: "18px 0 8px" }}>Shows page</h4>
            <div className="form-field"><label>Small label (eyebrow)</label><input type="text" value={form.showsEyebrow} onChange={(e) => set("showsEyebrow", e.target.value)} /></div>
            <div className="panel-split">
              <div className="form-field"><label>Title - line 1</label><input type="text" value={form.showsTitle1} onChange={(e) => set("showsTitle1", e.target.value)} /></div>
              <div className="form-field"><label>Title - line 2 (accent)</label><input type="text" value={form.showsTitle2} onChange={(e) => set("showsTitle2", e.target.value)} /></div>
            </div>
            <div className="form-field"><label>Intro paragraph</label><textarea style={{ minHeight: 70 }} value={form.showsIntro} onChange={(e) => set("showsIntro", e.target.value)} /></div>

            <h4 style={{ margin: "18px 0 8px" }}>Library / archive page</h4>
            <div className="form-field"><label>Small label (eyebrow)</label><input type="text" value={form.libraryEyebrow} onChange={(e) => set("libraryEyebrow", e.target.value)} /></div>
            <div className="panel-split">
              <div className="form-field"><label>Title - line 1</label><input type="text" value={form.libraryTitle1} onChange={(e) => set("libraryTitle1", e.target.value)} /></div>
              <div className="form-field"><label>Title - line 2 (accent)</label><input type="text" value={form.libraryTitle2} onChange={(e) => set("libraryTitle2", e.target.value)} /></div>
            </div>
            <div className="form-field"><label>Intro paragraph</label><textarea style={{ minHeight: 70 }} value={form.libraryIntro} onChange={(e) => set("libraryIntro", e.target.value)} /></div>

            <h4 style={{ margin: "18px 0 8px" }}>About page</h4>
            <div className="form-field"><label>Small label (eyebrow)</label><input type="text" value={form.aboutEyebrow} onChange={(e) => set("aboutEyebrow", e.target.value)} /></div>
            <div className="panel-split">
              <div className="form-field"><label>Title - line 1</label><input type="text" value={form.aboutTitle1} onChange={(e) => set("aboutTitle1", e.target.value)} /></div>
              <div className="form-field"><label>Title - line 2 (accent)</label><input type="text" value={form.aboutTitle2} onChange={(e) => set("aboutTitle2", e.target.value)} /></div>
            </div>
            <div className="panel-sub" style={{ margin: "8px 0 4px" }}>Closing section (lower on the About page)</div>
            <div className="panel-split">
              <div className="form-field"><label>Heading - line 1</label><input type="text" value={form.aboutClosingTitle1} onChange={(e) => set("aboutClosingTitle1", e.target.value)} /></div>
              <div className="form-field"><label>Heading - line 2 (accent)</label><input type="text" value={form.aboutClosingTitle2} onChange={(e) => set("aboutClosingTitle2", e.target.value)} /></div>
            </div>
            <div className="form-field"><label>Closing paragraph</label><textarea style={{ minHeight: 70 }} value={form.aboutClosingText} onChange={(e) => set("aboutClosingText", e.target.value)} /></div>
          </div>
        </div>

        <div>
          <div className="panel">
            <h3>Series</h3>
            <div className="panel-sub">The shows that appear across the site. Edits go live when you click Save changes.</div>
            <div className="panel" style={{ padding: "8px 8px 0", marginBottom: 16, background: "var(--bg-elevated)" }}>
              <table className="data">
                <thead><tr><th>Series</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {series.map((s, i) => (
                    <tr key={s.key || i}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 56, height: 32, borderRadius: 5, overflow: "hidden", flexShrink: 0, border: "1px solid var(--line)" }}>
                            {s.image ? <img src={s.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div className={`timg art ${s.art}`} style={{ width: "100%", height: "100%" }} />}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div className="vt" style={{ fontWeight: 600 }}>{s.title}</div>
                            <div className="vs" style={{ color: "var(--text-dim)", fontSize: ".8rem" }}>{s.tag}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <button type="button" className={`pill ${s.visible === false ? "" : "published"}`} style={{ cursor: "pointer", border: "none" }} onClick={() => toggleVisible(i)} title="Click to toggle">
                          {s.visible === false ? "Hidden" : "Visible"}
                        </button>
                      </td>
                      <td className="row-actions" style={{ whiteSpace: "nowrap" }}>
                        <a style={{ cursor: "pointer" }} onClick={() => openEdit(i)}>Edit</a>
                        <a style={{ cursor: "pointer", marginLeft: 12, color: "var(--live)" }} onClick={() => removeSeries(i)}>Remove</a>
                      </td>
                    </tr>
                  ))}
                  {series.length === 0 && <tr><td colSpan={3} style={{ color: "var(--text-dim)" }}>No series yet. Add one below.</td></tr>}
                </tbody>
              </table>
            </div>
            <button className="btn btn-ghost btn-sm" type="button" style={{ width: "100%", justifyContent: "center" }} onClick={openAdd}>Add series</button>
          </div>

          <div className="panel">
            <h3>Connected YouTube channels</h3>
            <div className="panel-sub">Videos from these channels sync into the site (Library + Videos). Add a channel by its Channel ID.</div>
            {channels.map((c, i) => (
              <div className="dest-row" key={c.channelId || i}>
                <div style={{ minWidth: 0 }}>
                  <div className="dest-name">{c.name}</div>
                  <div className="dest-meta">{c.handle ? `youtube.com/${c.handle.startsWith("@") ? c.handle : "@" + c.handle}` : c.channelId}</div>
                </div>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => removeChannel(i)} style={{ color: "var(--live)" }}>Remove</button>
              </div>
            ))}
            {channels.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No channels yet. Add one below.</p>}

            <div style={{ borderTop: "1px solid var(--line)", marginTop: 12, paddingTop: 12 }}>
              <div className="form-field"><label>Channel name</label><input type="text" value={chDraft.name} placeholder="Your Live Show" onChange={(e) => setChDraft({ ...chDraft, name: e.target.value })} /></div>
              <div className="panel-split">
                <div className="form-field"><label>Handle (optional)</label><input type="text" value={chDraft.handle} placeholder="@YourChannel" onChange={(e) => setChDraft({ ...chDraft, handle: e.target.value })} /></div>
                <div className="form-field"><label>Channel ID</label><input type="text" value={chDraft.channelId} placeholder="UCxxxxxxxxxxxxxxxxxxxxxx" onChange={(e) => setChDraft({ ...chDraft, channelId: e.target.value })} /></div>
              </div>
              <p className="form-note" style={{ marginTop: -4, marginBottom: 10 }}>Find the Channel ID in YouTube Studio &rarr; Settings &rarr; Channel &rarr; Advanced settings (starts with &quot;UC&quot;).</p>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button className="btn btn-ghost btn-sm" type="button" onClick={addChannel}>Add channel</button>
                <button className="btn btn-primary btn-sm" type="button" onClick={saveChannels}>Save channels</button>
                {chStatus && <span className="form-note" style={{ margin: 0 }}>{chStatus}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {draft && (
        <div className="modal-backdrop" onClick={() => { setEditIdx(null); setDraft(null); }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, width: "92%" }}>
            <h3 style={{ marginTop: 0 }}>{editIdx != null && editIdx >= series.length ? "Add series" : "Edit series"}</h3>
            <div className="panel-sub" style={{ marginBottom: 14 }}>These fields show on the home page, Shows page, and footer.</div>

            <div className="form-field">
              <label>Thumbnail image</label>
              <input ref={thumbInput} type="file" accept="image/*" hidden onChange={pickThumb} />
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 128, height: 72, borderRadius: 8, overflow: "hidden", flexShrink: 0, border: "1px solid var(--line)", background: "var(--bg2)" }}>
                  {draft.image
                    ? <img src={draft.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div className={`timg art ${draft.art}`} style={{ width: "100%", height: "100%" }} />}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => thumbInput.current?.click()}>{draft.image ? "Replace" : "Upload image"}</button>
                  {draft.image && <button className="btn btn-ghost btn-sm" type="button" onClick={() => d("image", "")}>Clear</button>}
                </div>
              </div>
              <p className="form-note" style={{ marginTop: 6 }}>Optional. Uploading a photo replaces the color thumbnail. (This only changes the thumbnail on your site, not on YouTube.)</p>
            </div>

            <div className="form-field"><label>Title</label><input type="text" value={draft.title} onChange={(e) => d("title", e.target.value)} placeholder="Show name" /></div>
            <div className="panel-split">
              <div className="form-field"><label>Tag (small label)</label><input type="text" value={draft.tag} onChange={(e) => d("tag", e.target.value)} placeholder="Flagship" /></div>
              <div className="form-field"><label>Badge (on the thumbnail)</label><input type="text" value={draft.badge} onChange={(e) => d("badge", e.target.value)} placeholder="Live talk" /></div>
            </div>
            <div className="form-field"><label>Blurb</label><textarea style={{ minHeight: 90 }} value={draft.blurb} onChange={(e) => d("blurb", e.target.value)} placeholder="Short description shown under the title." /></div>
            <div className="panel-split">
              <div className="form-field"><label>Credit line (by)</label><input type="text" value={draft.by} onChange={(e) => d("by", e.target.value)} placeholder="Your Studio" /></div>
              <div className="form-field"><label>Link (where clicking the show goes)</label><input type="text" value={draft.href} onChange={(e) => d("href", e.target.value)} placeholder="/live" /></div>
            </div>
            <p className="form-note" style={{ marginTop: -6 }}>Use a site page like <strong>/live</strong> or <strong>/library</strong>, or a full web address starting with <strong>https://</strong> (e.g. a YouTube channel) to open it in a new tab.</p>
            <div className="panel-split">
              <div className="form-field">
                <label>Thumbnail color (used if no image)</label>
                <select value={draft.art} onChange={(e) => d("art", e.target.value)}>
                  {ART_OPTIONS.map((a, i) => <option key={a} value={a}>{`Style ${i + 1}`}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Visibility</label>
                <label className="check-row" style={{ marginTop: 6 }}>
                  <input type="checkbox" checked={draft.visible !== false} onChange={(e) => d("visible", e.target.checked)} />
                  <span>Show on the public site</span>
                </label>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setEditIdx(null); setDraft(null); }}>Cancel</button>
              <button className="btn btn-primary btn-sm" type="button" onClick={saveDraft}>Done</button>
            </div>
            <p className="form-note" style={{ marginTop: 12 }}>Click <strong>Done</strong> here, then <strong>Save changes</strong> at the top to publish.</p>
          </div>
        </div>
      )}
    </>
  );
}
