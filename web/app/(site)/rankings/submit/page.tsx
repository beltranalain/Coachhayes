"use client";

import { useState } from "react";
import Link from "next/link";

// Public: players/parents submit film + profile for review. Lands in the admin
// queue where the AI drafts a report and the coach approves. Contact email is
// private (minors protection) — never shown publicly.
export default function SubmitFilmPage() {
  const [f, setF] = useState({ playerName: "", position: "", school: "", city: "", state: "", classYear: "", videoUrl: "", heightIn: "", weightLb: "", notes: "", submitterEmail: "", submitterRelation: "player" });
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [err, setErr] = useState("");
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending"); setErr("");
    try {
      const res = await fetch("/api/rankings/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const d = await res.json();
      if (d.ok || d.demo) setStatus("done");
      else { setErr(d.error || "Could not submit."); setStatus("error"); }
    } catch { setErr("Could not submit."); setStatus("error"); }
  }

  if (status === "done") {
    return (
      <div className="wide" style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 640 }}>
        <div className="card center">
          <h2 style={{ marginBottom: 8 }}>Film received.</h2>
          <p style={{ color: "var(--sub)", marginBottom: 18 }}>Coach reviews every submission and you’ll get a yes or a no. Members go to the front of the queue.</p>
          <Link className="pill" href="/rankings">Back to the rankings</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wide" style={{ paddingTop: 34, paddingBottom: 60, maxWidth: 720 }}>
      <div className="hd" style={{ margin: "0 0 22px" }}>
        <h2>Submit your film.</h2>
        <p>Send a highlight link and a short profile. Coach grades it on the four-chip scale — every submission gets a yes or a no.</p>
      </div>
      <form className="card" onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="g2">
          <Field label="Player name *" v={f.playerName} on={(v) => set("playerName", v)} />
          <Field label="Position" v={f.position} on={(v) => set("position", v)} ph="WR, QB, DB…" />
        </div>
        <div className="g2">
          <Field label="High school" v={f.school} on={(v) => set("school", v)} />
          <Field label="Class year" v={f.classYear} on={(v) => set("classYear", v)} ph="2027" />
        </div>
        <div className="g2">
          <Field label="City" v={f.city} on={(v) => set("city", v)} />
          <Field label="State" v={f.state} on={(v) => set("state", v)} ph="FL" />
        </div>
        <Field label="Highlight film link * (YouTube or Hudl)" v={f.videoUrl} on={(v) => set("videoUrl", v)} ph="https://…" />
        <div className="g2">
          <Field label="Height (inches)" v={f.heightIn} on={(v) => set("heightIn", v)} ph="72" />
          <Field label="Weight (lb)" v={f.weightLb} on={(v) => set("weightLb", v)} ph="185" />
        </div>
        <label style={{ display: "block" }}>
          <span style={{ display: "block", fontSize: 12, color: "var(--sub)", marginBottom: 6, fontWeight: 600 }}>Anything else Coach should know</span>
          <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={3} style={inp} placeholder="Stats, offers, what to watch for…" />
        </label>
        <div className="g2">
          <label style={{ display: "block" }}>
            <span style={{ display: "block", fontSize: 12, color: "var(--sub)", marginBottom: 6, fontWeight: 600 }}>Your email (private — for follow-up only)</span>
            <input type="email" value={f.submitterEmail} onChange={(e) => set("submitterEmail", e.target.value)} style={inp} />
          </label>
          <label style={{ display: "block" }}>
            <span style={{ display: "block", fontSize: 12, color: "var(--sub)", marginBottom: 6, fontWeight: 600 }}>You are the</span>
            <select value={f.submitterRelation} onChange={(e) => set("submitterRelation", e.target.value)} style={inp}>
              <option value="player">Player</option><option value="parent">Parent / guardian</option><option value="coach">Coach</option><option value="other">Other</option>
            </select>
          </label>
        </div>
        {err && <p style={{ color: "var(--live)", fontSize: 13 }}>{err}</p>}
        <button className="pill" type="submit" disabled={status === "sending"} style={{ justifyContent: "center" }}>
          {status === "sending" ? "Sending…" : "Submit for review"}
        </button>
        <p style={{ color: "var(--sub)", fontSize: 12 }}>We only publish position, school and class year. Contact details stay private. Parents can request removal anytime.</p>
      </form>
    </div>
  );
}

const inp: React.CSSProperties = { width: "100%", padding: "10px 13px", borderRadius: 10, border: "1px solid var(--hair)", background: "var(--alt)", color: "var(--ink)", fontSize: 14, font: "inherit" };
function Field({ label, v, on, ph }: { label: string; v: string; on: (v: string) => void; ph?: string }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: 12, color: "var(--sub)", marginBottom: 6, fontWeight: 600 }}>{label}</span>
      <input value={v} onChange={(e) => on(e.target.value)} placeholder={ph} style={inp} />
    </label>
  );
}
