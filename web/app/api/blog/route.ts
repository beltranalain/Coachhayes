import { NextResponse } from "next/server";
import { getPublishedPosts, readingMinutes } from "@/lib/blog";

export const dynamic = "force-dynamic";

// Public blog feed for the mobile app (published posts only, lightweight fields).
export async function GET() {
  try {
    const posts = await getPublishedPosts(30);
    const rows = posts.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt || "",
      category: p.categories?.[0] || "",
      readMins: readingMinutes(p.content),
      cover: p.coverImage || "",
      publishedAt: p.publishedAt || p.createdAt || 0,
    }));
    return NextResponse.json({ posts: rows });
  } catch {
    return NextResponse.json({ posts: [] });
  }
}
