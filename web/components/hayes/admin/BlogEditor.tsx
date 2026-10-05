"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getIdToken } from "@/lib/firebase";

// Full blog editor: AI draft (Groq) → rich-text body, excerpt, cover image,
// categories, tags, SEO fields + live SEO score, status + featured. Matches the
// admin look (cards, inputs, accent buttons). Saves to Firestore via the blog API.

type Term = { id: string; name: string; slug: string };

// ── Image resize (same approach as Merch): file → small data URL ──────────────
function fileToImg(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1280; let { width: w, height: h } = img;
        if (w > max || h > max) { const s = max / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d")!.drawImage(img, 0, 0, w, h);
        let q = 0.82, out = c.toDataURL("image/jpeg", q);
        while (out.length > 600_000 && q > 0.4) { q -= 0.12; out = c.toDataURL("image/jpeg", q); }
        resolve(out);
      };
      img.onerror = reject; img.src = String(r.result);
    };
    r.onerror = reject; r.readAsDataURL(file);
  });
}

// ── SEO scoring ───────────────────────────────────────────────────────────────
function calcSeo(title: string, content: string, excerpt: string, metaTitle: string, metaDesc: string, keywords: string) {
  let score = 0; const items: { ok: boolean; text: string }[] = [];
  const push = (ok: boolean, text: string, pts: number) => { if (ok) score += pts; items.push({ ok, text }); };
  push(title.trim().length >= 10, "Title is set", 15);
  push(content.replace(/<[^>]+>/g, "").trim().length >= 300, "Body has good length", 20);
  push(excerpt.trim().length >= 50, "Excerpt added for listing previews", 10);
  const mdl = metaDesc.trim().length;
  if (mdl >= 120 && mdl <= 160) push(true, `Meta description optimal (${mdl} chars)`, 20);
  else if (mdl > 0) push(false, `Meta description should be 120-160 chars (${mdl} now)`, 0);
  else push(false, "Add a meta description (120-160 characters)", 0);
  push(keywords.trim().length > 0, "Keywords set for SEO targeting", 10);
  push(metaTitle.trim().length >= 10, "Custom SEO title set", 10);
  push(/<h[123]/i.test(content), "Body has headings for structure", 10);
  if (title.trim().length >= 30 && title.trim().length <= 70) score += 5;
  return { score: Math.min(100, score), items };
}
const scoreColor = (s: number) => (s >= 70 ? "var(--green)" : s >= 40 ? "#E0A400" : "var(--live)");
const scoreLabel = (s: number) => (s >= 70 ? "Good SEO" : s >= 40 ? "Needs work" : "Poor SEO");

const STATUS: { value: string; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

export default function BlogEditor({ postId }: { postId?: string }) {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInited = useRef(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const tok = async (): Promise<Record<string, string>> => { const t = await getIdToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };

  // Core
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [status, setStatus] = useState("draft");
  const [featured, setFeatured] = useState(false);
  const [slug, setSlug] = useState("");
  // SEO
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDesc, setMetaDesc] = useState("");
  const [keywords, setKeywords] = useState("");
  // AI links
  const [aiLinks, setAiLinks] = useState("");
  // Taxonomy
  const [allCategories, setAllCategories] = useState<Term[]>([]);
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [newCat, setNewCat] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [allTags, setAllTags] = useState<Term[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  // UI
  const [tab, setTab] = useState<"content" | "seo">("content");
  const [loading, setLoading] = useState(Boolean(postId));
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);

  const mark = () => setDirty(true);

  // Load categories + tags, and the post itself when editing.
  useEffect(() => {
    (async () => {
      const h = await tok();
      try {
        const [cd, td] = await Promise.all([
          fetch("/api/admin/blog/categories", { headers: h, cache: "no-store" }).then((r) => r.json()).catch(() => ({ categories: [] })),
          fetch("/api/admin/blog/tags", { headers: h, cache: "no-store" }).then((r) => r.json()).catch(() => ({ tags: [] })),
        ]);
        setAllCategories(cd.categories || []);
        setAllTags(td.tags || []);
      } catch {}
      if (postId) {
        try {
          const r = await fetch(`/api/admin/blog/${postId}`, { headers: h, cache: "no-store" });
          const d = await r.json();
          const p = d.post;
          if (p) {
            setTitle(p.title || ""); setExcerpt(p.excerpt || ""); setContentHtml(p.content || "");
            setCoverImage(p.coverImage || ""); setStatus(p.status || "draft"); setFeatured(Boolean(p.featured));
            setSlug(p.slug || ""); setMetaTitle(p.metaTitle || ""); setMetaDesc(p.metaDescription || "");
            setKeywords(p.keywords || ""); setSelectedTags(Array.isArray(p.tags) ? p.tags : []);
            setSelectedCats(new Set(Array.isArray(p.categories) ? p.categories : []));
            if (editorRef.current) { editorRef.current.innerHTML = p.content || ""; editorInited.current = true; }
          }
        } catch {}
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  // ── Rich text ──
  const exec = (cmd: string, value?: string) => { document.execCommand(cmd, false, value); editorRef.current?.focus(); setContentHtml(editorRef.current?.innerHTML ?? ""); mark(); };
  const insertLink = () => { const url = prompt("Link URL (https://…)"); if (url) exec("createLink", url.trim()); };
  const insertImg = () => { const url = prompt("Image URL (https://…)"); if (url) exec("insertHTML", `<img src="${url.trim()}" alt="" style="max-width:100%;border-radius:10px;margin:12px 0;" />`); };

  // ── Cover upload ──
  async function onCover(file: File) {
    if (!file.type.startsWith("image/")) { setMsg("That file isn't an image."); return; }
    try { setUploading(true); setCoverImage(await fileToImg(file)); mark(); } catch { setMsg("Could not read that image."); } finally { setUploading(false); }
  }

  // ── AI generate ──
  async function generate() {
    if (!title.trim()) { setMsg("Enter a title first, then generate."); return; }
    setGenerating(true); setMsg("Writing your draft…");
    try {
      const r = await fetch("/api/admin/blog/generate", { method: "POST", headers: { "Content-Type": "application/json", ...(await tok()) }, body: JSON.stringify({ title, links: aiLinks.trim() || undefined }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Generate failed.");
      const g = d.generated || {};
      if (editorRef.current && g.content) { editorRef.current.innerHTML = g.content; setContentHtml(g.content); }
      if (g.excerpt) setExcerpt(g.excerpt);
      if (g.metaDescription) setMetaDesc(g.metaDescription);
      if (g.keywords) setKeywords(g.keywords);
      if (Array.isArray(g.suggestedTags)) {
        setSelectedTags((prev) => {
          const have = new Set(prev.map((t) => t.toLowerCase()));
          return [...prev, ...g.suggestedTags.filter((t: string) => !have.has(String(t).toLowerCase()))];
        });
      }
      mark(); setMsg("Draft ready — review and edit below.");
    } catch (e: any) { setMsg(e?.message || "Could not generate."); }
    finally { setGenerating(false); }
  }

  // ── Categories / tags ──
  async function createCategory() {
    const name = newCat.trim(); if (!name) return;
    try {
      const r = await fetch("/api/admin/blog/categories", { method: "POST", headers: { "Content-Type": "application/json", ...(await tok()) }, body: JSON.stringify({ name }) });
      const d = await r.json();
      if (r.ok && d.category) { setAllCategories((a) => (a.find((c) => c.id === d.category.id) ? a : [...a, d.category])); setSelectedCats((s) => new Set([...s, d.category.name])); setNewCat(""); setAddingCat(false); mark(); }
    } catch {}
  }
  const toggleCat = (name: string, on: boolean) => { setSelectedCats((prev) => { const n = new Set(prev); on ? n.add(name) : n.delete(name); return n; }); mark(); };
  const addTag = async (name: string) => {
    const n = name.trim(); if (!n) return;
    if (selectedTags.find((t) => t.toLowerCase() === n.toLowerCase())) { setTagInput(""); return; }
    setSelectedTags((p) => [...p, n]); setTagInput(""); mark();
    // Remember the tag for future suggestions (best-effort).
    try { const r = await fetch("/api/admin/blog/tags", { method: "POST", headers: { "Content-Type": "application/json", ...(await tok()) }, body: JSON.stringify({ name: n }) }); const d = await r.json(); if (r.ok && d.tag) setAllTags((a) => (a.find((t) => t.id === d.tag.id) ? a : [...a, d.tag])); } catch {}
  };
  const removeTag = (name: string) => { setSelectedTags((p) => p.filter((t) => t !== name)); mark(); };

  // ── Save / delete ──
  async function save() {
    const content = editorRef.current?.innerHTML ?? contentHtml;
    if (!title.trim()) { setMsg("A title is required."); return; }
    setSaving(true); setMsg("Saving…");
    const body = {
      title: title.trim(), excerpt: excerpt.trim(), content, coverImage, status, featured, slug: slug.trim(),
      metaTitle: metaTitle.trim(), metaDescription: metaDesc.trim(), keywords: keywords.trim(),
      categories: [...selectedCats], tags: selectedTags,
    };
    try {
      if (postId) {
        const r = await fetch(`/api/admin/blog/${postId}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...(await tok()) }, body: JSON.stringify(body) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Save failed.");
        if (d.post?.slug) setSlug(d.post.slug);
        setDirty(false); setMsg("Saved.");
      } else {
        const r = await fetch("/api/admin/blog", { method: "POST", headers: { "Content-Type": "application/json", ...(await tok()) }, body: JSON.stringify(body) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Create failed.");
        setMsg("Created."); router.push(`/admin/blog/${d.post?.id}/edit`);
      }
    } catch (e: any) { setMsg(e?.message || "Save failed."); }
    finally { setSaving(false); setTimeout(() => setMsg((m) => (m === "Saved." ? "" : m)), 3500); }
  }

  async function del() {
    if (!postId) return;
    if (!confirmDel) { setConfirmDel(true); return; }
    setDeleting(true);
    try { const r = await fetch(`/api/admin/blog/${postId}`, { method: "DELETE", headers: await tok() }); if (!r.ok) throw new Error(); router.push("/admin/blog"); }
    catch { setMsg("Delete failed."); setDeleting(false); setConfirmDel(false); }
  }

  const { score, items: seoItems } = calcSeo(title, contentHtml, excerpt, metaTitle, metaDesc, keywords);
  const circ = 2 * Math.PI * 26;
  const words = contentHtml.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;

  if (loading) return <div className="note" style={{ margin: 0 }}>Loading…</div>;

  return (
    <div className="blogedit">
      {/* Header actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <Link href="/admin/blog" className="link">← All posts</Link>
        {slug && status === "published" && <Link href={`/blog/${slug}`} target="_blank" className="link" style={{ color: "var(--sub)" }}>View live ↗</Link>}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {dirty && <span style={{ fontSize: 12.5, color: "#E0A400" }}>Unsaved changes</span>}
          {postId && <button className="btn sm" onClick={del} disabled={deleting} style={{ color: "var(--live)" }}>{confirmDel ? "Confirm delete" : "Delete"}</button>}
          <button className="btn sm" onClick={save} disabled={saving} style={{ background: "var(--acc)", color: "var(--accInk)" }}>{saving ? "Saving…" : postId ? "Save" : "Create post"}</button>
        </div>
      </div>

      <div className="blogedit-grid">
        {/* Left: editor */}
        <div>
          {/* Tabs */}
          <div className="blogtabs">
            <button className={tab === "content" ? "on" : ""} onClick={() => setTab("content")}>Content</button>
            <button className={tab === "seo" ? "on" : ""} onClick={() => setTab("seo")}>SEO</button>
          </div>

          {tab === "content" && (
            <div className="card" style={{ display: "grid", gap: 16 }}>
              {/* Title + generate */}
              <div>
                <label className="bl-label">Title</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input value={title} onChange={(e) => { setTitle(e.target.value); mark(); }} placeholder="e.g. Five 2027 recruits whose film jumps off the screen" style={{ ...inp, flex: 1, minWidth: 220 }} />
                  <button className="btn sm" onClick={generate} disabled={generating || !title.trim()} style={{ whiteSpace: "nowrap" }}>{generating ? "Writing…" : "Generate with AI"}</button>
                </div>
              </div>

              {/* AI links */}
              <div>
                <label className="bl-label">Links to include <span style={{ color: "var(--dim)", fontWeight: 400 }}>(optional)</span></label>
                <textarea value={aiLinks} onChange={(e) => setAiLinks(e.target.value)} rows={2} placeholder="/rankings, /shows, https://example.com — the AI links to each one naturally. Set before generating." style={{ ...inp, resize: "vertical" }} />
              </div>

              {/* Excerpt */}
              <div>
                <label className="bl-label">Excerpt</label>
                <textarea value={excerpt} onChange={(e) => { setExcerpt(e.target.value); mark(); }} rows={2} placeholder="Short summary shown on the blog list and home page" style={{ ...inp, resize: "vertical" }} />
              </div>

              {/* Cover */}
              <div>
                <label className="bl-label">Cover image</label>
                <input ref={coverInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onCover(f); }} />
                {coverImage ? (
                  <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid var(--hair)" }}>
                    <img src={coverImage} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "cover", display: "block" }} />
                    <button onClick={() => { setCoverImage(""); mark(); }} style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.6)", color: "#fff", cursor: "pointer" }}>✕</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => coverInputRef.current?.click()} disabled={uploading} style={{ width: "100%", height: 120, borderRadius: 12, border: "2px dashed var(--hair)", background: "var(--soft)", color: "var(--dim)", cursor: "pointer", fontSize: 13 }}>{uploading ? "Uploading…" : "Click to upload a cover image"}</button>
                )}
              </div>

              {/* Body */}
              <div>
                <label className="bl-label">Body</label>
                <div style={{ border: "1px solid var(--hair)", borderRadius: 12, overflow: "hidden", background: "var(--soft)" }}>
                  <div className="bl-toolbar">
                    <button onClick={() => exec("formatBlock", "<h2>")} title="Heading">H2</button>
                    <button onClick={() => exec("formatBlock", "<h3>")} title="Subheading">H3</button>
                    <button onClick={() => exec("formatBlock", "<p>")} title="Paragraph">P</button>
                    <span className="bl-div" />
                    <button onClick={() => exec("bold")} style={{ fontWeight: 700 }} title="Bold">B</button>
                    <button onClick={() => exec("italic")} style={{ fontStyle: "italic" }} title="Italic">I</button>
                    <button onClick={() => exec("underline")} style={{ textDecoration: "underline" }} title="Underline">U</button>
                    <span className="bl-div" />
                    <button onClick={() => exec("insertUnorderedList")} title="Bullet list">• List</button>
                    <button onClick={() => exec("insertOrderedList")} title="Numbered list">1. List</button>
                    <span className="bl-div" />
                    <button onClick={insertLink} title="Insert link">Link</button>
                    <button onClick={insertImg} title="Insert image">Image</button>
                    <span style={{ flex: 1 }} />
                    <button onClick={() => exec("removeFormat")} style={{ color: "var(--dim)" }} title="Clear formatting">Clear</button>
                  </div>
                  <div
                    ref={editorRef}
                    className="bl-body"
                    contentEditable
                    suppressContentEditableWarning
                    onInput={() => { setContentHtml(editorRef.current?.innerHTML ?? ""); mark(); }}
                    data-ph="Write your post, or type a title above and click Generate with AI…"
                  />
                </div>
                <p style={{ fontSize: 12, color: "var(--dim)", marginTop: 6 }}>{words} words</p>
              </div>
            </div>
          )}

          {tab === "seo" && (
            <div className="card" style={{ display: "grid", gap: 16 }}>
              <div>
                <label className="bl-label">SEO title</label>
                <input value={metaTitle} onChange={(e) => { setMetaTitle(e.target.value); mark(); }} placeholder="Custom title for search engines (defaults to the post title)" style={inp} />
                <p style={{ fontSize: 12, marginTop: 4, color: metaTitle.length > 60 ? "#E0A400" : "var(--dim)" }}>{metaTitle.length}/60</p>
              </div>
              <div>
                <label className="bl-label">Meta description</label>
                <textarea value={metaDesc} onChange={(e) => { setMetaDesc(e.target.value); mark(); }} rows={3} placeholder="Shown under the title in Google results (120-160 characters)" style={{ ...inp, resize: "vertical" }} />
                <p style={{ fontSize: 12, marginTop: 4, color: metaDesc.length > 160 ? "var(--live)" : metaDesc.length >= 120 ? "var(--green)" : "var(--dim)" }}>{metaDesc.length}/160{metaDesc.length >= 120 && metaDesc.length <= 160 ? " ✓" : ""}</p>
              </div>
              <div>
                <label className="bl-label">Keywords</label>
                <input value={keywords} onChange={(e) => { setKeywords(e.target.value); mark(); }} placeholder="recruiting, film grades, 2027 class, defensive backs" style={inp} />
                <p style={{ fontSize: 12, marginTop: 4, color: "var(--dim)" }}>Comma-separated</p>
              </div>
              {slug && (
                <div style={{ padding: 12, background: "var(--soft)", border: "1px solid var(--hair)", borderRadius: 10 }}>
                  <p style={{ fontSize: 12.5, color: "var(--sub)", margin: "0 0 2px" }}>Web address</p>
                  <p style={{ fontSize: 13, margin: 0, fontFamily: "monospace", wordBreak: "break-all" }}>/blog/<span style={{ color: "var(--ink)" }}>{slug}</span></p>
                </div>
              )}
            </div>
          )}

          {msg && <p style={{ fontSize: 13, marginTop: 12, color: /fail|could|isn.t|required|malformed|timed/i.test(msg) ? "var(--live)" : "var(--green)" }}>{msg}</p>}
        </div>

        {/* Right: sidebar */}
        <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
          {/* SEO score */}
          <div className="card">
            <p className="bl-cap">SEO score</p>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <svg width="68" height="68" viewBox="0 0 68 68">
                <circle cx="34" cy="34" r="26" fill="none" stroke="var(--hair)" strokeWidth="6" />
                <circle cx="34" cy="34" r="26" fill="none" stroke={scoreColor(score)} strokeWidth="6" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)} transform="rotate(-90 34 34)" style={{ transition: "stroke-dashoffset .4s ease" }} />
                <text x="34" y="39" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--ink)">{score}</text>
              </svg>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: scoreColor(score) }}>{scoreLabel(score)}</span>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {seoItems.map((it, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ marginTop: 4, width: 9, height: 9, borderRadius: "50%", flexShrink: 0, background: it.ok ? "var(--green)" : "var(--live)", opacity: 0.85 }} />
                  <p style={{ fontSize: 12.5, lineHeight: 1.35, margin: 0, color: it.ok ? "var(--dim)" : "var(--sub)" }}>{it.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Settings */}
          <div className="card" style={{ display: "grid", gap: 12 }}>
            <p className="bl-cap">Post settings</p>
            <div>
              <label className="bl-label">Status</label>
              <select value={status} onChange={(e) => { setStatus(e.target.value); mark(); }} style={inp}>
                {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13.5, color: "var(--sub)", cursor: "pointer" }}>
              Featured post
              <input type="checkbox" checked={featured} onChange={(e) => { setFeatured(e.target.checked); mark(); }} />
            </label>
          </div>

          {/* Categories */}
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p className="bl-cap" style={{ margin: 0 }}>Categories</p>
              <button className="link" style={{ fontSize: 12.5 }} onClick={() => setAddingCat((a) => !a)}>+ New</button>
            </div>
            {addingCat && (
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <input value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createCategory()} placeholder="Category name" autoFocus style={{ ...inp, padding: "7px 10px" }} />
                <button className="btn sm" onClick={createCategory} disabled={!newCat.trim()}>Add</button>
              </div>
            )}
            <div style={{ display: "grid", gap: 7 }}>
              {allCategories.length === 0 && <p style={{ fontSize: 12.5, color: "var(--dim)", margin: 0 }}>No categories yet. Click + New.</p>}
              {allCategories.map((c) => (
                <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: "var(--sub)", cursor: "pointer" }}>
                  <input type="checkbox" checked={selectedCats.has(c.name)} onChange={(e) => toggleCat(c.name, e.target.checked)} />
                  {c.name}
                </label>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="card">
            <p className="bl-cap">Tags</p>
            {selectedTags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {selectedTags.map((t) => (
                  <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", background: "var(--soft)", border: "1px solid var(--hair)", borderRadius: 999, fontSize: 12.5, color: "var(--sub)" }}>
                    {t}
                    <button onClick={() => removeTag(t)} style={{ border: "none", background: "none", color: "var(--dim)", cursor: "pointer", padding: 0, lineHeight: 1 }}>✕</button>
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 6 }}>
              <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); } }} placeholder="Type a tag + Enter" style={{ ...inp, padding: "7px 10px" }} />
              <button className="btn sm" onClick={() => addTag(tagInput)} disabled={!tagInput.trim()}>Add</button>
            </div>
            {tagInput.trim() && allTags.filter((t) => t.name.toLowerCase().includes(tagInput.toLowerCase()) && !selectedTags.find((s) => s.toLowerCase() === t.name.toLowerCase())).slice(0, 5).map((t) => (
              <button key={t.id} onClick={() => addTag(t.name)} style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 10px", marginTop: 4, fontSize: 13, color: "var(--sub)", background: "none", border: "none", cursor: "pointer", borderRadius: 6 }}>{t.name}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--hair)", background: "var(--soft)", color: "var(--ink)", fontSize: 13.5 };
