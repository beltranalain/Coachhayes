"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/hayes/admin/Shell";
import { getIdToken } from "@/lib/firebase";

// Admin Schedule — real editor for the weekly broadcast schedule. Saves to
// Firestore via /api/site-config (section:"schedule"); the public home "This
// week" section and /shows upcoming grid read the same items.
type Item = { when: string; title: string; note: string; startsAt?: number; tz?: string };

export default function ScheduleAdmin() {
  const [brand, setBrand] = useState({ name: "Coach Hayes Football", logo: "" });
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const tok = async (): Promise<Record<string, string>> => { const t = await getIdToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };

  useEffect(() => {
    fetch("/api/site-config", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      if (d?.branding) setBrand({ name: d.branding.siteName || "Coach Hayes Football", logo: d.branding.logo || "" });
      if (Array.isArray(d?.schedule)) setItems(d.schedule.map((s: any) => ({ when: s.when || "", title: s.title || "", note: s.note || "", startsAt: s.startsAt, tz: s.tz })));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const set = (i: number, patch: Partial<Item>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const add = () => setItems((xs) => [...xs, { when: "", title: "", note: "" }]);
  const remove = (i: number) => setItems((xs) => xs.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => setItems((xs) => { const j = i + dir; if (j < 0 || j >= xs.length) return xs; const c = [...xs]; [c[i], c[j]] = [c[j], c[i]]; return c; });

  async function save() {
    setBusy(true); setMsg("");
    try {
      const clean = items.filter((x) => x.title.trim());
      const res = await fetch("/api/site-config", { method: "POST", headers: { "Content-Type": "application/json", ...(await tok()) }, body: JSON.stringify({ section: "schedule", data: { items: clean } }) });
      const d = await res.json();
      if (d.saved) setMsg("Schedule saved — it's live on the site.");
      else if (d.demo) setMsg("Demo mode — connect Firebase to save.");
      else setMsg(d.error || "Save failed.");
    } catch { setMsg("Save failed."); } finally { setBusy(false); }
  }

  const count = items.filter((x) => x.title.trim()).length;

  return (
    <Shell title="Schedule" sub={`${count} broadcast${count === 1 ? "" : "s"} scheduled`} brandName={brand.name} logo={brand.logo}>
      {msg && <div className="note" style={{ marginBottom: 14 }}>{msg}</div>}

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div><h3>Scheduled broadcasts</h3><p className="cs" style={{ margin: 0 }}>These show on the home page “This week” strip and the Shows page. Set the title before you promote it.</p></div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn sm" onClick={add}>+ Add broadcast</button>
            <button className="btn acc" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save schedule"}</button>
          </div>
        </div>

        {loading ? (
          <div className="note" style={{ marginTop: 14 }}>Loading…</div>
        ) : items.length === 0 ? (
          <div className="note" style={{ marginTop: 14 }}>No broadcasts yet. Add one — it appears on the site immediately after you save.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
            {items.map((it, i) => (
              <div key={i} className="card" style={{ background: "var(--soft)", padding: 16 }}>
                <div className="row2e" style={{ margin: 0 }}>
                  <div className="fld" style={{ marginBottom: 10 }}><label>When (as shown to fans)</label><input value={it.when} onChange={(e) => set(i, { when: e.target.value })} placeholder="Tonight · 8:00 PM ET" /></div>
                  <div className="fld" style={{ marginBottom: 10 }}><label>Title *</label><input value={it.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="The Live Show" /></div>
                </div>
                <div className="fld" style={{ marginBottom: 10 }}><label>Note / episode</label><input value={it.note} onChange={(e) => set(i, { note: e.target.value })} placeholder="What this episode covers" /></div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn xs" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                  <button className="btn xs" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down">↓</button>
                  <button className="btn sm btn-danger" style={{ marginLeft: "auto" }} onClick={() => remove(i)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="note"><b>Tip.</b> The “When” text is exactly what fans see (e.g. “Tonight · 8 PM ET” or “Sat · noon”). Keep it short. Reorder with the arrows — top shows first.</div>
    </Shell>
  );
}
