"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/hayes/admin/Shell";
import { getIdToken } from "@/lib/firebase";

type Post = { id: string; title: string; slug: string; status: string; featured?: boolean; views?: number; updatedAt?: number; publishedAt?: number; createdAt?: number };

const statusColor: Record<string, string> = { published: "var(--green)", draft: "var(--dim)", archived: "var(--live)" };

export default function BlogAdmin() {
  const [brand, setBrand] = useState({ name: "Coach Hayes Football", logo: "" });
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const tok = async (): Promise<Record<string, string>> => { const t = await getIdToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };

  useEffect(() => {
    (async () => {
      const h = await tok();
      try {
        const [cfg, list] = await Promise.all([
          fetch("/api/site-config", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
          fetch("/api/admin/blog", { headers: h, cache: "no-store" }).then((r) => r.json()).catch(() => ({ posts: [] })),
        ]);
        if (cfg?.branding) setBrand({ name: cfg.branding.siteName || "Coach Hayes Football", logo: cfg.branding.logo || "" });
        setPosts(list.posts || []);
      } finally { setLoading(false); }
    })();
  }, []);

  const published = posts.filter((p) => p.status === "published").length;

  return (
    <Shell title="Blog" sub={posts.length ? `${posts.length} post${posts.length === 1 ? "" : "s"} · ${published} published` : "Write posts with AI and publish them to your site"} brandName={brand.name} logo={brand.logo}>
      <div className="card">
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <div>
            <h3>Posts</h3>
            <p className="cs" style={{ margin: 0 }}>Type a title, click Generate with AI, review, and publish. Published posts appear on your blog and home page.</p>
          </div>
          <Link href="/admin/blog/new" className="btn sm" style={{ marginLeft: "auto", background: "var(--acc)", color: "var(--accInk)" }}>+ New post</Link>
        </div>

        {loading ? (
          <div className="note" style={{ margin: 0 }}>Loading…</div>
        ) : posts.length === 0 ? (
          <div className="note" style={{ margin: 0 }}>No posts yet. <Link className="link" href="/admin/blog/new">Write your first one →</Link></div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div className="blogrow blogrow-head">
              <span>Title</span><span>Status</span><span>Views</span><span>Updated</span><span />
            </div>
            {posts.map((p) => (
              <div key={p.id} className="blogrow">
                <span style={{ minWidth: 0 }}>
                  <Link href={`/admin/blog/${p.id}/edit`} className="blogrow-title">{p.title || "(untitled)"}</Link>
                  {p.featured && <em style={{ fontStyle: "normal", fontSize: 11, color: "var(--acc)", marginLeft: 8 }}>Featured</em>}
                </span>
                <span style={{ color: statusColor[p.status] || "var(--dim)", fontWeight: 600, fontSize: 12.5, textTransform: "capitalize" }}>{p.status}</span>
                <span style={{ color: "var(--sub)", fontSize: 13 }}>{p.views || 0}</span>
                <span style={{ color: "var(--sub)", fontSize: 13 }}>{p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : "—"}</span>
                <span style={{ textAlign: "right", display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  {p.status === "published" && <Link className="link" href={`/blog/${p.slug}`} target="_blank" style={{ fontSize: 12.5, color: "var(--sub)" }}>View</Link>}
                  <Link className="link" href={`/admin/blog/${p.id}/edit`} style={{ fontSize: 12.5 }}>Edit</Link>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
