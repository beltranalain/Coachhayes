import { NextResponse } from "next/server";
import { requireRole } from "@/lib/requireAdmin";
import { adminConfigured } from "@/lib/firebaseAdmin";
import { generateWithGroq, groqConfigured } from "@/lib/groq";
import { getSiteConfig } from "@/lib/siteConfig";
import { getCfbGrounding } from "@/lib/sportsData";
import { getPublishedPlayers, CHIP_META } from "@/lib/rankings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/admin/blog/generate — draft a post with Groq. Does NOT save; it just
// fills the editor fields so the coach can review and edit before publishing.
export async function POST(request: Request) {
  if (!adminConfigured) return NextResponse.json({ error: "Not configured." }, { status: 400 });
  const role = await requireRole(request);
  if (!role || !["owner", "manager"].includes(role)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  if (!groqConfigured) {
    return NextResponse.json({ error: "The AI writer isn't connected yet. Add your Groq key in the project settings to turn it on." }, { status: 400 });
  }

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const title = String(body?.title || "").trim();
  if (!title) return NextResponse.json({ error: "Enter a title first." }, { status: 400 });

  const linkList: string[] = typeof body?.links === "string"
    ? body.links.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean).slice(0, 8)
    : Array.isArray(body?.links) ? body.links.map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 8) : [];

  let site = "Coach Hayes Football";
  try { const { branding } = await getSiteConfig(); if (branding?.siteName) site = branding.siteName; } catch {}

  // Ground the post in REAL current data so the AI doesn't invent players/stats:
  // live ESPN college-football facts + this site's own graded recruiting board.
  let grounding = "";
  try { grounding = await getCfbGrounding(title); } catch {}
  try {
    const players = await getPublishedPlayers();
    if (players.length) {
      const board = players.slice(0, 15)
        .map((p) => `${p.name} (${[p.position, p.school, p.classYear].filter(Boolean).join(", ")}) — ${CHIP_META[p.chip]?.label || p.chip}${p.commit ? `, committed to ${p.commit}` : ""}`)
        .join("; ");
      grounding += `${grounding ? "\n\n" : ""}${site}'s own graded recruits (the Coach Hayes rankings board — real, use these when writing about recruiting): ${board}.`;
    }
  } catch {}

  const today = new Date().toLocaleDateString("en-US", { dateStyle: "full" });
  const dataBlock = grounding.trim()
    ? `VERIFIED CURRENT DATA (this is accurate and up to date as of ${today} — every specific fact you state MUST come from here; do not reference any other season or year):\n${grounding.trim()}\n\n`
    : "";

  const prompt = `You are a content writer for "${site}", a football media platform covering high school and college football: live shows, a film-graded recruiting rankings board (the "four-chip" system — Blue, Gold, Silver, Bronze), a fantasy league, a fan community, and merch.

${dataBlock}Write a comprehensive, engaging blog post based on this title: "${title}"

ACCURACY RULES (critical — this is a real publication):
- Use ONLY the VERIFIED CURRENT DATA above for any specific fact: team records, rankings, scores, dates, player names, and stats. That data is current and correct.
- When writing about key players, use ONLY the statistical leaders named in the data — those are the players who actually lead each team. Do NOT feature any player who is not named in the data (no backups, no made-up names).
- You MAY cite the exact statistics provided (they are real and current). Do NOT invent, round differently, or guess any other numbers, ratings, jersey details, or quotes.
- If you don't have a specific number for a point, write about it qualitatively ("a disruptive pass rusher") instead of inventing a figure.
- If the title names a team or player not in the data, keep the piece analytical and general — do not fabricate specifics to fill gaps.
${dataBlock ? "" : "- No live data was available this time, so avoid specific current records, scores, or named players entirely; write an evergreen, analytical piece.\n"}
Requirements:
- Content: 700-1100 words in HTML format using <h2>, <h3>, <p>, <ul>/<li>, <strong>, and <em> tags only. Do NOT include <h1> or repeat the title in the content.
- Excerpt: 2-3 compelling sentences summarizing the post (plain text, no HTML)
- Meta Description: Under 155 characters, SEO-optimized (plain text)
- Keywords: 5-8 comma-separated relevant keywords
- Suggested Tags: 3-5 short tag names relevant to the content
- Tone: knowledgeable football voice, confident but approachable, like a coach breaking down the game
- Internal links: naturally include 2-3 links to REAL ${site} pages using ONLY these exact relative URLs: <a href="/rankings">the rankings</a>, <a href="/shows">the shows</a>, <a href="/live">watch live</a>, <a href="/community">the community</a>, <a href="/fantasy">fantasy</a>, <a href="/shop">the shop</a>, <a href="/membership">membership</a>, <a href="/blog">more articles</a>. Do NOT invent other URLs${linkList.length ? " or the required links below" : ""}.
- External links: include 1-2 links to reputable external sources relevant to the topic for credibility${linkList.length ? `
- REQUIRED links (IMPORTANT): weave a natural, contextually relevant link to EACH of these into the body where it genuinely adds value, with descriptive anchor text:
${linkList.map((u) => `  - ${u}`).join("\n")}
  For relative paths (starting with "/") use <a href="/path">anchor</a>. For full URLs (http...) use <a href="URL" target="_blank" rel="noopener noreferrer">anchor</a>.` : ""}
- End with a short call-to-action inviting readers into the community or to check the rankings.

Respond ONLY with valid JSON (no markdown code blocks):
{
  "content": "HTML content here",
  "excerpt": "Short excerpt here",
  "metaDescription": "SEO meta description here",
  "keywords": "keyword1, keyword2, keyword3",
  "suggestedTags": ["tag1", "tag2", "tag3"]
}`;

  try {
    const responseText = await generateWithGroq(prompt, { temperature: 0.4, maxTokens: 4000, jsonMode: true });
    const cleaned = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    if (!cleaned) throw new Error("The AI returned an empty response — please try again.");

    let generated: any = null;
    try { generated = JSON.parse(cleaned); }
    catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) { try { generated = JSON.parse(m[0]); } catch { /* fall through */ } }
    }
    if (!generated || typeof generated.content !== "string" || !generated.content.trim()) {
      throw new Error("The AI returned malformed content — please try again.");
    }

    return NextResponse.json({
      generated: {
        content: generated.content || "",
        excerpt: generated.excerpt || "",
        metaDescription: generated.metaDescription || "",
        keywords: generated.keywords || "",
        suggestedTags: Array.isArray(generated.suggestedTags) ? generated.suggestedTags.map((t: unknown) => String(t)).slice(0, 8) : [],
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to generate." }, { status: 500 });
  }
}
