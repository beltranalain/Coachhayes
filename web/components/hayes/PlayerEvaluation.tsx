"use client";

import { useState } from "react";
import EvaluationModal, { EvaluationBody } from "@/components/hayes/EvaluationModal";
import type { Evaluation } from "@/lib/evaluation";

// Player-page evaluation block. FREE evals render inline (good for SEO + no extra
// click). LOCKED evals show only a server-computed teaser + an Unlock button that
// opens the gated modal — the locked content is never sent to the browser here.
export default function PlayerEvaluation({
  slug, name, access, evaluation, price, teaser,
}: {
  slug: string; name: string; access: "free" | "locked";
  evaluation?: Evaluation | null; price?: string; teaser?: string;
}) {
  const [open, setOpen] = useState(false);

  if (access === "free" && evaluation) {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 20, letterSpacing: "-.02em", marginBottom: 6 }}>Honest Evaluation</h2>
        <EvaluationBody e={evaluation} />
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: 20, letterSpacing: "-.02em", marginBottom: 6 }}>Honest Evaluation</h2>
      <p className="evlock-badge" style={{ display: "inline-block" }}>Full breakdown locked</p>
      {teaser && <p style={{ lineHeight: 1.7, fontSize: 16, marginTop: 10 }}>{teaser}</p>}
      <p style={{ color: "var(--sub)", marginTop: 10 }}>
        Coach Hayes&apos; complete film breakdown — size, movement, effort, strengths, areas to improve,
        recruiting targets and a final projection.
      </p>
      <button className="pill" style={{ marginTop: 12 }} onClick={() => setOpen(true)}>
        Unlock full evaluation{price ? ` — ${price}` : ""}
      </button>
      {open && <EvaluationModal slug={slug} playerName={name} onClose={() => setOpen(false)} />}
    </div>
  );
}
