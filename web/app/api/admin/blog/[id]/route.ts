import { NextResponse } from "next/server";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";
import { requireRole } from "@/lib/requireAdmin";
import { slugify, sanitizeBlogHtml, type BlogStatus } from "@/lib/blog";
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

async function uniqueSlug(db: FirebaseFirestore.Firestore, base: string, exceptId: string): Promise<string> {
  const slug = base || "post";
  for (let i = 1; i < 50; i++) {
    const candidate = i === 1 ? slug : `${slug}-${i}`;
    const snap = await db.collection("blogPosts").where("slug", "==", candidate).limit(1).get();
    if (snap.empty || snap.docs[0].id === exceptId) return candidate;
  }
  return `${slug}-${Date.now()}`;
}

// GET — a single post for the editor.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate(request); if (g.error) return g.error;
  const { id } = await params;
  const doc = await g.db!.collection("blogPosts").doc(id).get();
  if (!doc.exists) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ post: { id: doc.id, ...doc.data() } });
}

// PATCH — update a post.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate(request); if (g.error) return g.error;
  const { id } = await params;
  let b: any; try { b = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const ref = g.db!.collection("blogPosts").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const cur: any = snap.data();

  const title = S(b.title, 160);
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });

  const status: BlogStatus = VALID.includes(b.status) ? b.status : cur.status || "draft";
  const now = Date.now();

  // Keep the slug stable unless explicitly changed.
  const wantSlug = S(b.slug) || cur.slug || slugify(title);
  const slug = wantSlug === cur.slug ? cur.slug : await uniqueSlug(g.db!, slugify(wantSlug), id);

  // First time it goes live, stamp publishedAt.
  const wasPublished = cur.status === "published";
  const nowPublished = status === "published";
  const publishedAt = nowPublished ? (cur.publishedAt || now) : cur.publishedAt ?? null;

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
    updatedAt: now,
    publishedAt,
  };

  try {
    await ref.set(fields, { merge: true });
    if (!wasPublished && nowPublished) {
      try { await broadcastNotification(cur.authorName || "Coach Hayes Football", "post", `blog-${id}`, `New article: ${title}`); } catch {}
    }
    return NextResponse.json({ ok: true, post: { id, ...cur, ...fields } });
  } catch {
    return NextResponse.json({ error: "Save failed." }, { status: 500 });
  }
}

// DELETE — remove a post.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate(request); if (g.error) return g.error;
  const { id } = await params;
  try {
    await g.db!.collection("blogPosts").doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  }
}
