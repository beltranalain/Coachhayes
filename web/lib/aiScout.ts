import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Chip } from "./rankings";

// AI scouting agent. Given a recruit's submitted profile + whatever text we can
// pull from their film link (YouTube title/description), Claude drafts a scouting
// report, a suggested chip, a clean bio and SEO metadata. The admin edits and
// finalizes before publishing — the AI never publishes on its own.
//
// It cannot literally watch the footage yet; it reasons over the text signals we
// have. (A future vision pass can sample frames.) Requires ANTHROPIC_API_KEY.
export type ScoutInput = {
  playerName: string;
  position: string;
  school: string;
  state?: string;
  classYear: string;
  videoTitle?: string;
  videoDescription?: string;
  notes?: string;
  heightIn?: number;
  weightLb?: number;
};

export type ScoutDraft = {
  chip: Chip;
  chipRationale: string;
  bio: string;
  strengths: string[];
  traits: string[];
  seoTitle: string;
  seoDescription: string;
};

export const aiConfigured = Boolean(process.env.ANTHROPIC_API_KEY);

const SYSTEM = `You are Coach Hayes' scouting assistant for a college/high-school football recruiting site.
You grade recruits on FILM SIGNALS and the information provided, using a 4-chip scale:
- blue: elite, high-major, program-changing talent
- gold: power-conference starter upside
- silver: solid D1 contributor / mid-major standout
- bronze: developmental prospect, on the radar
Be specific and football-literate (technique, athleticism, position fit). Be honest and measured —
do not overhype. You are drafting for a human coach who will edit and approve. These are often
MINORS: never invent or include contact info, addresses, or anything beyond on-field evaluation,
position, school, class year, and measurables. Write in Coach Hayes' plain, direct voice.`;

const TOOL: Anthropic.Tool = {
  name: "submit_scouting_report",
  description: "Return the drafted scouting report for the recruit.",
  input_schema: {
    type: "object",
    properties: {
      chip: { type: "string", enum: ["bronze", "silver", "gold", "blue"], description: "Suggested chip grade" },
      chipRationale: { type: "string", description: "One or two sentences on why this chip" },
      bio: { type: "string", description: "3-5 sentence scouting writeup in the coach's voice" },
      strengths: { type: "array", items: { type: "string" }, description: "3-5 concise strengths" },
      traits: { type: "array", items: { type: "string" }, description: "3-6 short trait tags, e.g. 'Hands', 'Burst'" },
      seoTitle: { type: "string", description: "SEO <title> for the player page, <70 chars" },
      seoDescription: { type: "string", description: "SEO meta description, <160 chars" },
    },
    required: ["chip", "chipRationale", "bio", "strengths", "traits", "seoTitle", "seoDescription"],
  },
};

export async function scoutDraft(input: ScoutInput): Promise<ScoutDraft> {
  if (!aiConfigured) throw new Error("ANTHROPIC_API_KEY is not set.");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const measurables = [
    input.heightIn ? `Height: ${Math.floor(input.heightIn / 12)}'${input.heightIn % 12}"` : "",
    input.weightLb ? `Weight: ${input.weightLb} lb` : "",
  ].filter(Boolean).join(", ");

  const userText = [
    `Recruit: ${input.playerName}`,
    `Position: ${input.position || "unknown"}`,
    `School: ${input.school || "unknown"}${input.state ? `, ${input.state}` : ""}`,
    `Class of ${input.classYear || "unknown"}`,
    measurables ? `Measurables: ${measurables}` : "",
    input.videoTitle ? `Film title: ${input.videoTitle}` : "",
    input.videoDescription ? `Film description: ${input.videoDescription}` : "",
    input.notes ? `Submitter notes: ${input.notes}` : "",
    "",
    "Draft the scouting report. If the film signals are thin, grade conservatively and say what more you'd want to see.",
  ].filter(Boolean).join("\n");

  const res = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [TOOL],
    tool_choice: { type: "tool", name: "submit_scouting_report" },
    messages: [{ role: "user", content: userText }],
  });

  const block = res.content.find((b) => b.type === "tool_use") as Anthropic.ToolUseBlock | undefined;
  if (!block) throw new Error("AI did not return a report.");
  const d = block.input as Record<string, unknown>;
  const chip = (["bronze", "silver", "gold", "blue"].includes(d.chip as string) ? d.chip : "bronze") as Chip;
  return {
    chip,
    chipRationale: String(d.chipRationale || ""),
    bio: String(d.bio || ""),
    strengths: Array.isArray(d.strengths) ? (d.strengths as unknown[]).map(String).slice(0, 6) : [],
    traits: Array.isArray(d.traits) ? (d.traits as unknown[]).map(String).slice(0, 8) : [],
    seoTitle: String(d.seoTitle || "").slice(0, 70),
    seoDescription: String(d.seoDescription || "").slice(0, 160),
  };
}
