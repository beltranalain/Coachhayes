import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedPostBySlug, getPublishedPosts, readingMinutes, stripHtml, bumpPostViews } from "@/lib/blog";
import { getSiteConfig } from "@/lib/siteConfig";

export const dynamic = "force-dynamic";

function fmt(ts: number | null) {
  if (!ts) return "";
  try { return new Date(ts).toLocaleDateString("en-US", { dateStyle: "medium" }); } catch { return ""; }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) return { title: "Post not found" };
  const title = post.metaTitle || post.title;
  const description = post.metaDescription || post.excerpt || stripHtml(post.content).slice(0, 155);
  return {
    title,
    description,
    keywords: post.keywords || undefined,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title, description, type: "article", url: `/blog/${post.slug}`,
      images: post.coverImage ? [{ url: post.coverImage }] : undefined,
      publishedTime: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function BlogArticle({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [post, { branding }] = await Promise.all([getPublishedPostBySlug(slug), getSiteConfig()]);
  if (!post) notFound();
  const site = branding.siteName || "Coach Hayes Football";

  // Best-effort view count (don't block render).
  bumpPostViews(post.id).catch(() => {});

  // Up to 3 other recent posts.
  const more = (await getPublishedPosts(4)).filter((p) => p.slug !== post.slug).slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.metaDescription || post.excerpt || "",
    image: post.coverImage || undefined,
    datePublished: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
    dateModified: post.updatedAt ? new Date(post.updatedAt).toISOString() : undefined,
    author: { "@type": "Organization", name: post.authorName || site },
    publisher: { "@type": "Organization", name: site },
    mainEntityOfPage: { "@type": "WebPage", "@id": `/blog/${post.slug}` },
    keywords: post.keywords || undefined,
  };

  return (
    <article className="wide blogpost">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="blogpost-head">
        <Link href="/blog" className="link" style={{ fontSize: 13 }}>← All posts</Link>
        {post.categories[0] && <span className="blogtag" style={{ marginTop: 12 }}>{post.categories[0]}</span>}
        <h1>{post.title}</h1>
        <p className="blogmeta">{post.authorName} · {fmt(post.publishedAt)} · {readingMinutes(post.content)} min read</p>
      </div>

      {post.coverImage && (
        <div className="blogpost-cover" style={{ backgroundImage: `url(${post.coverImage})` }} />
      )}

      <div className="blogpost-body" dangerouslySetInnerHTML={{ __html: post.content }} />

      {post.tags.length > 0 && (
        <div className="blogpost-tags">
          {post.tags.map((t) => <span key={t} className="blogtag soft">{t}</span>)}
        </div>
      )}

      <div className="blogpost-cta card">
        <h3>Graded on film, not on hype.</h3>
        <p>See where recruits land on the board, or jump into the community and talk ball.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <Link className="pill" href="/rankings">See the rankings</Link>
          <Link className="link" href="/community">Join the community ›</Link>
        </div>
      </div>

      {more.length > 0 && (
        <div className="blogmore">
          <h3>More from the blog</h3>
          <div className="bloggrid">
            {more.map((p) => (
              <Link key={p.id} href={`/blog/${p.slug}`} className="blogcard">
                <div className={`blogcard-art${p.coverImage ? " has-img" : ""}`} style={p.coverImage ? { backgroundImage: `url(${p.coverImage})` } : undefined} />
                <div className="blogcard-body">
                  {p.categories[0] && <span className="blogtag">{p.categories[0]}</span>}
                  <h3>{p.title}</h3>
                  <span className="blogmeta">{fmt(p.publishedAt)} · {readingMinutes(p.content)} min read</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
