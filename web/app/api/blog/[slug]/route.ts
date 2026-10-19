import { NextResponse } from "next/server";
import { getPublishedPostBySlug, readingMinutes } from "@/lib/blog";

export const dynamic = "force-dynamic";

// Public single-post feed for the mobile app's in-app article reader.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getPublishedPostBySlug(slug);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    post: {
      title: p.title,
      content: p.content,
      cover: p.coverImage || "",
      category: p.categories?.[0] || "",
      readMins: readingMinutes(p.content),
      author: p.authorName || "",
      publishedAt: p.publishedAt || p.createdAt || 0,
    },
  });
}
