// Client-safe chip constants + scoring (NO server-only import, so both the
// client admin UI and server code can use it). lib/rankings.ts re-exports these.
//
// Chip model (client-confirmed):
//   Each player is graded on 5 categories — Power, Speed, Motor, Technique,
//   Football IQ — and each category is awarded a tier chip: bronze < silver <
//   gold < blue. Every tier has a score (bronze 1 … blue 4). The 5 scores
//   average into a RECOMMENDED overall chip, which the coach can override.

export type Chip = "bronze" | "silver" | "gold" | "blue";

export const CHIP_META: Record<Chip, { label: string; weight: number; ring: string; blurb: string }> = {
  blue: { label: "Blue chip", weight: 4, ring: "#2D6BFF", blurb: "Elite. High-major, program-changer talent." },
  gold: { label: "Gold chip", weight: 3, ring: "#F5C542", blurb: "Power-conference starter upside." },
  silver: { label: "Silver chip", weight: 2, ring: "#A9B2BD", blurb: "Solid D1 contributor / mid-major standout." },
  bronze: { label: "Bronze chip", weight: 1, ring: "#C98A5E", blurb: "On the radar — developmental prospect." },
};
export const CHIP_ORDER: Chip[] = ["blue", "gold", "silver", "bronze"];

// Score per tier (used for the automatic overall calculation).
export const CHIP_SCORE: Record<Chip, number> = { bronze: 1, silver: 2, gold: 3, blue: 4 };
export const SCORE_CHIP: Record<number, Chip> = { 1: "bronze", 2: "silver", 3: "gold", 4: "blue" };

// The 5 grading categories (from the approved mock).
export type CategoryKey = "power" | "speed" | "motor" | "technique" | "iq";
export const CATEGORIES: { key: CategoryKey; label: string; abbr: string }[] = [
  { key: "power", label: "Power", abbr: "PWR" },
  { key: "speed", label: "Speed", abbr: "SPD" },
  { key: "motor", label: "Motor", abbr: "MTR" },
  { key: "technique", label: "Technique", abbr: "TEC" },
  { key: "iq", label: "Football IQ", abbr: "IQ" },
];

export type Categories = Partial<Record<CategoryKey, Chip>>;
export type CategoryNotes = Partial<Record<CategoryKey, string>>;

const isChip = (v: unknown): v is Chip => v === "bronze" || v === "silver" || v === "gold" || v === "blue";

// Keep only valid category → chip entries.
export function sanitizeCategories(raw: unknown): Categories {
  const out: Categories = {};
  if (raw && typeof raw === "object") {
    for (const { key } of CATEGORIES) {
      const v = (raw as Record<string, unknown>)[key];
      if (isChip(v)) out[key] = v;
    }
  }
  return out;
}

// Per-category scouting notes (shown on the public breakdown).
export function sanitizeCategoryNotes(raw: unknown): CategoryNotes {
  const out: CategoryNotes = {};
  if (raw && typeof raw === "object") {
    for (const { key } of CATEGORIES) {
      const v = (raw as Record<string, unknown>)[key];
      if (typeof v === "string" && v.trim()) out[key] = v.trim().slice(0, 400);
    }
  }
  return out;
}

// Average the category scores and round to the nearest tier. Returns the
// recommended overall chip plus the raw average (for display).
export function recommendedOverall(cats: Categories): { chip: Chip; avg: number } {
  const vals = CATEGORIES.map((c) => cats[c.key]).filter(isChip) as Chip[];
  if (!vals.length) return { chip: "bronze", avg: 0 };
  const avg = vals.reduce((s, c) => s + CHIP_SCORE[c], 0) / vals.length;
  const rounded = Math.min(4, Math.max(1, Math.round(avg)));
  return { chip: SCORE_CHIP[rounded], avg };
}
