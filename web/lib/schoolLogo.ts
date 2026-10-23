import "server-only";

// Resolve a school name to its logo via ESPN's public college-football teams
// feed. Shared by the /api/school-logo route (admin "Find logo") and the WRE
// YouTube import (bulk commit-logo resolution). Teams are cached in memory.

type Team = { name: string; logo: string; abbrev: string };
let CACHE: Team[] | null = null;
let cachedAt = 0;

export async function getTeams(): Promise<Team[]> {
  if (CACHE && Date.now() - cachedAt < 24 * 60 * 60 * 1000) return CACHE;
  const teams: Team[] = [];
  try {
    const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams?limit=1000", { next: { revalidate: 86400 } });
    const d = await res.json();
    const list = d?.sports?.[0]?.leagues?.[0]?.teams || [];
    for (const it of list) {
      const t = it.team;
      const logo = t?.logos?.[0]?.href;
      if (!t || !logo) continue;
      // store several searchable names pointing at the same logo
      const names = [t.displayName, t.location, t.shortDisplayName, t.name, t.abbreviation].filter(Boolean);
      for (const n of names) teams.push({ name: String(n), logo, abbrev: t.abbreviation || "" });
    }
  } catch { /* fall through to empty */ }
  CACHE = teams;
  cachedAt = Date.now();
  return teams;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export type LogoHit = { found: true; name: string; logo: string; abbrev: string } | { found: false };

// "Miami" → { name, logo, abbrev }. Exact, then startsWith, then includes.
export async function resolveSchoolLogo(q: string): Promise<LogoHit> {
  const s = (q || "").trim();
  if (!s) return { found: false };
  const teams = await getTeams();
  if (!teams.length) return { found: false };
  const nq = norm(s);
  const exact = teams.find((t) => norm(t.name) === nq);
  const starts = teams.find((t) => norm(t.name).startsWith(nq));
  const incl = teams.find((t) => norm(t.name).includes(nq) || nq.includes(norm(t.name)));
  const hit = exact || starts || incl;
  if (!hit) return { found: false };
  return { found: true, name: hit.name, logo: hit.logo, abbrev: hit.abbrev };
}
