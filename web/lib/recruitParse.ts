import "server-only";
import { generateWithGroq, groqConfigured } from "./groq";
import type { YtItem } from "./youtube";

// Turn Coach Hayes "WRE" (Watch. React. Evaluate.) YouTube breakdown titles into
// structured recruits. Titles look like:
//   "MIAMI GOT HIM! WR Amir Sears RECLASSIFIES & COMMITS"
//   "GEORGIA GOT A DAWG! 4⭐ WR Jamir Dean FLIPS FROM PENN STATE"
//   "Addison Nichols, Univ. of Tennessee OL | Interview and Highlight Breakdown"
// We let the AI read each title (+ a little description) and pull the one primary
// recruit, the position, and the school he's CURRENTLY committed to.

export type ParsedRecruit = {
  videoId: string;
  videoUrl: string;
  thumbnail: string;
  title: string;
  keep: boolean;          // false = trailer / compilation / not a single recruit
  name: string;
  position: string;       // normalized: QB RB WR TE OL DL EDGE LB CB S ATH K
  commit: string;         // school he's committed to now ("" if uncommitted)
  classYear: string;      // "" if not stated in the title
  stars: number;          // 0 if none in title
};

const POSITIONS = "QB, RB, WR, TE, OL (OT/OG/C), DL (DT), EDGE, LB, CB, S, ATH, K";

const SYSTEM = `You read titles of a high school football recruiting YouTube channel and extract ONE primary recruit per video.
Rules:
- keep=false for anything that is NOT a single named recruit breakdown: channel trailers, playlist intros, multi-player compilations ("Top 10", "Florida Commits"), Q&A, or anything with no clear player name.
- name: the recruit's full name only, no hype words, no emojis, no star text, Proper Case.
- position: normalize to one of: ${POSITIONS}. Use the closest standard abbreviation. "" if unknown.
- commit: the school the player is CURRENTLY committed to. If the title says a team "GOT HIM"/"COMMITS"/"FLIPS TO X", that team is the commit. If it says "FLIPS FROM Y", Y is the OLD school — do NOT use it. Use the common school name (e.g. "Miami", "Georgia", "Penn State", "Tennessee"). "" if uncommitted/unclear.
- classYear: 4-digit year only if the title clearly states it (e.g. "Class of 2027" -> "2027"). Otherwise "".
- stars: integer 1-5 if the title shows a star rating (e.g. "4⭐", "5 star"), else 0.
Reply with ONLY a JSON object: {"recruits":[{"videoId":string,"keep":boolean,"name":string,"position":string,"commit":string,"classYear":string,"stars":number}]}. One entry per input video, same videoId.`;

function clampPos(p: string): string {
  const s = (p || "").toUpperCase().replace(/[^A-Z/]/g, "");
  const ok = ["QB","RB","WR","TE","OL","OT","OG","C","DL","DT","EDGE","DE","LB","CB","S","DB","ATH","K","P","LS"];
  return ok.includes(s) ? s : (p || "").slice(0, 8);
}

async function parseChunk(items: YtItem[], defaultClassYear: string): Promise<ParsedRecruit[]> {
  const lines = items.map((v) => `- videoId=${v.id} | title=${JSON.stringify(v.title)}${v.description ? ` | desc=${JSON.stringify(v.description.slice(0, 160))}` : ""}`).join("\n");
  const prompt = `Extract the recruits from these ${items.length} videos. Return one JSON entry per videoId.\n\n${lines}`;
  const raw = await generateWithGroq(prompt, { systemPrompt: SYSTEM, jsonMode: true, temperature: 0.2, maxTokens: 3000 });
  let parsed: any = {};
  try { parsed = JSON.parse(raw); } catch {
    const a = raw.indexOf("{"), b = raw.lastIndexOf("}");
    if (a >= 0 && b > a) { try { parsed = JSON.parse(raw.slice(a, b + 1)); } catch { parsed = {}; } }
  }
  const byId = new Map<string, any>();
  for (const r of Array.isArray(parsed.recruits) ? parsed.recruits : []) {
    if (r && typeof r.videoId === "string") byId.set(r.videoId, r);
  }
  return items.map((v) => {
    const r = byId.get(v.id) || {};
    const name = String(r.name || "").trim();
    return {
      videoId: v.id,
      videoUrl: `https://www.youtube.com/watch?v=${v.id}`,
      thumbnail: v.thumbnail,
      title: v.title,
      keep: Boolean(r.keep) && name.length > 1,
      name,
      position: clampPos(String(r.position || "")),
      commit: String(r.commit || "").trim(),
      classYear: String(r.classYear || "").trim() || defaultClassYear,
      stars: Math.max(0, Math.min(5, Number(r.stars) || 0)),
    };
  });
}

// Parse every video, in chunks so a big playlist stays within one AI call each.
export async function parseRecruits(items: YtItem[], defaultClassYear = ""): Promise<ParsedRecruit[]> {
  if (!groqConfigured) throw new Error("No AI provider connected — add GROQ_API_KEY.");
  const CHUNK = 20;
  const out: ParsedRecruit[] = [];
  for (let i = 0; i < items.length; i += CHUNK) {
    const slice = items.slice(i, i + CHUNK);
    try { out.push(...(await parseChunk(slice, defaultClassYear))); }
    catch {
      // On a chunk failure, still surface the videos (unparsed) so nothing is lost.
      for (const v of slice) out.push({ videoId: v.id, videoUrl: `https://www.youtube.com/watch?v=${v.id}`, thumbnail: v.thumbnail, title: v.title, keep: false, name: "", position: "", commit: "", classYear: defaultClassYear, stars: 0 });
    }
  }
  return out;
}
