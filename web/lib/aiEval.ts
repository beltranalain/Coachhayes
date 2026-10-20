import "server-only";
import { generateEvalText, evalConfigured } from "./aiProvider";
import { sanitizeEvaluation, type Evaluation } from "./evaluation";

// Turns a recruit's profile + EITHER Coach's spoken read of the film (transcript)
// OR the film's text metadata into a full long-form "Honest Evaluations" report.
// It does NOT watch the footage — when a transcript is present the content IS
// Coach's evaluation (we just structure + polish it); otherwise it reasons from
// the limited signals and stays measured. A human reviews before publish.
export const aiEvalConfigured = evalConfigured();

export type EvalInput = {
  playerName: string;
  position: string;
  school?: string;
  city?: string;
  state?: string;
  classYear?: string;
  heightIn?: number;
  weightLb?: number;
  jersey?: string;
  videoUrl?: string;
  videoTitle?: string;
  videoDescription?: string;
  notes?: string;
  transcript?: string; // Coach's spoken evaluation, transcribed (preferred source)
};

const SYSTEM = `You are the writing assistant for "Honest Evaluations," Coach Kyle Hayes' recruiting evaluation service.
You produce a thorough, position-specific film evaluation of a high school football recruit in Coach Hayes' honest, measured, football-literate voice.

RULES:
- When a COACH TRANSCRIPT is provided, that IS the evaluation — organize, expand and polish HIS observations into the report. Do not contradict him or invent grades he didn't give. You may add standard developmental framing, but keep his judgments.
- DO NOT INVENT SKILLS. When a transcript is provided, do not credit the player with any technique, trait or result the coach did not actually mention (e.g. if he never talks about snap accuracy, pass protection, or a 40 time, do not praise those). If a position-standard skill wasn't addressed, you may note it as "not shown on this film / to be evaluated" — never as an established strength.
- ONE CONSISTENT RECRUITING TIER. First decide the single realistic level this player projects to (e.g. Power Four, Division I/FCS, HBCU, Division II, Division III, NAIA, JUCO). Every section that references level — the ceiling language in "size", "recommendedTargets", "additionalComments", "finalAssessment" and "projection" — MUST agree with that one tier. Never imply Power Four in one section and FCS in another. "recommendedTargets" lists programs/levels AT or ADJACENT TO that tier, not above it.
- When there is NO transcript, you are reasoning from thin signals (profile + film title/description). Stay conservative and measured; use honest hedging ("based on the available film", "appears", "would need to be evaluated more closely"). Never overhype.
- Be position-specific. A center is judged on leverage, pad level, hand placement, movement in confined spaces and second-level blocking — not 40 times. A WR on routes, hands, separation, YAC. Tailor the whole report to the player's position.
- These are often MINORS. On-field analysis only. Never include contact info, home address, or anything identifying beyond position, school and class year.
- Recruiting targets should be realistic levels based on the evaluation — not promises — and consistent with the one tier you settled on.
- Write in clear paragraphs. No emojis. No markdown headers inside the field values.`;

// We ask for strict JSON matching the Evaluation shape.
const JSON_SHAPE = `Return ONLY a JSON object with exactly these keys:
{
  "size": "1-3 paragraphs on frame, measurables and physical projection for the position",
  "speed": "1-3 paragraphs on movement skills / athleticism relevant to the position",
  "effort": "1-3 paragraphs on motor, finish and competitiveness on film",
  "positionAnalysis": "1-2 paragraphs reading the player at their specific position",
  "strengths": ["4-6 concise bullet strings"],
  "improvements": ["4-6 bullets, each 'Area: what to improve'"],
  "recommendedTargets": ["3-6 realistic recruiting target levels/programs, all consistent with the single tier"],
  "additionalComments": "1-2 paragraphs of recruiting-process context",
  "developmentPriorities": ["4-6 numbered-style priority strings (no numbers, just the text)"],
  "finalAssessment": "2-3 paragraph closing summary — its level language must match 'projection'",
  "projection": "one short line naming the single tier, e.g. 'Division II or below · select HBCU opportunities'"
}`;

export async function generateEvaluation(input: EvalInput): Promise<Evaluation> {
  if (!evalConfigured()) throw new Error("No AI provider is connected — add GROQ_API_KEY (or OPENAI/DEEPSEEK) to enable evaluations.");

  const ht = input.heightIn ? `${Math.floor(input.heightIn / 12)}'${input.heightIn % 12}"` : "";
  const profile = [
    `Player: ${input.playerName}`,
    input.position ? `Position: ${input.position}` : "",
    [input.school, input.city, input.state].filter(Boolean).join(", ") ? `School: ${[input.school, input.city, input.state].filter(Boolean).join(", ")}` : "",
    input.classYear ? `Class of ${input.classYear}` : "",
    ht ? `Height: ${ht}` : "",
    input.weightLb ? `Weight: ${input.weightLb} lb` : "",
    input.jersey ? `Jersey #: ${input.jersey}` : "",
    input.videoTitle ? `Film title: ${input.videoTitle}` : "",
    input.videoDescription ? `Film description: ${input.videoDescription.slice(0, 1200)}` : "",
    input.notes ? `Submitter notes: ${input.notes.slice(0, 1200)}` : "",
  ].filter(Boolean).join("\n");

  const coachBlock = input.transcript?.trim()
    ? `\n\nCOACH TRANSCRIPT (Coach Hayes talking through the film — this is the source of truth for the evaluation):\n"""${input.transcript.trim().slice(0, 8000)}"""\n`
    : `\n\n(No coach transcript was provided — reason conservatively from the limited signals above and keep the evaluation honest and measured.)\n`;

  const prompt = `${profile}${coachBlock}\nWrite the full ${input.position || "football"} evaluation now as JSON.\n\n${JSON_SHAPE}`;

  const raw = await generateEvalText(prompt, { systemPrompt: SYSTEM, jsonMode: true, temperature: 0.4, maxTokens: 2800 });

  let parsed: any;
  try { parsed = JSON.parse(raw); } catch { throw new Error("The AI returned an unexpected format. Try again."); }

  const evalObj = sanitizeEvaluation({ ...parsed, source: input.transcript?.trim() ? "voice" : "ai" });
  if (!evalObj) throw new Error("The evaluation came back empty. Try again with more detail.");

  // Stamp the evaluation date (US short format) unless the model supplied one.
  const d = new Date();
  evalObj.evaluatedOn = `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
  return evalObj;
}
