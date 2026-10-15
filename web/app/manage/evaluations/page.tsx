"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Shell from "@/components/hayes/admin/Shell";
import { getIdToken } from "@/lib/firebase";
import { EMPTY_EVALUATION, type Evaluation } from "@/lib/evaluation";

// Admin Evaluations — the "Honest Evaluations" workflow, moved out of Rankings:
// film submissions arrive here; Coach records his read of the film (voice →
// Whisper), ChatGPT structures it into the long-form report, Coach edits and
// publishes, and sets whether the breakdown is free or a paid (manual) unlock.
type Sub = { id: string; playerName: string; position: string; school: string; city?: string; state?: string; classYear: string; videoUrl: string; heightIn?: number; weightLb?: number; notes?: string; status: string; submitterEmail?: string; submitterRelation?: string };
type Player = { id: string; slug?: string; name: string; position: string; school: string; classYear: string; videoUrl?: string; city?: string; state?: string; heightIn?: number; weightLb?: number; notes?: string; evaluation?: Evaluation | null; evalAccess?: string; evalPrice?: string; evalUnlockEmails?: string[] };

type EForm = {
  playerId?: string; submissionId?: string; slug?: string;
  name: string; position: string; school: string; city: string; state: string; classYear: string;
  heightIn: string; weightLb: string; jersey: string; videoUrl: string; notes: string;
  transcript: string;
  size: string; speed: string; effort: string; positionAnalysis: string; additionalComments: string; finalAssessment: string; projection: string;
  strengths: string; improvements: string; recommendedTargets: string; developmentPriorities: string;
  evalAccess: "none" | "free" | "locked"; evalPrice: string; evalUnlockEmails: string;
};

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const join = (a?: string[]) => (a || []).join("\n");

function blankForm(seed: Partial<EForm> = {}): EForm {
  return {
    name: "", position: "", school: "", city: "", state: "", classYear: "", heightIn: "", weightLb: "", jersey: "", videoUrl: "", notes: "",
    transcript: "", size: "", speed: "", effort: "", positionAnalysis: "", additionalComments: "", finalAssessment: "", projection: "",
    strengths: "", improvements: "", recommendedTargets: "", developmentPriorities: "",
    evalAccess: "free", evalPrice: "", evalUnlockEmails: "", ...seed,
  };
}
function evalToForm(e: Evaluation): Partial<EForm> {
  return {
    size: e.size, speed: e.speed, effort: e.effort, positionAnalysis: e.positionAnalysis,
    additionalComments: e.additionalComments, finalAssessment: e.finalAssessment, projection: e.projection,
    strengths: join(e.strengths), improvements: join(e.improvements), recommendedTargets: join(e.recommendedTargets),
    developmentPriorities: join(e.developmentPriorities),
  };
}
function formToEval(f: EForm): Evaluation {
  return {
    ...EMPTY_EVALUATION,
    size: f.size, speed: f.speed, effort: f.effort, positionAnalysis: f.positionAnalysis,
    additionalComments: f.additionalComments, finalAssessment: f.finalAssessment, projection: f.projection,
    strengths: lines(f.strengths), improvements: lines(f.improvements), recommendedTargets: lines(f.recommendedTargets),
    developmentPriorities: lines(f.developmentPriorities),
  };
}

export default function EvaluationsAdmin() {
  const [brand, setBrand] = useState({ name: "Coach Hayes Football", logo: "" });
  const [subs, setSubs] = useState<Sub[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [editor, setEditor] = useState<EForm | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

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

  const pending = subs.filter((s) => s.status === "new" || s.status === "reviewing");
  const evaluated = players.filter((p) => p.evaluation && (p.evalAccess || "none") !== "none");

  function startFromSubmission(s: Sub) {
    setMsg("");
    setEditor(blankForm({
      submissionId: s.id, name: s.playerName, position: s.position || "", school: s.school || "", city: s.city || "", state: s.state || "",
      classYear: s.classYear || "", heightIn: s.heightIn ? String(s.heightIn) : "", weightLb: s.weightLb ? String(s.weightLb) : "",
      videoUrl: s.videoUrl || "", notes: s.notes || "",
    }));
  }
  function startFromPlayer(p: Player) {
    setMsg("");
    const base = blankForm({
      playerId: p.id, slug: p.slug, name: p.name, position: p.position || "", school: p.school || "", city: p.city || "", state: p.state || "",
      classYear: p.classYear || "", heightIn: p.heightIn ? String(p.heightIn) : "", weightLb: p.weightLb ? String(p.weightLb) : "",
      videoUrl: p.videoUrl || "", notes: p.notes || "",
      evalAccess: (p.evalAccess as any) || "free", evalPrice: p.evalPrice || "", evalUnlockEmails: (p.evalUnlockEmails || []).join("\n"),
    });
    setEditor(p.evaluation ? { ...base, ...evalToForm(p.evaluation) } : base);
  }

  const ed = (patch: Partial<EForm>) => setEditor((e) => (e ? { ...e, ...patch } : e));

  // ---- Voice capture → Whisper transcription ----
  const [recording, setRecording] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  async function toggleRecord() {
    if (recording) { mediaRef.current?.stop(); setRecording(false); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        await transcribe(blob);
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true); setMsg("");
    } catch { setMsg("Microphone access was blocked. Allow the mic to record Coach's read."); }
  }
  async function transcribe(blob: Blob) {
    setBusy("transcribe"); setMsg("");
    try {
      const fd = new FormData(); fd.append("audio", blob, "coach-eval.webm");
      const res = await fetch("/api/admin/transcribe", { method: "POST", headers: await tok(), body: fd });
      const d = await res.json();
      if (d.ok) ed({ transcript: ((editor?.transcript || "") + (editor?.transcript ? "\n\n" : "") + d.text).trim() });
      else setMsg(d.error || "Transcription failed.");
    } catch { setMsg("Transcription failed."); } finally { setBusy(""); }
  }

  // ---- ChatGPT: generate the long-form evaluation ----
  async function generate() {
    if (!editor) return;
    setBusy("gen"); setMsg("");
    try {
      const res = await fetch("/api/admin/evaluation", {
        method: "POST", headers: { "Content-Type": "application/json", ...(await tok()) },
        body: JSON.stringify({
          submissionId: editor.submissionId, playerId: editor.playerId,
          playerName: editor.name, position: editor.position, school: editor.school, city: editor.city, state: editor.state,
          classYear: editor.classYear, heightIn: Number(editor.heightIn) || undefined, weightLb: Number(editor.weightLb) || undefined,
          jersey: editor.jersey, videoUrl: editor.videoUrl, notes: editor.notes, transcript: editor.transcript,
        }),
      });
      const d = await res.json();
      if (d.ok && d.evaluation) { ed(evalToForm(d.evaluation)); setMsg("Draft written by ChatGPT. Review and edit, then publish."); }
      else setMsg(d.error || "Could not generate the evaluation.");
    } catch { setMsg("Could not generate the evaluation."); } finally { setBusy(""); }
  }

  async function save() {
    if (!editor) return;
    if (!editor.name.trim()) { setMsg("Player name is required."); return; }
    setBusy("save"); setMsg("");
    try {
      const res = await fetch("/api/admin/players", {
        method: "POST", headers: { "Content-Type": "application/json", ...(await tok()) },
        body: JSON.stringify({
          id: editor.playerId, name: editor.name, position: editor.position, school: editor.school, city: editor.city, state: editor.state,
          classYear: editor.classYear, heightIn: Number(editor.heightIn) || 0, weightLb: Number(editor.weightLb) || 0, videoUrl: editor.videoUrl,
          evaluation: formToEval(editor), evalAccess: editor.evalAccess, evalPrice: editor.evalPrice, evalUnlockEmails: lines(editor.evalUnlockEmails),
          fromSubmissionId: editor.submissionId, published: true, announce: false,
        }),
      });
      const d = await res.json();
      if (d.ok) { setMsg("Evaluation saved."); setEditor(null); loadAll(); }
      else setMsg(d.error || "Save failed.");
    } catch { setMsg("Save failed."); } finally { setBusy(""); }
  }

  async function reject(s: Sub) {
    await fetch("/api/admin/submissions", { method: "PATCH", headers: { "Content-Type": "application/json", ...(await tok()) }, body: JSON.stringify({ id: s.id, status: "rejected" }) });
    loadAll();
  }
  // Quick free/lock toggle from the evaluated list (no full edit).
  async function toggleAccess(p: Player) {
    const next = (p.evalAccess === "free" ? "locked" : "free");
    await fetch("/api/admin/players", { method: "POST", headers: { "Content-Type": "application/json", ...(await tok()) }, body: JSON.stringify({ id: p.id, name: p.name, evalAccess: next }) });
    loadAll();
  }

  return (
    <Shell title="Evaluations" sub={`${pending.length} awaiting review · ${evaluated.length} published`} brandName={brand.name} logo={brand.logo}>
      {msg && <div className="note" style={{ marginBottom: 14 }}>{msg}</div>}

      {/* Film submissions queue */}
      <div className="card">
        <h3>Film submissions</h3>
        <p className="cs">A new submission emails you here. Record your read of the film, let ChatGPT write it up, edit, then publish.</p>
        {pending.length === 0 && <div className="note" style={{ margin: 0 }}>No submissions waiting. They arrive from the public Rankings page.</div>}
        {pending.map((s) => (
          <div key={s.id} className="r" style={{ borderTop: "1px solid var(--hair)", paddingTop: 14, marginTop: 14 }}>
            <span className="nm"><b>{s.playerName}</b><span>{[s.position, s.school, s.state].filter(Boolean).join(" · ")}{s.classYear ? ` · ${s.classYear}` : ""} · <a className="link" href={s.videoUrl} target="_blank" rel="noreferrer">film ›</a>{s.submitterEmail ? ` · ${s.submitterRelation || "from"}: ${s.submitterEmail}` : ""}</span></span>
            <span className="act">
              <button className="btn acc sm" onClick={() => startFromSubmission(s)}>Evaluate</button>
              <button className="btn sm" onClick={() => reject(s)}>Reject</button>
            </span>
          </div>
        ))}
      </div>

      {/* Published evaluations */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div><h3>Published evaluations</h3><p className="cs" style={{ margin: 0 }}>Toggle free vs. locked (paid). Locked evaluations show a teaser until you unlock them to a paying viewer&apos;s email.</p></div>
          <button className="btn acc" onClick={() => setEditor(blankForm())}>+ New evaluation</button>
        </div>
        <div className="tbwrap" style={{ marginTop: 12 }}><table>
          <thead><tr><th>Player</th><th>Position</th><th>Access</th><th>Price</th><th>Unlocked</th><th /></tr></thead>
          <tbody>
            {evaluated.map((p) => (
              <tr key={p.id}>
                <td><b>{p.name}</b><div className="muted">{[p.school, p.classYear].filter(Boolean).join(" · ")}</div></td>
                <td>{p.position || "—"}</td>
                <td>
                  <button className={`pill ${p.evalAccess === "free" ? "ok" : "warn"}`} onClick={() => toggleAccess(p)} title="Click to toggle">
                    {p.evalAccess === "free" ? "Free" : "Locked"}
                  </button>
                </td>
                <td>{p.evalAccess === "locked" ? (p.evalPrice || "—") : "—"}</td>
                <td className="muted">{p.evalAccess === "locked" ? `${(p.evalUnlockEmails || []).length} viewer(s)` : "—"}</td>
                <td className="row-actions">
                  <button className="btn sm" onClick={() => startFromPlayer(p)}>Edit</button>
                  {p.slug && <Link className="btn sm" href={`/rankings/${p.slug}`} target="_blank">View ↗</Link>}
                </td>
              </tr>
            ))}
            {evaluated.length === 0 && <tr><td colSpan={6} className="muted" style={{ padding: 16 }}>No evaluations yet. Start one from a submission above, or “+ New evaluation”.</td></tr>}
          </tbody>
        </table></div>
      </div>

      {/* Editor modal */}
      {editor && (
        <div className="modal" onClick={(e) => { if (e.target === e.currentTarget) setEditor(null); }}>
          <div className="modalcard" style={{ maxWidth: 760 }}>
            <div className="modalhead">
              <h3>{editor.playerId ? "Edit evaluation" : "New evaluation"}{editor.name ? ` — ${editor.name}` : ""}</h3>
              <button className="modalx" onClick={() => setEditor(null)} aria-label="Close">✕</button>
            </div>
            <div className="modalbody">
              {/* Identity */}
              <div className="row2e" style={{ margin: 0 }}>
                <div className="fld"><label>Name *</label><input value={editor.name} onChange={(e) => ed({ name: e.target.value })} /></div>
                <div className="fld"><label>Position</label><input value={editor.position} onChange={(e) => ed({ position: e.target.value })} placeholder="Center, WR, DB…" /></div>
              </div>
              <div className="row2e" style={{ margin: 0 }}>
                <div className="fld"><label>High school</label><input value={editor.school} onChange={(e) => ed({ school: e.target.value })} /></div>
                <div className="fld"><label>Class year</label><input value={editor.classYear} onChange={(e) => ed({ classYear: e.target.value })} placeholder="2027" /></div>
              </div>
              <div className="row3e" style={{ margin: 0, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div className="fld"><label>Height (in)</label><input value={editor.heightIn} onChange={(e) => ed({ heightIn: e.target.value })} placeholder="76" /></div>
                <div className="fld"><label>Weight (lb)</label><input value={editor.weightLb} onChange={(e) => ed({ weightLb: e.target.value })} placeholder="315" /></div>
                <div className="fld"><label>Jersey #</label><input value={editor.jersey} onChange={(e) => ed({ jersey: e.target.value })} placeholder="56" /></div>
              </div>
              <div className="fld"><label>Highlight film URL</label><input value={editor.videoUrl} onChange={(e) => ed({ videoUrl: e.target.value })} placeholder="https://hudl.com/… or youtube.com/…" /></div>

              {/* Voice → transcript → ChatGPT */}
              <div className="evgen">
                <div className="evgen-top">
                  <div><b>Coach&apos;s read of the film</b><p className="cs" style={{ margin: "2px 0 0" }}>Hit record and talk through the tape. We transcribe it, then ChatGPT writes the full report from your words.</p></div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button type="button" className={`btn sm${recording ? " btn-danger" : ""}`} onClick={toggleRecord} disabled={busy === "transcribe"}>
                      {recording ? "■ Stop" : busy === "transcribe" ? "Transcribing…" : "● Record"}
                    </button>
                    <button type="button" className="btn acc sm" onClick={generate} disabled={busy === "gen"}>{busy === "gen" ? "Writing…" : "Generate with ChatGPT"}</button>
                  </div>
                </div>
                <textarea rows={4} value={editor.transcript} onChange={(e) => ed({ transcript: e.target.value })} placeholder="Record your read, or type/paste notes here. ChatGPT builds the evaluation from this (plus the profile above). Leave blank to let it draft conservatively from the film metadata." />
              </div>

              {/* Long-form sections */}
              <div className="fld"><label>Size</label><textarea rows={3} value={editor.size} onChange={(e) => ed({ size: e.target.value })} /></div>
              <div className="fld"><label>Speed &amp; movement</label><textarea rows={3} value={editor.speed} onChange={(e) => ed({ speed: e.target.value })} /></div>
              <div className="fld"><label>Effort</label><textarea rows={3} value={editor.effort} onChange={(e) => ed({ effort: e.target.value })} /></div>
              <div className="fld"><label>Position analysis</label><textarea rows={3} value={editor.positionAnalysis} onChange={(e) => ed({ positionAnalysis: e.target.value })} /></div>
              <div className="row2e" style={{ margin: 0 }}>
                <div className="fld"><label>Areas of strength (one per line)</label><textarea rows={4} value={editor.strengths} onChange={(e) => ed({ strengths: e.target.value })} /></div>
                <div className="fld"><label>Areas for improvement (one per line)</label><textarea rows={4} value={editor.improvements} onChange={(e) => ed({ improvements: e.target.value })} /></div>
              </div>
              <div className="fld"><label>Recommended recruiting targets (one per line)</label><textarea rows={3} value={editor.recommendedTargets} onChange={(e) => ed({ recommendedTargets: e.target.value })} /></div>
              <div className="fld"><label>Additional comments</label><textarea rows={3} value={editor.additionalComments} onChange={(e) => ed({ additionalComments: e.target.value })} /></div>
              <div className="fld"><label>Development priorities (one per line)</label><textarea rows={4} value={editor.developmentPriorities} onChange={(e) => ed({ developmentPriorities: e.target.value })} /></div>
              <div className="fld"><label>Final recruiting assessment</label><textarea rows={4} value={editor.finalAssessment} onChange={(e) => ed({ finalAssessment: e.target.value })} /></div>
              <div className="fld"><label>Projection (one line)</label><input value={editor.projection} onChange={(e) => ed({ projection: e.target.value })} placeholder="Division II or below · select HBCU opportunities" /></div>

              {/* Paywall / access */}
              <div className="evaccess">
                <div className="fld" style={{ margin: 0 }}><label>Who can read this evaluation?</label>
                  <div className="chips" style={{ margin: 0 }}>
                    {(["free", "locked"] as const).map((a) => (
                      <button type="button" key={a} className={`chipf${editor.evalAccess === a ? " on" : ""}`} onClick={() => ed({ evalAccess: a })}>
                        {a === "free" ? "Free — anyone" : "Locked — paid unlock"}
                      </button>
                    ))}
                  </div>
                </div>
                {editor.evalAccess === "locked" && (
                  <>
                    <div className="fld"><label>Price to show (display only)</label><input value={editor.evalPrice} onChange={(e) => ed({ evalPrice: e.target.value })} placeholder="$49" /></div>
                    <div className="fld"><label>Unlocked for these emails (one per line) — add a viewer after they pay</label>
                      <textarea rows={2} value={editor.evalUnlockEmails} onChange={(e) => ed({ evalUnlockEmails: e.target.value })} placeholder="parent@email.com" />
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="modalfoot">
              <button className="btn acc" disabled={busy === "save"} onClick={save}>{busy === "save" ? "Saving…" : "Save & publish"}</button>
              <button className="btn" onClick={() => setEditor(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
