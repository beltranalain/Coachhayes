import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Fetch a URL's Open Graph preview (title, image, site) so the community feed can
// render a thumbnail card instead of a raw www address. Server-side to avoid CORS
// and to keep the fetch off the client. Best-effort + short timeout.
function decodeEntities(s: string): string {
  return String(s || "")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").trim();
}
function metaContent(html: string, key: string): string {
  // Match <meta property|name="key" ... content="...">  (either attribute order)
  const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*?content=["']([^"']*)["']`, "i"));
  if (a) return a[1];
  const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*?(?:property|name)=["']${key}["']`, "i"));
  return b ? b[1] : "";
}
function absolute(img: string, base: string): string {
  if (!img) return "";
  try { return new URL(img, base).href; } catch { return img; }
}

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url") || "";
  if (!/^https?:\/\//i.test(url)) return NextResponse.json({ error: "Invalid URL." }, { status: 400 });

  const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } })();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CoachHayesBot/1.0; +https://coachhayesfootball.com)", Accept: "text/html" },
      redirect: "follow", signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    const ct = res.headers.get("content-type") || "";
    if (!res.ok || !ct.includes("text/html")) return NextResponse.json({ url, host, site: host, title: "", image: "", description: "" });

    const html = (await res.text()).slice(0, 400_000);
    const title = decodeEntities(metaContent(html, "og:title") || metaContent(html, "twitter:title") || (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? ""));
    const image = absolute(metaContent(html, "og:image") || metaContent(html, "og:image:url") || metaContent(html, "twitter:image"), url);
    const site = decodeEntities(metaContent(html, "og:site_name")) || host;
    const description = decodeEntities(metaContent(html, "og:description") || metaContent(html, "description"));

    return NextResponse.json({ url, host, site, title, image, description });
  } catch {
    return NextResponse.json({ url, host, site: host, title: "", image: "", description: "" });
  }
}
