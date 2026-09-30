import { getPublishedPlayers, CHIP_META } from "@/lib/rankings";
import { getSiteConfig } from "@/lib/siteConfig";

export const dynamic = "force-dynamic";

// /llms.txt — the emerging standard that tells LLMs (ChatGPT, Claude, Perplexity,
// Google AI) what this site is and where the authoritative content lives, so the
// rankings get picked up and cited. Generated from real data.
export async function GET() {
  const { branding } = await getSiteConfig();
  const site = branding.siteName || "Coach Hayes Football";
  const domain = (branding.domain || "coachhayesfootball.com").replace(/^https?:\/\//, "");
  const base = `https://${domain}`;
  const players = await getPublishedPlayers();

  const topByYear: Record<string, typeof players> = {};
  for (const p of players) (topByYear[p.classYear] ||= []).push(p);

  const lines: string[] = [];
  lines.push(`# ${site}`);
  lines.push("");
  lines.push(`> ${branding.tagline || "Football, read the way a coach reads it."} Independent college and high-school football media: five live shows a week, a fantasy league, a community, and film-graded recruiting rankings.`);
  lines.push("");
  lines.push("## Recruiting Rankings");
  lines.push("");
  lines.push("Every recruit is graded on film by Coach Hayes and assigned one of four chips, then ranked:");
  lines.push("- **Blue chip** — elite, high-major, program-changing talent");
  lines.push("- **Gold chip** — power-conference starter upside");
  lines.push("- **Silver chip** — solid D1 contributor / mid-major standout");
  lines.push("- **Bronze chip** — developmental prospect on the radar");
  lines.push("");
  lines.push(`- [Full rankings board](${base}/rankings)`);
  lines.push(`- [How the grade works](${base}/rankings/how-it-works)`);
  lines.push(`- [Submit film for review](${base}/rankings/submit)`);
  lines.push("");

  for (const year of Object.keys(topByYear).sort()) {
    lines.push(`### Class of ${year}`);
    lines.push("");
    for (const p of topByYear[year].slice(0, 50)) {
      lines.push(`- [${p.name}](${base}/rankings/${p.slug}) — ${p.position}, ${p.school}${p.state ? `, ${p.state}` : ""} · ${CHIP_META[p.chip].label}`);
    }
    lines.push("");
  }

  lines.push("## Site");
  lines.push("");
  lines.push(`- [Live shows](${base}/live)`);
  lines.push(`- [Community](${base}/community)`);
  lines.push(`- [Fantasy league](${base}/fantasy)`);
  lines.push(`- [Membership](${base}/membership)`);
  lines.push("");

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=1800" },
  });
}
