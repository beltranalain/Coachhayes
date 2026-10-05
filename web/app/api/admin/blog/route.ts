import { NextResponse } from "next/server";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";
import { requireRole } from "@/lib/requireAdmin";
import { slugify, sanitizeBlogHtml, type BlogStatus } from "@/lib/blog";
import { getSiteConfig } from "@/lib/siteConfig";
import { broadcastNotification } from "@/lib/notify";

export const dynamic = "force-dynamic";

async function gate(request: Request) {
  if (!adminConfigured) return { error: NextResponse.json({ error: "Not configured." }, { status: 400 }) };
  const role = await requireRole(request);
  if (!role || !["owner", "manager"].includes(role)) return { error: NextResponse.json({ error: "Not authorized." }, { status: 401 }) };
  const db = getAdminDb();
  if (!db) return { error: NextResponse.json({ error: "No database." }, { status: 500 }) };
  return { db };
}

const S = (v: unknown, n = 300) => String(v ?? "").trim().slice(0, n);
const arr = (v: unknown, n = 20) => (Array.isArray(v) ? v.map((x) => S(x, 60)).filter(Boolean).slice(0, n) : []);
const VALID: BlogStatus[] = ["draft", "published", "archived"];

// Ensure a slug is unique across posts (append -2, -3… on collision).
async function uniqueSlug(db: FirebaseFirestore.Firestore, base: string, exceptId?: string): Promise<string> {
  let slug = base || "post";
  for (let i = 1; i < 50; i++) {
    const candidate = i === 1 ? slug : `${slug}-${i}`;
    const snap = await db.collection("blogPosts").where("slug", "==", candidate).limit(1).get();
    if (snap.empty || snap.docs[0].id === exceptId) return candidate;
  }
  return `${slug}-${Date.now()}`;
}

// GET — all posts (newest first) for the admin table.
export async function GET(request: Request) {
  const g = await gate(request); if (g.error) return g.error;
  const snap = await g.db!.collection("blogPosts").get();
  const posts = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  return NextResponse.json({ posts });
}

// POST — create a new post.
export async function POST(request: Request) {
  const g = await gate(request); if (g.error) return g.error;
  let b: any; try { b = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const title = S(b.title, 160);
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });

  const status: BlogStatus = VALID.includes(b.status) ? b.status : "draft";
  const now = Date.now();
  const slug = await uniqueSlug(g.db!, S(b.slug) || slugify(title));

  let authorName = "Coach Hayes Football";
  try { const { branding } = await getSiteConfig(); if (branding?.siteName) authorName = branding.siteName; } catch {}

  const fields = {
    slug,
    title,
    excerpt: S(b.excerpt, 400),
    content: sanitizeBlogHtml(S(b.content, 120_000)),
    metaTitle: S(b.metaTitle, 80),
    metaDescription: S(b.metaDescription, 200),
    keywords: S(b.keywords, 300),
    coverImage: S(b.coverImage, 700_000),
    status,
    featured: Boolean(b.featured),
    tags: arr(b.tags),
    categories: arr(b.categories),
    views: 0,
    authorName,
    createdAt: now,
    updatedAt: now,
    publishedAt: status === "published" ? now : null,
  };

  try {
    const ref = await g.db!.collection("blogPosts").add(fields);
    // Announce newly-published posts to the community (best-effort).
    if (status === "published") {
      try { await broadcastNotification(authorName, "post", `blog-${ref.id}`, `New article: ${title}`); } catch {}
    }
    return NextResponse.json({ ok: true, post: { id: ref.id, ...fields } });
  } catch {
    return NextResponse.json({ error: "Save failed." }, { status: 500 });
  }
}
