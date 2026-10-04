"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/hayes/admin/Shell";
import { getIdToken } from "@/lib/firebase";

// Email list — owned subscriber list + a composer that sends a branded, templated
// email (with the logo) through Resend. Preview shows exactly what gets sent, and
// History tracks everything that went out.
type Campaign = { id: string; subject: string; body: string; recipients: number; ts: number };

export default function EmailAdmin() {
  const [brand, setBrand] = useState({ name: "Coach Hayes Football", logo: "" });
  const [tab, setTab] = useState<"compose" | "history">("compose");
  const [count, setCount] = useState(0);
  const [configured, setConfigured] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  const tok = async (): Promise<Record<string, string>> => { const t = await getIdToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };

  useEffect(() => {
    (async () => {
      const h = await tok();
      try {
        const cfg = await fetch("/api/site-config", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
        if (cfg?.branding) setBrand({ name: cfg.branding.siteName || "Coach Hayes Football", logo: cfg.branding.logo || "" });
        const s = await fetch("/api/email/subscribers", { headers: h, cache: "no-store" }).then((r) => r.json()).catch(() => ({ count: 0, configured: false }));
        setCount(s.count || 0); setConfigured(!!s.configured);
      } catch {}
    })();
  }, []);

  async function loadHistory() {
    try {
      const r = await fetch("/api/email/campaigns", { headers: await tok(), cache: "no-store" });
      const d = await r.json();
      setCampaigns(d.campaigns || []);
    } catch {}
  }
  useEffect(() => { if (tab === "history") loadHistory(); }, [tab]);

  async function previewOf(subj: string, bod: string) {
    setStatus("");
    try {
      const r = await fetch("/api/email/preview", { method: "POST", headers: { "Content-Type": "application/json", ...(await tok()) }, body: JSON.stringify({ subject: subj, body: bod }) });
      const d = await r.json();
      if (d.html) setPreviewHtml(d.html); else setStatus("Could not build preview.");
    } catch { setStatus("Could not build preview."); }
  }

  async function send(test: boolean) {
    if (!subject.trim() || !body.trim()) { setStatus("Add a subject and a message first."); return; }
    if (!test && !confirm(`Send this to all ${count} subscriber${count === 1 ? "" : "s"}?`)) return;
    setBusy(true); setStatus(test ? "Sending test…" : "Sending…");
    try {
      const r = await fetch("/api/email/send", { method: "POST", headers: { "Content-Type": "application/json", ...(await tok()) }, body: JSON.stringify({ subject, body, test }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) { setStatus(test ? "Test sent to your inbox." : `Sent to ${d.sent} subscriber${d.sent === 1 ? "" : "s"}.`); if (!test) { setSubject(""); setBody(""); } }
      else setStatus(d.error || "Send failed.");
    } catch { setStatus("Send failed."); } finally { setBusy(false); }
  }

  return (
    <Shell title="Email list" sub={`${count} subscriber${count === 1 ? "" : "s"}${configured ? "" : " · provider not connected"}`} brandName={brand.name} logo={brand.logo}>
      <div className="filters" style={{ marginBottom: 16 }}>
        <button type="button" className={`filter-btn${tab === "compose" ? " active" : ""}`} onClick={() => setTab("compose")}>Compose</button>
        <button type="button" className={`filter-btn${tab === "history" ? " active" : ""}`} onClick={() => setTab("history")}>History</button>
      </div>

      {tab === "compose" ? (
        <>
          <div className="card">
            <h3>Compose</h3>
            <p className="cs" style={{ marginTop: 0 }}>Write an update — it goes out in your branded template (with your logo). Preview it first, send a test to yourself, then send to everyone.</p>

            {!configured && (
              <div className="note" style={{ borderLeftColor: "var(--amber)" }}>
                <b>Sending isn&apos;t connected yet.</b> You can write + preview now. To actually send, set <code>RESEND_API_KEY</code> and <code>RESEND_FROM</code> (a verified sender) in the environment, then restart.
              </div>
            )}

            <div className="form-field" style={{ marginTop: 12 }}>
              <label>Subject</label>
              <input type="text" value={subject} maxLength={160} placeholder="Big show tonight — Miami vs Clemson breakdown" onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="form-field">
              <label>Message</label>
              <textarea rows={10} value={body} maxLength={20000} placeholder={"Write your email here.\n\nBlank lines start a new paragraph. Keep it conversational."} onChange={(e) => setBody(e.target.value)} />
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
              <button className="btn sm" type="button" onClick={() => previewOf(subject, body)} disabled={!subject && !body}>Preview</button>
              <button className="btn sm" type="button" onClick={() => send(true)} disabled={busy || !configured}>Send test to me</button>
              <button className="btn" style={{ background: "var(--acc)", color: "var(--accInk)", padding: "10px 20px", borderRadius: 10, fontWeight: 600 }} type="button" onClick={() => send(false)} disabled={busy || !configured || count === 0}>Send to {count} subscriber{count === 1 ? "" : "s"}</button>
              {status && <span style={{ fontSize: 13, color: status.toLowerCase().includes("fail") || status.toLowerCase().includes("not") || status.toLowerCase().includes("no ") ? "var(--live)" : "var(--green)" }}>{status}</span>}
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Subscribers</h3>
            <p className="cs" style={{ marginTop: 0 }}>People who opted into your list. Add the subscribe form anywhere on the site (it posts to <code>/api/email/subscribe</code>) and the count fills here.</p>
            {count === 0 ? (
              <div className="note" style={{ margin: 0 }}>No subscribers yet. They appear here as people sign up.</div>
            ) : (
              <div className="cs">{count} subscriber{count === 1 ? "" : "s"} on your owned list.</div>
            )}
          </div>
        </>
      ) : (
        <div className="card">
          <h3>Sent emails</h3>
          <p className="cs" style={{ marginTop: 0 }}>Every campaign you&apos;ve sent, newest first. Click one to see exactly what went out.</p>
          {campaigns.length === 0 ? (
            <div className="note" style={{ margin: 0 }}>No emails sent yet. Your history shows up here after your first send.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {campaigns.map((c) => (
                <div key={c.id} style={{ display: "flex", gap: 14, alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--hair)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{c.subject || "(no subject)"}</div>
                    <div className="cs">{new Date(c.ts).toLocaleString()} · {c.recipients} recipient{c.recipients === 1 ? "" : "s"}</div>
                  </div>
                  <button className="btn sm" type="button" onClick={() => previewOf(c.subject, c.body)}>View</button>
                  <button className="btn sm" type="button" onClick={() => { setSubject(c.subject); setBody(c.body); setTab("compose"); }}>Reuse</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {previewHtml !== null && (
        <div onClick={() => setPreviewHtml(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "grid", placeItems: "center", zIndex: 60, padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--card)", border: "1px solid var(--hair)", borderRadius: 18, padding: 16, width: "min(680px, 96vw)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <b>Email preview</b>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setPreviewHtml(null)}>Close</button>
            </div>
            <iframe title="Email preview" srcDoc={previewHtml} style={{ width: "100%", height: "70vh", border: "1px solid var(--hair)", borderRadius: 14, background: "#0E0C0B" }} />
          </div>
        </div>
      )}
    </Shell>
  );
}
