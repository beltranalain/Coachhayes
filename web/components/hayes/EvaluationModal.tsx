"use client";

import { useEffect, useState } from "react";
import { getIdToken } from "@/lib/firebase";
import type { Evaluation } from "@/lib/evaluation";

// Public evaluation reader. Opens the long-form "Honest Evaluations" report for a
// player, fetched through the paywall-gated API: free evals show to everyone;
// locked evals show a teaser + unlock instructions unless the signed-in viewer is
// on the player's unlock list (or an admin).
type State =
  | { phase: "loading" }
  | { phase: "none" }
  | { phase: "full"; evaluation: Evaluation }
  | { phase: "locked"; teaser: string; price: string; evaluatedOn: string };

function Paras({ text }: { text: string }) {
  const paras = String(text || "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return <>{paras.map((p, i) => <p key={i} className="evp">{p}</p>)}</>;
}

export default function EvaluationModal({ slug, playerName, onClose }: { slug: string; playerName: string; onClose: () => void }) {
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const t = await getIdToken().catch(() => null);
        const res = await fetch(`/api/rankings/evaluation?slug=${encodeURIComponent(slug)}`, {
          headers: t ? { Authorization: `Bearer ${t}` } : {},
          cache: "no-store",
        });
        const d = await res.json();
        if (!alive) return;
        if (!d.hasEval) setState({ phase: "none" });
        else if (d.locked) setState({ phase: "locked", teaser: d.teaser || "", price: d.price || "", evaluatedOn: d.evaluatedOn || "" });
        else setState({ phase: "full", evaluation: d.evaluation });
      } catch {
        if (alive) setState({ phase: "none" });
      }
    })();
    return () => { alive = false; };
  }, [slug]);

  // Lock body scroll + close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div className="evmodal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="evcard" role="dialog" aria-modal="true" aria-label={`${playerName} evaluation`}>
        <div className="evhead">
          <div>
            <p className="evkick">Honest Evaluation</p>
            <h2>{playerName}</h2>
          </div>
          <button className="evx" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="evbody">
          {state.phase === "loading" && <p className="evmute">Loading evaluation…</p>}
          {state.phase === "none" && <p className="evmute">No evaluation has been published for this player yet.</p>}

          {state.phase === "locked" && (
            <div className="evlock">
              <div className="evlock-badge">Full breakdown locked</div>
              <p className="evp">{state.teaser}</p>
              <div className="evlock-cta">
                <h3>Unlock the full film evaluation{state.price ? ` — ${state.price}` : ""}</h3>
                <p className="evmute">
                  This is Coach Hayes&apos; complete position-by-position breakdown — size, movement, effort,
                  strengths, areas to improve, recruiting targets and a final projection.
                </p>
                <ol className="evlock-steps">
                  <li>Send payment{state.price ? ` (${state.price})` : ""} via CashApp or PayPal.</li>
                  <li>Include the player&apos;s name and the email you sign in with.</li>
                  <li>Coach unlocks the evaluation to your account — refresh and it opens here.</li>
                </ol>
                <div className="evlock-btns">
                  <a className="pill" href="/membership">Payment options</a>
                  <a className="pill soft" href="/contact">Contact Coach</a>
                </div>
              </div>
            </div>
          )}

          {state.phase === "full" && <EvaluationBody e={state.evaluation} />}
        </div>
      </div>
    </div>
  );
}

export function EvaluationBody({ e }: { e: Evaluation }) {
  return (
    <article className="evreport">
      {e.evaluatedOn && <p className="evdate">Evaluated on {e.evaluatedOn}</p>}
      {e.size && <section><h3>Size</h3><Paras text={e.size} /></section>}
      {e.speed && <section><h3>Speed &amp; Movement</h3><Paras text={e.speed} /></section>}
      {e.effort && <section><h3>Effort</h3><Paras text={e.effort} /></section>}
      {e.positionAnalysis && <section><h3>Position Analysis</h3><Paras text={e.positionAnalysis} /></section>}

      {e.strengths?.length > 0 && (
        <section><h3>Areas of Strength</h3><ul className="evlist">{e.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></section>
      )}
      {e.improvements?.length > 0 && (
        <section><h3>Areas for Improvement</h3><ul className="evlist">{e.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul></section>
      )}
      {e.recommendedTargets?.length > 0 && (
        <section><h3>Recommended Recruiting Targets</h3><ul className="evlist">{e.recommendedTargets.map((s, i) => <li key={i}>{s}</li>)}</ul></section>
      )}
      {e.additionalComments && <section><h3>Additional Comments</h3><Paras text={e.additionalComments} /></section>}
      {e.developmentPriorities?.length > 0 && (
        <section><h3>Development Priorities</h3><ol className="evlist evnum">{e.developmentPriorities.map((s, i) => <li key={i}>{s}</li>)}</ol></section>
      )}
      {e.finalAssessment && <section><h3>Final Recruiting Assessment</h3><Paras text={e.finalAssessment} /></section>}
      {e.projection && <p className="evproj"><b>Projection:</b> {e.projection}</p>}
    </article>
  );
}
