import { NextResponse } from "next/server";

// Resolve a school name to its logo via ESPN's public college-football teams
// feed. Used by the admin when assigning a player's commitment. The teams list
// is fetched once and cached in memory for the process lifetime.

type Team = { name: string; logo: string; abbrev: string };
let CACHE: Team[] | null = null;
let cachedAt = 0;

async function getTeams(): Promise<Team[]> {
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

// GET ?q=Miami → { name, logo, abbrev } best match, or { found:false }
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (!q) return NextResponse.json({ found: false, error: "Missing q." }, { status: 400 });
  const teams = await getTeams();
  if (!teams.length) return NextResponse.json({ found: false, error: "Logo source unavailable." });

  const nq = norm(q);
  // exact, then startsWith, then includes — over the flattened name list.
  const exact = teams.find((t) => norm(t.name) === nq);
  const starts = teams.find((t) => norm(t.name).startsWith(nq));
  const incl = teams.find((t) => norm(t.name).includes(nq) || nq.includes(norm(t.name)));
  const hit = exact || starts || incl;
  if (!hit) return NextResponse.json({ found: false });
  return NextResponse.json({ found: true, name: hit.name, logo: hit.logo, abbrev: hit.abbrev });
}
