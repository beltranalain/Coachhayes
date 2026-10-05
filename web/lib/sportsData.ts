import "server-only";

// Real, current college-football data from ESPN's public site API (no key).
// Used to GROUND blog generation so the AI writes from verified facts (real
// teams, records, rankings, scores, rosters, headlines) instead of hallucinating
// players and stats. Everything here is best-effort: if ESPN is unreachable we
// return what we have and generation falls back to strict "don't fabricate" mode.

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/football/college-football";
const CORE = "https://sports.core.api.espn.com/v2/sports/football/leagues/college-football";

// Stat categories to pull the top leader for (offense + defense). Each gives a
// real athlete + a real season number.
const LEADER_CATS: Array<{ key: string; label: string }> = [
  { key: "passingYards", label: "passing yards" },
  { key: "rushingYards", label: "rushing yards" },
  { key: "receivingYards", label: "receiving yards" },
  { key: "totalTackles", label: "tackles" },
  { key: "sacks", label: "sacks" },
  { key: "interceptions", label: "interceptions" },
];

async function j(url: string, ms = 8000): Promise<any | null> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

type TeamLite = { id: string; name: string; terms: string[] };

// Teams list is ~760 entries and rarely changes — cache it in-memory ~6h.
let teamsCache: { at: number; teams: TeamLite[] } | null = null;

async function getTeams(): Promise<TeamLite[]> {
  if (teamsCache && Date.now() - teamsCache.at < 6 * 3600 * 1000) return teamsCache.teams;
  const d = await j(`${ESPN}/teams?limit=1000`);
  const raw = d?.sports?.[0]?.leagues?.[0]?.teams || [];
  const teams: TeamLite[] = raw
    .map((w: any) => w.team)
    .filter(Boolean)
    .map((t: any) => ({
      id: String(t.id),
      name: t.displayName,
      terms: [t.location, t.nickname, t.displayName].filter(Boolean).map((s: string) => String(s).toLowerCase()),
    }));
  if (teams.length) teamsCache = { at: Date.now(), teams };
  return teams;
}

// Which teams does the title name? (whole-word match on school/nickname, max 2)
function detect(title: string, teams: TeamLite[]): TeamLite[] {
  const hits: TeamLite[] = [];
  for (const t of teams) {
    for (const term of t.terms) {
      if (term.length < 4) continue;
      const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(title)) { hits.push(t); break; }
    }
    if (hits.length >= 2) break;
  }
  return hits;
}

// Real record + ranking + the team's ACTUAL statistical leaders (the players
// who lead the team in each category this season, with their real numbers).
async function teamFacts(t: TeamLite, year: number): Promise<string> {
  const [detail, leaders] = await Promise.all([
    j(`${ESPN}/teams/${t.id}`),
    j(`${CORE}/seasons/${year}/types/2/teams/${t.id}/leaders`),
  ]);
  const tm = detail?.team;
  const rank = tm?.rank && tm.rank <= 25 ? `#${tm.rank}` : "unranked";
  const rec = tm?.record?.items?.[0]?.summary || "record n/a";
  const lines: string[] = [`${t.name}: ${rank} in the AP poll, record ${rec}.`];

  // For each category, grab the top leader's value + athlete reference.
  const picks: Array<{ label: string; value: string; ref: string }> = [];
  for (const c of LEADER_CATS) {
    const cat = (leaders?.categories || []).find((x: any) => x.name === c.key);
    const ld = cat?.leaders?.[0];
    const ref = ld?.athlete?.$ref;
    if (ld && ref) picks.push({ label: c.label, value: ld.displayValue || String(ld.value ?? ""), ref });
  }
  // Resolve each unique athlete ref to a real name + position (deduped).
  const uniq = Array.from(new Set(picks.map((p) => p.ref)));
  const names = new Map<string, string>();
  await Promise.all(uniq.map(async (ref) => {
    const a = await j(ref);
    if (a?.fullName) names.set(ref, `${a.fullName}${a.position?.abbreviation ? ` (${a.position.abbreviation})` : ""}`);
  }));
  const statLines = picks
    .map((p) => { const who = names.get(p.ref); return who ? `${who} leads with ${p.value} ${p.label}` : null; })
    .filter(Boolean);
  if (statLines.length) {
    lines.push(`${t.name} statistical leaders this season (REAL — use these EXACT names and numbers, do not substitute other players): ${statLines.join("; ")}.`);
  }
  return lines.join("\n");
}

// Build a block of verified current facts relevant to the title.
export async function getCfbGrounding(title: string): Promise<string> {
  // Teams list + scoreboard (also gives the current season year) up front.
  const [teams, scoreboard] = await Promise.all([
    getTeams().catch(() => [] as TeamLite[]),
    j(`${ESPN}/scoreboard`),
  ]);
  const year = Number(scoreboard?.season?.year) || new Date().getFullYear();
  const detected = detect(title, teams);

  const [rankings, news, ...teamBlocks] = await Promise.all([
    j(`${ESPN}/rankings`),
    j(`${ESPN}/news`),
    ...detected.map((t) => teamFacts(t, year)),
  ]);

  const parts: string[] = [];

  const ap = rankings?.rankings?.find((r: any) => /ap/i.test(r.shortName || r.name || "")) || rankings?.rankings?.[0];
  if (ap?.ranks?.length) {
    const top = ap.ranks.slice(0, 25).map((r: any) => `${r.current}. ${r.team?.location || r.team?.nickname} (${r.recordSummary || ""})`).join("; ");
    parts.push(`${ap.name} right now: ${top}.`);
  }

  if (scoreboard?.events?.length) {
    const games = scoreboard.events.slice(0, 12).map((e: any) => {
      const c = e.competitions?.[0]; const cs = c?.competitors || [];
      const a = cs[0], b = cs[1];
      if (!a || !b) return e.name;
      const st = c?.status?.type?.completed ? "final" : (c?.status?.type?.shortDetail || "upcoming");
      return `${a.team?.location} ${a.score ?? ""}-${b.score ?? ""} ${b.team?.location} (${st})`;
    }).join("; ");
    parts.push(`Current week's games/scores: ${games}.`);
  }

  if (news?.articles?.length) {
    const heads = news.articles.slice(0, 6).map((a: any) => a.headline).filter(Boolean).join("; ");
    if (heads) parts.push(`Recent real headlines: ${heads}.`);
  }

  for (const tb of teamBlocks) if (tb) parts.push(tb as string);

  return parts.join("\n\n");
}
