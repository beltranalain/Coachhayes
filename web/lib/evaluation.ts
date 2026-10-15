// Long-form recruit evaluation ("Honest Evaluations" format) + the access-control
// fields that gate who can read it. Client-safe (types + sanitizers only) so both
// the admin editor and the public modal can import it. MINORS: an evaluation is
// on-field analysis only — never contact info, address, or anything identifying
// beyond position/school/class year.

export type Evaluation = {
  size: string;               // frame / physical projection paragraph(s)
  speed: string;              // movement / athleticism paragraph(s)
  effort: string;             // motor / finish paragraph(s)
  positionAnalysis: string;   // position-specific read
  strengths: string[];        // "Areas of Strength" bullets
  improvements: string[];     // "Areas for Improvement" bullets ("Label: detail")
  recommendedTargets: string[]; // recruiting target levels/programs
  additionalComments: string; // context / recruiting-process notes
  developmentPriorities: string[]; // numbered development priorities
  finalAssessment: string;    // closing summary + projection
  projection: string;         // short tag, e.g. "Division II or below · select HBCU"
  evaluatedOn: string;        // display date, e.g. "10/12/26"
  source?: "voice" | "ai" | "manual"; // how the draft was produced
};

// Per-player access control for the evaluation (manual-unlock model to start).
//   none   — no evaluation exists yet
//   free   — anyone can read it
//   locked — teaser only, unless the viewer's email is on the unlock list (or admin)
export type EvalAccess = "none" | "free" | "locked";

export type EvalMeta = {
  evaluation?: Evaluation | null;
  evalAccess: EvalAccess;
  evalPrice?: string;          // display only, e.g. "$49"
  evalUnlockEmails?: string[]; // emails manually granted access after paying
};

export const EMPTY_EVALUATION: Evaluation = {
  size: "", speed: "", effort: "", positionAnalysis: "",
  strengths: [], improvements: [], recommendedTargets: [],
  additionalComments: "", developmentPriorities: [], finalAssessment: "",
  projection: "", evaluatedOn: "", source: "manual",
};

// True if an evaluation has any real content (so we don't show empty shells).
export function hasEvaluation(e?: Evaluation | null): boolean {
  if (!e) return false;
  return Boolean(
    e.size || e.speed || e.effort || e.positionAnalysis || e.finalAssessment ||
    (e.strengths && e.strengths.length) || (e.improvements && e.improvements.length)
  );
}

const str = (v: unknown, n = 6000) => String(v ?? "").slice(0, n);
const list = (v: unknown, n = 20, len = 400) =>
  Array.isArray(v) ? v.map((x) => String(x ?? "").slice(0, len)).map((s) => s.trim()).filter(Boolean).slice(0, n) : [];

// Normalize an evaluation object from any source (AI output, form, Firestore).
export function sanitizeEvaluation(v: any): Evaluation | null {
  if (!v || typeof v !== "object") return null;
  const e: Evaluation = {
    size: str(v.size), speed: str(v.speed), effort: str(v.effort),
    positionAnalysis: str(v.positionAnalysis),
    strengths: list(v.strengths), improvements: list(v.improvements),
    recommendedTargets: list(v.recommendedTargets),
    additionalComments: str(v.additionalComments),
    developmentPriorities: list(v.developmentPriorities),
    finalAssessment: str(v.finalAssessment),
    projection: str(v.projection, 200),
    evaluatedOn: str(v.evaluatedOn, 40),
    source: ["voice", "ai", "manual"].includes(v.source) ? v.source : "manual",
  };
  return hasEvaluation(e) ? e : null;
}

export function sanitizeAccess(v: unknown): EvalAccess {
  return v === "free" || v === "locked" ? v : "none";
}

export function normalizeEmails(v: unknown, n = 500): string[] {
  const arr = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[\s,;]+/) : [];
  return [...new Set(arr.map((x) => String(x ?? "").trim().toLowerCase()).filter((x) => x.includes("@")))].slice(0, n);
}

// A short, non-revealing teaser shown when an evaluation is locked.
export function evaluationTeaser(e: Evaluation): string {
  const first = (e.size || e.positionAnalysis || e.finalAssessment || "").trim();
  const sentence = first.split(/(?<=[.!?])\s/).slice(0, 2).join(" ");
  return sentence || "A full film breakdown is available for this player.";
}
