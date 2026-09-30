import "server-only";
import { getAdminDb, adminConfigured } from "./firebaseAdmin";
import { CHIP_META, type Chip, type Categories, type CategoryNotes, sanitizeCategories, sanitizeCategoryNotes } from "./chips";

// ============================================================================
// Rankings domain. Each player is graded on 5 categories (Power/Speed/Motor/
// Technique/Football IQ), each awarded a tier chip (bronze<silver<gold<blue).
// The category scores recommend an OVERALL chip (stored in `chip`) which the
// coach can override; `chip` drives ranking + public display. Chip constants +
// scoring live in ./chips (client-safe) and are re-exported here.
// Hybrid ordering: default sort by chip weight + recency; the admin can bump a
// player up/down (stored in `order`). MINORS: only name/position/school/
// classYear are ever public — never contact info or home address.
// ============================================================================

export * from "./chips";

export type Player = {
  id: string;
  slug: string;
  name: string;
  position: string;        // e.g. "WR"
  school: string;          // high school
  city?: string;
  state?: string;
  commit?: string;         // school committed to (e.g. "Miami")
  commitLogo?: string;     // committed school logo URL (ESPN)
  classYear: string;       // "2027"
  chip: Chip;              // overall chip (recommended from categories, coach can override)
  categories?: Categories; // per-category tier chips (power/speed/motor/technique/iq)
  categoryNotes?: CategoryNotes; // per-category scouting notes (public breakdown)
  order: number;           // higher = ranked higher (hybrid: auto default + manual bumps)
  heightIn?: number;       // measurables (optional, non-identifying)
  weightLb?: number;
  fortyYd?: string;
  bio: string;             // Coach's / AI-drafted writeup
  strengths?: string[];
  traits?: string[];       // e.g. ["Hands", "Route running"]
  videoUrl?: string;       // highlight film (YouTube/Hudl)
  seoTitle?: string;
  seoDescription?: string;
  published: boolean;
  removed?: boolean;       // hidden via removal-request flow
  createdAt: number;
  updatedAt: number;
};

// Default ordering weight so higher chips + newer grades float up. Manual bumps
// overwrite `order` directly.
export function defaultOrder(chip: Chip, createdAt: number): number {
  return CHIP_META[chip].weight * 1e13 + createdAt;
}

function toPlayer(id: string, d: any): Player {
  return {
    id,
    slug: String(d.slug || id),
    name: String(d.name || ""),
    position: String(d.position || ""),
    school: String(d.school || ""),
    city: d.city ? String(d.city) : undefined,
    state: d.state ? String(d.state) : undefined,
    commit: d.commit ? String(d.commit) : undefined,
    commitLogo: d.commitLogo ? String(d.commitLogo) : undefined,
    classYear: String(d.classYear || ""),
    chip: (["bronze", "silver", "gold", "blue"].includes(d.chip) ? d.chip : "bronze") as Chip,
    categories: sanitizeCategories(d.categories),
    categoryNotes: sanitizeCategoryNotes(d.categoryNotes),
    order: Number(d.order) || 0,
    heightIn: d.heightIn ? Number(d.heightIn) : undefined,
    weightLb: d.weightLb ? Number(d.weightLb) : undefined,
    fortyYd: d.fortyYd ? String(d.fortyYd) : undefined,
    bio: String(d.bio || ""),
    strengths: Array.isArray(d.strengths) ? d.strengths.map(String) : undefined,
    traits: Array.isArray(d.traits) ? d.traits.map(String) : undefined,
    videoUrl: d.videoUrl ? String(d.videoUrl) : undefined,
    seoTitle: d.seoTitle ? String(d.seoTitle) : undefined,
    seoDescription: d.seoDescription ? String(d.seoDescription) : undefined,
    published: Boolean(d.published),
    removed: Boolean(d.removed),
    createdAt: Number(d.createdAt) || 0,
    updatedAt: Number(d.updatedAt) || 0,
  };
}

// Public: all published, non-removed players, ranked (highest first).
export async function getPublishedPlayers(): Promise<Player[]> {
  if (!adminConfigured) return [];
  try {
    const db = getAdminDb();
    if (!db) return [];
    const snap = await db.collection("players").where("published", "==", true).get();
    const players = snap.docs.map((d) => toPlayer(d.id, d.data())).filter((p) => !p.removed);
    players.sort((a, b) => b.order - a.order);
    return players;
  } catch {
    return [];
  }
}

export async function getPlayerBySlug(slug: string): Promise<Player | null> {
  if (!adminConfigured) return null;
  try {
    const db = getAdminDb();
    if (!db) return null;
    const snap = await db.collection("players").where("slug", "==", slug).limit(1).get();
    if (snap.empty) return null;
    const p = toPlayer(snap.docs[0].id, snap.docs[0].data());
    return p.published && !p.removed ? p : null;
  } catch {
    return null;
  }
}

// For the sitemap: every published player's slug + last-updated.
export async function getAllPlayerSlugs(): Promise<{ slug: string; updatedAt: number }[]> {
  const players = await getPublishedPlayers();
  return players.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt || p.createdAt }));
}

// Distinct class years / positions / states for landing pages + filters.
export async function getRankingFacets(): Promise<{ years: string[]; positions: string[]; states: string[] }> {
  const players = await getPublishedPlayers();
  const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter(Boolean) as string[])].sort();
  return {
    years: uniq(players.map((p) => p.classYear)),
    positions: uniq(players.map((p) => p.position)),
    states: uniq(players.map((p) => p.state)),
  };
}

export function slugify(name: string, classYear: string): string {
  return (
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") +
    (classYear ? "-" + classYear : "")
  );
}
