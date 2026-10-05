import "server-only";
import { getAdminDb } from "./firebaseAdmin";

// Blog posts live in Firestore `blogPosts`; categories/tags in `blogCategories`
// and `blogTags` (for the admin picker + suggestions). Public pages read
// published posts directly on the server (same pattern as rankings).

export type BlogStatus = "draft" | "published" | "archived";

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string; // sanitized HTML
  metaTitle: string;
  metaDescription: string;
  keywords: string;
  coverImage: string; // data URL or external URL
  status: BlogStatus;
  featured: boolean;
  tags: string[];
  categories: string[];
  views: number;
  authorName: string;
  createdAt: number;
  updatedAt: number;
  publishedAt: number | null;
};

export type BlogTerm = { id: string; name: string; slug: string };

// A URL-safe slug from a title (lowercase, dashes, trimmed).
export function slugify(input: string): string {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "post";
}

// Plain text from HTML (for previews, word counts).
export function stripHtml(html: string): string {
  return String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Lightweight allowlist sanitizer for admin-authored blog HTML. Posts render via
// dangerouslySetInnerHTML, so strip anything executable: script/style/iframe
// blocks, inline event handlers (on*), and javascript: URLs. Kept simple — the
// author is a trusted admin, this is defense-in-depth, not a hostile-input guard.
export function sanitizeBlogHtml(html: string): string {
  let out = String(html || "");
  // Drop dangerous element blocks entirely (tag + contents).
  out = out.replace(/<(script|style|iframe|object|embed|form)[\s\S]*?<\/\1>/gi, "");
  out = out.replace(/<(script|style|iframe|object|embed|form)[^>]*\/?>/gi, "");
  // Strip inline event handlers: on*="..." / on*='...' / on*=unquoted.
  out = out.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");
  out = out.replace(/\son[a-z]+\s*=\s*[^\s">]+/gi, "");
  // Neutralize javascript: / data: (non-image) URLs in href/src.
  out = out.replace(/(href|src)\s*=\s*"(\s*javascript:)[^"]*"/gi, '$1="#"');
  out = out.replace(/(href|src)\s*=\s*'(\s*javascript:)[^']*'/gi, "$1='#'");
  return out.trim();
}

// Reading time in minutes (~200 wpm, min 1).
export function readingMinutes(html: string): number {
  const words = stripHtml(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function toPost(id: string, d: any): BlogPost {
  return {
    id,
    slug: d.slug || "",
    title: d.title || "",
    excerpt: d.excerpt || "",
    content: d.content || "",
    metaTitle: d.metaTitle || "",
    metaDescription: d.metaDescription || "",
    keywords: d.keywords || "",
    coverImage: d.coverImage || "",
    status: (d.status as BlogStatus) || "draft",
    featured: Boolean(d.featured),
    tags: Array.isArray(d.tags) ? d.tags : [],
    categories: Array.isArray(d.categories) ? d.categories : [],
    views: Number(d.views) || 0,
    authorName: d.authorName || "Coach Hayes Football",
    createdAt: Number(d.createdAt) || 0,
    updatedAt: Number(d.updatedAt) || 0,
    publishedAt: d.publishedAt != null ? Number(d.publishedAt) : null,
  };
}

const byNewest = (a: BlogPost, b: BlogPost) =>
  (b.publishedAt || b.createdAt || 0) - (a.publishedAt || a.createdAt || 0);

// Published posts, newest first. Single-field filter (no composite index); sort
// in memory to avoid an index requirement.
export async function getPublishedPosts(max?: number): Promise<BlogPost[]> {
  const db = getAdminDb();
  if (!db) return [];
  try {
    const snap = await db.collection("blogPosts").where("status", "==", "published").get();
    const posts = snap.docs.map((d) => toPost(d.id, d.data())).sort(byNewest);
    return typeof max === "number" ? posts.slice(0, max) : posts;
  } catch {
    return [];
  }
}

// One published post by slug (public article page).
export async function getPublishedPostBySlug(slug: string): Promise<BlogPost | null> {
  const db = getAdminDb();
  if (!db || !slug) return null;
  try {
    const snap = await db.collection("blogPosts").where("slug", "==", slug).limit(1).get();
    if (snap.empty) return null;
    const d = snap.docs[0];
    const post = toPost(d.id, d.data());
    return post.status === "published" ? post : null;
  } catch {
    return null;
  }
}

// Best-effort view bump (fire and forget from the article page).
export async function bumpPostViews(id: string): Promise<void> {
  const db = getAdminDb();
  if (!db || !id) return;
  try {
    const FieldValue = (await import("firebase-admin/firestore")).FieldValue;
    await db.collection("blogPosts").doc(id).update({ views: FieldValue.increment(1) });
  } catch {
    /* non-fatal */
  }
}
