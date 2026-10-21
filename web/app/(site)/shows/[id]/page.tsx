import type { Metadata } from "next";
import Link from "next/link";
import { getSiteConfig } from "@/lib/siteConfig";
import { PRIMARY_CHANNEL } from "@/lib/channels";
import { getPlaylists, getUploadsPage } from "@/lib/youtube";

export const metadata: Metadata = { title: "Show" };

const fmtDate = (s: string) => { try { return new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); } catch { return ""; } };

// A single show = a YouTube playlist: the series plays here (playlist embed) and
// every episode is listed below. Reachable from the Shows page / community strip.
export default async function ShowDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { channels } = await getSiteConfig();
  const channelId = channels[0]?.channelId || PRIMARY_CHANNEL.channelId;

  const [playlists, page] = await Promise.all([getPlaylists(channelId, 50), getUploadsPage(id)]);
  const pl = playlists.find((p) => p.id === id);
  const videos = page.items;
  const title = pl?.title || "Show";

  return (
    <>
      <section className="page-hero">
        <div className="wrap">
          <span className="eyebrow"><Link className="link" href="/shows">Shows</Link></span>
          <h1 className="anton">{title}</h1>
          {pl?.description ? <p>{pl.description.slice(0, 240)}</p> : null}
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 40 }}>
        <div className="wrap">
          {/* Play the whole series */}
          <div style={{ position: "relative", aspectRatio: "16/9", borderRadius: 16, overflow: "hidden", border: "1px solid var(--hair)", background: "#000", maxWidth: 900, margin: "0 auto 36px" }}>
            <iframe
              src={`https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(id)}`}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
            />
          </div>

          {videos.length > 0 ? (
            <div className="grid grid-3">
              {videos.map((v) => (
                <a key={v.id} className="tile" href={`https://www.youtube.com/watch?v=${v.id}&list=${encodeURIComponent(id)}`} target="_blank" rel="noopener noreferrer">
                  <div className="timg" style={{ backgroundImage: `url("${(v.thumbnail || "").replace(/"/g, "%22")}")`, backgroundSize: "cover", backgroundPosition: "center" }}>
                    <span className="lbl">Watch</span>
                  </div>
                  <div className="tb">
                    <h3>{v.title}</h3>
                    <p>{fmtDate(v.publishedAt)}</p>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p style={{ textAlign: "center", color: "var(--sub)" }}>No episodes found in this series.</p>
          )}
        </div>
      </section>
    </>
  );
}
