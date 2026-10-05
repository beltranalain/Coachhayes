import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedPosts, readingMinutes } from "@/lib/blog";
import { getSiteConfig } from "@/lib/siteConfig";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { branding } = await getSiteConfig();
  const site = branding.siteName || "Coach Hayes Football";
  const title = `${site} Blog — film breakdowns, recruiting & the game`;
  const description = `Articles from ${site}: recruiting breakdowns, film study, show recaps, and the stories behind the game.`;
  return {
    title,
    description,
    alternates: { canonical: "/blog" },
    openGraph: { title, description, type: "website", url: "/blog" },
  };
}

function fmt(ts: number | null) {
  if (!ts) return "";
  try { return new Date(ts).toLocaleDateString("en-US", { dateStyle: "medium" }); } catch { return ""; }
}

export default async function BlogIndex() {
  const [posts, { branding }] = await Promise.all([getPublishedPosts(), getSiteConfig()]);
  const site = branding.siteName || "Coach Hayes Football";
  const [lead, ...rest] = posts;

  return (
    <div className="wide blogwrap">
      <div className="hd center" style={{ marginBottom: 26 }}>
        <p className="k" style={{ textAlign: "center" }}>{site} · The Blog</p>
        <h1>From the sideline.</h1>
        <p>Film breakdowns, recruiting notes, show recaps, and the stories behind the game.</p>
      </div>

      {posts.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 30px", maxWidth: 560, margin: "0 auto" }}>
          <h3 style={{ marginBottom: 8 }}>The first story is coming soon</h3>
          <p style={{ color: "var(--sub)", maxWidth: "44ch", margin: "0 auto 18px" }}>
            Articles will show up here as they go live. In the meantime, check the rankings and jump into the community.
          </p>
          <Link className="pill" href="/rankings">See the rankings</Link>
        </div>
      ) : (
        <>
          {/* Lead story */}
          {lead && (
            <Link href={`/blog/${lead.slug}`} className="bloglead">
              <div className={`bloglead-art${lead.coverImage ? " has-img" : ""}`} style={lead.coverImage ? { backgroundImage: `url(${lead.coverImage})` } : undefined} />
              <div className="bloglead-body">
                {lead.categories[0] && <span className="blogtag">{lead.categories[0]}</span>}
                <h2>{lead.title}</h2>
                {lead.excerpt && <p>{lead.excerpt}</p>}
                <span className="blogmeta">{fmt(lead.publishedAt)} · {readingMinutes(lead.content)} min read</span>
              </div>
            </Link>
          )}

          {/* Grid */}
          {rest.length > 0 && (
            <div className="bloggrid">
              {rest.map((p) => (
                <Link key={p.id} href={`/blog/${p.slug}`} className="blogcard">
                  <div className={`blogcard-art${p.coverImage ? " has-img" : ""}`} style={p.coverImage ? { backgroundImage: `url(${p.coverImage})` } : undefined} />
                  <div className="blogcard-body">
                    {p.categories[0] && <span className="blogtag">{p.categories[0]}</span>}
                    <h3>{p.title}</h3>
                    {p.excerpt && <p>{p.excerpt}</p>}
                    <span className="blogmeta">{fmt(p.publishedAt)} · {readingMinutes(p.content)} min read</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
