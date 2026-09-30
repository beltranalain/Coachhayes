"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/hayes/admin/Shell";
import { getIdToken } from "@/lib/firebase";
import { CATEGORIES, CHIP_SCORE, recommendedOverall, type Chip, type CategoryKey } from "@/lib/chips";

// Admin Rankings — grade recruits on the 4-chip scale, run the AI scout on
// submissions, edit, publish (which creates the public player page), and reorder
// the board (hybrid: auto by chip + manual up/down).
const CHIPS = [
  { key: "blue", label: "Blue chip", ring: "#2D6BFF" },
  { key: "gold", label: "Gold chip", ring: "#F5C542" },
  { key: "silver", label: "Silver chip", ring: "#A9B2BD" },
  { key: "bronze", label: "Bronze chip", ring: "#C98A5E" },
];
const ring = (c: string) => CHIPS.find((x) => x.key === c)?.ring || "#C98A5E";

// Compact chip control for the board: a colored dot that opens a small picker of
// the 4 tiers (no long text — keeps the 5-per-row category grid tight).
function ChipPicker({ value, onChange }: { value: Chip; onChange: (c: Chip) => void }) {
  const [open, setOpen] = useState(false);
  const cur = CHIPS.find((c) => c.key === value);
  return (
    <span className="chippick">
      <button type="button" className="chippick-dot" style={{ background: ring(value) }} title={cur?.label} onClick={() => setOpen((o) => !o)} />
      {open && (
        <>
          <span className="chippick-scrim" onClick={() => setOpen(false)} />
          <span className="chippick-menu">
            {CHIPS.map((c) => (
              <button type="button" key={c.key} className={`chippick-opt${c.key === value ? " on" : ""}`} title={c.label} style={{ background: c.ring }} onClick={() => { onChange(c.key as Chip); setOpen(false); }} />
            ))}
          </span>
        </>
      )}
    </span>
  );
}

type Draft = { chip: string; chipRationale?: string; bio: string; strengths: string[]; traits: string[]; seoTitle: string; seoDescription: string };
type Sub = { id: string; playerName: string; position: string; school: string; state?: string; classYear: string; videoUrl: string; heightIn?: number; weightLb?: number; notes?: string; status: string; aiDraft?: Draft | null };
type Player = { id: string; name: string; position: string; school: string; classYear: string; chip: string; order: number; published: boolean };

// Manual add / edit form. Strengths + traits are edited as raw text and split on save.
type PForm = {
  id?: string; slug?: string; name: string; position: string; school: string; city: string; state: string; classYear: string;
  commit: string; commitLogo: string;
  videoUrl: string; heightIn: string; weightLb: string; fortyYd: string;
  categories: Record<CategoryKey, Chip>; categoryNotes: Record<CategoryKey, string>; overall: Chip;
  bio: string; strengths: string; traits: string; seoTitle: string; seoDescription: string; published: boolean;
};
const blankCats = (base: Chip = "bronze"): Record<CategoryKey, Chip> => ({ power: base, speed: base, motor: base, technique: base, iq: base });
const blankNotes = (): Record<CategoryKey, string> => ({ power: "", speed: "", motor: "", technique: "", iq: "" });
const blankForm = (): PForm => ({ name: "", position: "", school: "", city: "", state: "", classYear: "", commit: "", commitLogo: "", videoUrl: "", heightIn: "", weightLb: "", fortyYd: "", categories: blankCats(), categoryNotes: blankNotes(), overall: "bronze", bio: "", strengths: "", traits: "", seoTitle: "", seoDescription: "", published: true });

export default function RankingsAdmin() {
  const [brand, setBrand] = useState({ name: "Coach Hayes Football", logo: "" });
  const [subs, setSubs] = useState<Sub[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [editor, setEditor] = useState<PForm | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const tok = async (): Promise<Record<string, string>> => { const t = await getIdToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };

  async function loadAll() {
    try {
      const h = await tok();
      const [ps, ss] = await Promise.all([
        fetch("/api/admin/players", { headers: h, cache: "no-store" }).then((r) => r.json()),
        fetch("/api/admin/submissions", { headers: h, cache: "no-store" }).then((r) => r.json()),
      ]);
      setPlayers(ps.players || []);
      setSubs(ss.submissions || []);
    } catch {}
  }
  useEffect(() => {
    fetch("/api/site-config", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (d?.branding) setBrand({ name: d.branding.siteName || "Coach Hayes Football", logo: d.branding.logo || "" }); }).catch(() => {});
    loadAll();
  }, []);

  async function runAi(sub: Sub) {
    setBusy("ai:" + sub.id); setMsg("");
    try {
      const res = await fetch("/api/rankings/ai-draft", { method: "POST", headers: { "Content-Type": "application/json", ...(await tok()) }, body: JSON.stringify({ submissionId: sub.id }) });
      const d = await res.json();
      if (d.ok) { setOpenId(sub.id); setDraft(d.draft); }
      else setMsg(d.error || "AI draft failed.");
    } catch { setMsg("AI draft failed."); } finally { setBusy(""); }
  }
  function openManual(sub: Sub) {
    setOpenId(sub.id);
    setDraft(sub.aiDraft || { chip: "bronze", bio: "", strengths: [], traits: [], seoTitle: "", seoDescription: "" });
  }
  async function publish(sub: Sub) {
    if (!draft) return;
    setBusy("pub:" + sub.id); setMsg("");
    try {
      const res = await fetch("/api/admin/players", { method: "POST", headers: { "Content-Type": "application/json", ...(await tok()) },
        body: JSON.stringify({ name: sub.playerName, position: sub.position, school: sub.school, city: (sub as any).city, state: sub.state, classYear: sub.classYear, videoUrl: sub.videoUrl, heightIn: sub.heightIn, weightLb: sub.weightLb, chip: draft.chip, bio: draft.bio, strengths: draft.strengths, traits: draft.traits, seoTitle: draft.seoTitle, seoDescription: draft.seoDescription, published: true, fromSubmissionId: sub.id }) });
      const d = await res.json();
      if (d.ok) { setMsg("Published — player page is live."); setOpenId(null); setDraft(null); loadAll(); }
      else setMsg(d.error || "Publish failed.");
    } catch { setMsg("Publish failed."); } finally { setBusy(""); }
  }
  async function reject(sub: Sub) { await fetch("/api/admin/submissions", { method: "PATCH", headers: { "Content-Type": "application/json", ...(await tok()) }, body: JSON.stringify({ id: sub.id, status: "rejected" }) }); loadAll(); }
  async function move(id: string, direction: "up" | "down") { await fetch("/api/admin/players", { method: "PATCH", headers: { "Content-Type": "application/json", ...(await tok()) }, body: JSON.stringify({ action: "move", id, direction }) }); loadAll(); }
  async function setChip(id: string, chip: string) { await fetch("/api/admin/players", { method: "PATCH", headers: { "Content-Type": "application/json", ...(await tok()) }, body: JSON.stringify({ id, chip }) }); loadAll(); }
  async function autoRank() { await fetch("/api/admin/players", { method: "PATCH", headers: { "Content-Type": "application/json", ...(await tok()) }, body: JSON.stringify({ action: "auto" }) }); loadAll(); }
  async function del(id: string) { await fetch(`/api/admin/players?id=${id}`, { method: "DELETE", headers: await tok() }); loadAll(); }
  async function saveFilm(id: string, videoUrl: string) { await fetch("/api/admin/players", { method: "PATCH", headers: { "Content-Type": "application/json", ...(await tok()) }, body: JSON.stringify({ id, videoUrl }) }); loadAll(); }
  async function setCatOnBoard(id: string, category: CategoryKey, chip: Chip) { await fetch("/api/admin/players", { method: "PATCH", headers: { "Content-Type": "application/json", ...(await tok()) }, body: JSON.stringify({ id, category, chip }) }); loadAll(); }
  async function saveYear(id: string, classYear: string) { await fetch("/api/admin/players", { method: "PATCH", headers: { "Content-Type": "application/json", ...(await tok()) }, body: JSON.stringify({ id, classYear }) }); loadAll(); }
  // Categories for a player, defaulting each to the overall chip when unset.
  const catsOf = (p: any): Record<CategoryKey, Chip> => { const base: Chip = ["bronze","silver","gold","blue"].includes(p.chip) ? p.chip : "bronze"; return { power: base, speed: base, motor: base, technique: base, iq: base, ...(p.categories || {}) }; };

  function openNew() { setMsg(""); setEditor(blankForm()); }
  function openEdit(p: any) {
    setMsg("");
    const base: Chip = ["bronze", "silver", "gold", "blue"].includes(p.chip) ? p.chip : "bronze";
    setEditor({
      id: p.id, slug: p.slug, name: p.name || "", position: p.position || "", school: p.school || "", city: p.city || "", state: p.state || "",
      classYear: p.classYear || "", commit: p.commit || "", commitLogo: p.commitLogo || "", videoUrl: p.videoUrl || "", heightIn: p.heightIn ? String(p.heightIn) : "", weightLb: p.weightLb ? String(p.weightLb) : "",
      fortyYd: p.fortyYd || "", categories: { ...blankCats(base), ...(p.categories || {}) }, categoryNotes: { ...blankNotes(), ...(p.categoryNotes || {}) }, overall: base,
      bio: p.bio || "", strengths: (p.strengths || []).join("\n"), traits: (p.traits || []).join(", "),
      seoTitle: p.seoTitle || "", seoDescription: p.seoDescription || "", published: p.published !== false,
    });
  }
  const ed = (patch: Partial<PForm>) => setEditor((e) => (e ? { ...e, ...patch } : e));
  const setCat = (key: CategoryKey, chip: Chip) => setEditor((e) => (e ? { ...e, categories: { ...e.categories, [key]: chip } } : e));
  const setCatNote = (key: CategoryKey, note: string) => setEditor((e) => (e ? { ...e, categoryNotes: { ...e.categoryNotes, [key]: note } } : e));
  async function findLogo() {
    if (!editor?.commit.trim()) return;
    setBusy("logo"); setMsg("");
    try {
      const r = await fetch(`/api/school-logo?q=${encodeURIComponent(editor.commit.trim())}`);
      const d = await r.json();
      if (d.found) ed({ commit: d.name, commitLogo: d.logo });
      else setMsg("No logo found for that school — paste a logo URL manually.");
    } catch { setMsg("Logo lookup failed."); } finally { setBusy(""); }
  }
  async function saveEditor() {
    if (!editor) return;
    if (!editor.name.trim()) { setMsg("Player name is required."); return; }
    setBusy("save"); setMsg("");
    try {
      const res = await fetch("/api/admin/players", { method: "POST", headers: { "Content-Type": "application/json", ...(await tok()) },
        body: JSON.stringify({
          id: editor.id, name: editor.name, position: editor.position, school: editor.school, city: editor.city, state: editor.state,
          classYear: editor.classYear, commit: editor.commit, commitLogo: editor.commitLogo, videoUrl: editor.videoUrl, heightIn: Number(editor.heightIn) || 0, weightLb: Number(editor.weightLb) || 0,
          fortyYd: editor.fortyYd, categories: editor.categories, categoryNotes: editor.categoryNotes, chip: editor.overall, bio: editor.bio,
          strengths: editor.strengths.split("\n").map((x) => x.trim()).filter(Boolean),
          traits: editor.traits.split(",").map((x) => x.trim()).filter(Boolean),
          seoTitle: editor.seoTitle, seoDescription: editor.seoDescription, published: editor.published,
        }) });
      const d = await res.json();
      if (d.ok) { setMsg(editor.id ? "Player updated." : "Player added."); setEditor(null); loadAll(); }
      else setMsg(d.error || "Save failed.");
    } catch { setMsg("Save failed."); } finally { setBusy(""); }
  }

  const pending = subs.filter((s) => s.status === "new" || s.status === "reviewing");

  // Board: filter by search, then paginate (25 per page). rank = position in the full list.
  const rankedFiltered = players.map((p, i) => ({ p, rank: i + 1 })).filter(({ p }) => p.name.toLowerCase().includes(search.trim().toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(rankedFiltered.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const pageItems = rankedFiltered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

  return (
    <Shell title="Rankings" sub={`${players.length} graded · ${pending.length} awaiting review`} brandName={brand.name} logo={brand.logo}>
      {msg && <div className="note" style={{ marginBottom: 14 }}>{msg}</div>}

      <div className="row4">
        <div className="card kpi"><b>{players.length}</b><span>Players graded</span><div className="d">Published pages</div></div>
        <div className="card kpi"><b>{pending.length}</b><span>Awaiting review</span><div className="d">In the queue</div></div>
        <div className="card kpi"><b>{players.filter((p) => p.chip === "blue").length}</b><span>Blue chips</span><div className="d">Top of the board</div></div>
        <div className="card kpi"><b>4</b><span>Chip tiers</span><div className="d">Blue · Gold · Silver · Bronze</div></div>
      </div>

      {/* Submissions queue */}
      <div className="card">
        <h3>Film submissions</h3>
        <p className="cs">Run the AI scout, edit the grade, then publish. Members go to the front.</p>
        {pending.length === 0 && <div className="note" style={{ margin: 0 }}>No submissions waiting. They arrive from the public Rankings page.</div>}
        {pending.map((sub) => (
          <div key={sub.id} style={{ borderTop: "1px solid var(--hair)", paddingTop: 14, marginTop: 14 }}>
            <div className="r" style={{ border: "none", padding: 0 }}>
              <span className="nm"><b>{sub.playerName}</b><span>{sub.position} · {sub.school}{sub.state ? `, ${sub.state}` : ""} · {sub.classYear} · <a className="link" href={sub.videoUrl} target="_blank" rel="noreferrer">film ›</a></span></span>
              <span className="act">
                <button className="btn sm" disabled={busy === "ai:" + sub.id} onClick={() => runAi(sub)}>{busy === "ai:" + sub.id ? "Scouting…" : "AI scout"}</button>
                <button className="btn sm" onClick={() => openManual(sub)}>Grade</button>
                <button className="btn sm" onClick={() => reject(sub)}>Reject</button>
              </span>
            </div>

            {openId === sub.id && draft && (
              <div className="card" style={{ marginTop: 12, background: "var(--soft)" }}>
                <div className="fld"><label>Chip grade</label>
                  <div className="chips" style={{ margin: 0 }}>
                    {CHIPS.map((c) => (
                      <button key={c.key} className={`chipf${draft.chip === c.key ? " on" : ""}`} onClick={() => setDraft({ ...draft, chip: c.key })}>
                        <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: "50%", background: c.ring, marginRight: 6, verticalAlign: "middle" }} />{c.label}
                      </button>
                    ))}
                  </div>
                  {draft.chipRationale && <p className="cs" style={{ marginTop: 8 }}>AI: {draft.chipRationale}</p>}
                </div>
                <div className="fld"><label>Scouting report</label><textarea rows={4} value={draft.bio} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} /></div>
                <div className="fld"><label>Strengths (one per line)</label><textarea rows={3} value={draft.strengths.join("\n")} onChange={(e) => setDraft({ ...draft, strengths: e.target.value.split("\n").filter(Boolean) })} /></div>
                <div className="fld"><label>Traits (comma separated)</label><input value={draft.traits.join(", ")} onChange={(e) => setDraft({ ...draft, traits: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} /></div>
                <div className="row2e" style={{ margin: 0 }}>
                  <div className="fld"><label>SEO title</label><input value={draft.seoTitle} onChange={(e) => setDraft({ ...draft, seoTitle: e.target.value })} /></div>
                  <div className="fld"><label>SEO description</label><input value={draft.seoDescription} onChange={(e) => setDraft({ ...draft, seoDescription: e.target.value })} /></div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <button className="btn acc" disabled={busy === "pub:" + sub.id} onClick={() => publish(sub)}>{busy === "pub:" + sub.id ? "Publishing…" : "Publish player page"}</button>
                  <button className="btn" onClick={() => { setOpenId(null); setDraft(null); }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* The board */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div><h3>The board</h3><p className="cs" style={{ margin: 0 }}>Ranked highest first. Auto by chip; drag with the arrows to override.</p></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input className="boardsearch" placeholder="Search players…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            <button className="btn sm" onClick={autoRank}>Auto-rank by chip</button>
            <button className="btn acc" onClick={openNew}>+ Add player</button>
          </div>
        </div>

        {editor && (
          <div className="modal" onClick={(e) => { if (e.target === e.currentTarget) setEditor(null); }}>
            <div className="modalcard">
              <div className="modalhead">
                <h3>{editor.id ? "Edit player" : "Add player"}</h3>
                <button className="modalx" onClick={() => setEditor(null)} aria-label="Close">✕</button>
              </div>
              <div className="modalbody">
            <div className="row2e" style={{ margin: 0 }}>
              <div className="fld"><label>Name *</label><input value={editor.name} onChange={(e) => ed({ name: e.target.value })} /></div>
              <div className="fld"><label>Position</label><input value={editor.position} onChange={(e) => ed({ position: e.target.value })} placeholder="WR, QB, DB…" /></div>
            </div>
            <div className="row2e" style={{ margin: 0 }}>
              <div className="fld"><label>High school</label><input value={editor.school} onChange={(e) => ed({ school: e.target.value })} /></div>
              <div className="fld"><label>Class year</label><input value={editor.classYear} onChange={(e) => ed({ classYear: e.target.value })} placeholder="2027" /></div>
            </div>
            <div className="row2e" style={{ margin: 0 }}>
              <div className="fld"><label>City</label><input value={editor.city} onChange={(e) => ed({ city: e.target.value })} /></div>
              <div className="fld"><label>State</label><input value={editor.state} onChange={(e) => ed({ state: e.target.value })} placeholder="FL" /></div>
            </div>
            <div className="fld"><label>Committed to (school)</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {editor.commitLogo ? <img src={editor.commitLogo} alt="" style={{ width: 30, height: 30, objectFit: "contain", flexShrink: 0 }} /> : null}
                <input value={editor.commit} onChange={(e) => ed({ commit: e.target.value })} placeholder="Miami, Georgia, Alabama…" style={{ flex: 1 }} />
                <button type="button" className="btn sm" disabled={busy === "logo"} onClick={findLogo}>{busy === "logo" ? "…" : "Find logo"}</button>
              </div>
              <input value={editor.commitLogo} onChange={(e) => ed({ commitLogo: e.target.value })} placeholder="Logo URL (auto-filled from Find logo, or paste one)" style={{ marginTop: 8, fontSize: 12 }} />
            </div>
            <div className="fld"><label>Highlight film URL</label><input value={editor.videoUrl} onChange={(e) => ed({ videoUrl: e.target.value })} placeholder="https://youtube.com/…" /></div>
            <div className="row3e" style={{ margin: 0, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div className="fld"><label>Height (in)</label><input value={editor.heightIn} onChange={(e) => ed({ heightIn: e.target.value })} placeholder="72" /></div>
              <div className="fld"><label>Weight (lb)</label><input value={editor.weightLb} onChange={(e) => ed({ weightLb: e.target.value })} placeholder="185" /></div>
              <div className="fld"><label>40 time</label><input value={editor.fortyYd} onChange={(e) => ed({ fortyYd: e.target.value })} placeholder="4.5" /></div>
            </div>
            <div className="fld"><label>Category grades &amp; notes — each scores 1–4 (Bronze → Blue). Notes show on the player page.</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {CATEGORIES.map((cat) => (
                  <div className="catrow2" key={cat.key}>
                    <div className="catrow2-top">
                      <span className="catname"><span className="chipmed" style={{ background: ring(editor.categories[cat.key]) }} />{cat.label}</span>
                      <select value={editor.categories[cat.key]} onChange={(e) => setCat(cat.key, e.target.value as Chip)}>
                        {CHIPS.map((c) => <option key={c.key} value={c.key}>{c.label} · {CHIP_SCORE[c.key as Chip]}</option>)}
                      </select>
                    </div>
                    <input className="catnote" placeholder={`Note on ${cat.label.toLowerCase()} — shows on the public breakdown`} value={editor.categoryNotes[cat.key]} onChange={(e) => setCatNote(cat.key, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
            <div className="fld"><label>Overall chip</label>
              {(() => { const rec = recommendedOverall(editor.categories); return (
                <div className="overallrow">
                  <span className="chipsel">
                    <span className="chipmed" style={{ background: ring(editor.overall) }} />
                    <select value={editor.overall} onChange={(e) => ed({ overall: e.target.value as Chip })}>
                      {CHIPS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </span>
                  <span className="cs">Recommended: <b style={{ color: "var(--ink)" }}>{CHIPS.find((c) => c.key === rec.chip)?.label}</b> (avg {rec.avg.toFixed(1)})
                    {editor.overall !== rec.chip && <> · <button type="button" className="link" onClick={() => ed({ overall: rec.chip })}>use recommended</button></>}
                  </span>
                </div>
              ); })()}
            </div>
            <div className="fld"><label>Scouting report</label><textarea rows={4} value={editor.bio} onChange={(e) => ed({ bio: e.target.value })} /></div>
            <div className="fld"><label>Strengths (one per line)</label><textarea rows={3} value={editor.strengths} onChange={(e) => ed({ strengths: e.target.value })} /></div>
            <div className="fld"><label>Traits (comma separated)</label><input value={editor.traits} onChange={(e) => ed({ traits: e.target.value })} placeholder="Hands, Route running" /></div>
            <div className="row2e" style={{ margin: 0 }}>
              <div className="fld"><label>SEO title</label><input value={editor.seoTitle} onChange={(e) => ed({ seoTitle: e.target.value })} /></div>
              <div className="fld"><label>SEO description</label><input value={editor.seoDescription} onChange={(e) => ed({ seoDescription: e.target.value })} /></div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 2px", fontSize: 13 }}>
              <input type="checkbox" checked={editor.published} onChange={(e) => ed({ published: e.target.checked })} style={{ width: "auto" }} />
              Published (visible on the public board)
            </label>
              </div>
              <div className="modalfoot">
                <button className="btn acc" disabled={busy === "save"} onClick={saveEditor}>{busy === "save" ? "Saving…" : editor.id ? "Save changes" : "Add player"}</button>
                <button className="btn" onClick={() => setEditor(null)}>Cancel</button>
                {editor.id && (
                  <>
                    <Link className="btn" href={`/rankings/${editor.slug || ""}`} target="_blank" style={{ marginLeft: "auto" }}>View page ↗</Link>
                    <button className="btn btn-danger" onClick={() => { if (confirm(`Delete ${editor.name}? This removes the player and their public page.`)) { del(editor.id!); setEditor(null); } }}>Delete</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="tbwrap" style={{ marginTop: 12 }}><table>
          <thead><tr><th>#</th><th className="playercol">Player</th><th>Year</th><th>Commit</th><th>Chips (PWR · SPD · MTR · TEC · IQ)</th><th>Score</th><th>Film</th><th>Status</th><th>Order</th><th /></tr></thead>
          <tbody>
            {pageItems.map(({ p, rank }) => {
              const cats = catsOf(p);
              const rec = recommendedOverall(cats);
              return (
              <tr key={p.id}>
                <td>{String(rank).padStart(2, "0")}</td>
                <td className="playercol"><b>{p.name}</b><div className="muted">{[p.position, (p as any).school].filter(Boolean).join(" · ")}</div></td>
                <td>
                  <input className="yearinput" defaultValue={p.classYear || ""} placeholder="—" maxLength={4}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    onBlur={(e) => { const v = e.target.value.trim(); if (v !== (p.classYear || "")) saveYear(p.id, v); }} />
                </td>
                <td className="commitcell">
                  {(p as any).commitLogo ? <img src={(p as any).commitLogo} alt={(p as any).commit || ""} title={(p as any).commit || ""} /> : <span className="muted">—</span>}
                </td>
                <td>
                  <span className="catcells">
                    {CATEGORIES.map((cat) => (
                      <div key={cat.key} className="catcell" title={cat.label}>
                        <span className="catcell-lbl">{cat.abbr}</span>
                        <ChipPicker value={cats[cat.key]} onChange={(c) => setCatOnBoard(p.id, cat.key, c)} />
                      </div>
                    ))}
                  </span>
                </td>
                <td>
                  <span className="scorecell" title={`Recommended overall: ${CHIPS.find((c) => c.key === rec.chip)?.label}`}>
                    <span className="chipmed" style={{ background: ring(rec.chip) }} />
                    <b>{rec.avg.toFixed(1)}</b>
                  </span>
                </td>
                <td>
                  <span className="filmcell">
                    <input className="filminput" defaultValue={(p as any).videoUrl || ""} placeholder="Paste YouTube link"
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      onBlur={(e) => { const v = e.target.value.trim(); if (v !== ((p as any).videoUrl || "")) saveFilm(p.id, v); }} />
                    {(p as any).videoUrl ? <a className="link" href={(p as any).videoUrl} target="_blank" rel="noreferrer" title="Open film">↗</a> : null}
                  </span>
                </td>
                <td>{p.published !== false ? <span className="pill ok">Published</span> : <span className="pill warn">Draft</span>}</td>
                <td className="ordcell"><button className="btn xs" onClick={() => move(p.id, "up")} aria-label="Move up">↑</button><button className="btn xs" onClick={() => move(p.id, "down")} aria-label="Move down">↓</button></td>
                <td className="row-actions"><button className="btn sm" onClick={() => openEdit(p)}>Edit</button></td>
              </tr>
              );
            })}
            {players.length === 0 && <tr><td colSpan={10} className="muted" style={{ padding: 16 }}>No players yet. Use “+ Add player” above, or publish one from a submission.</td></tr>}
            {players.length > 0 && rankedFiltered.length === 0 && <tr><td colSpan={10} className="muted" style={{ padding: 16 }}>No players match “{search}”.</td></tr>}
          </tbody>
        </table></div>

        {rankedFiltered.length > 0 && (
          <div className="pager">
            <span className="cs">Showing {(curPage - 1) * PAGE_SIZE + 1}–{Math.min(curPage * PAGE_SIZE, rankedFiltered.length)} of {rankedFiltered.length}</span>
            {totalPages > 1 && (
              <div className="pager-btns">
                <button className="btn sm" disabled={curPage <= 1} onClick={() => setPage(curPage - 1)}>‹ Prev</button>
                <span className="cs">Page {curPage} of {totalPages}</span>
                <button className="btn sm" disabled={curPage >= totalPages} onClick={() => setPage(curPage + 1)}>Next ›</button>
              </div>
            )}
          </div>
        )}
        <div className="note" style={{ marginTop: 12 }}><b>Removal requests.</b> These are high school players. Parents or players can ask for a page to come down — honor it from here.</div>
      </div>
    </Shell>
  );
}
