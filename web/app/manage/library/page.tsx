"use client";

import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/hayes/admin/Shell";
import { getIdToken } from "@/lib/firebase";

// Library — the coach's full YouTube catalog (auto-pulled from his channel's
// uploads, so new videos appear on their own), plus any owned-platform
// recordings from Cloudflare Stream. No invented metadata: everything shown is
// real, straight from the channel.
const CF_CODE = process.env.NEXT_PUBLIC_CF_STREAM_CUSTOMER_CODE || "";
const playbackUrl = (uid: string) =>
  CF_CODE ? `https://customer-${CF_CODE}.cloudflarestream.com/${uid}/iframe` : `https://iframe.videodelivery.net/${uid}`;

type YtVideo = { id: string; title: string; publishedAt: string; thumbnail: string };
const fmtDate = (s: string) => { try { return new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); } catch { return ""; } };

export default function LibraryPage() {
  const [brand, setBrand] = useState({ name: "Coach Hayes Football", logo: "" });
  const [yt, setYt] = useState<YtVideo[]>([]);
  const [ytConfigured, setYtConfigured] = useState(true);
  const [vods, setVods] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/site-config", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (d?.branding) setBrand({ name: d.branding.siteName || "Coach Hayes Football", logo: d.branding.logo || "" }); }).catch(() => {});
    // YouTube catalog (public proxy; the key stays on the server).
    fetch("/api/youtube?type=uploads&limit=60", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      setYtConfigured(d?.configured !== false);
      setYt(Array.isArray(d?.items) ? d.items.filter((v: YtVideo) => v.id) : []);
    }).catch(() => setYtConfigured(false)).finally(() => setLoading(false));
    // Owned-platform recordings (Cloudflare Stream), if any.
    (async () => {
      try {
        const t = await getIdToken();
        const r = await fetch("/api/stream/vod", { headers: t ? { Authorization: `Bearer ${t}` } : {}, cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        setVods(Array.isArray(d.videos) ? d.videos.filter((v: unknown): v is string => typeof v === "string" && !!v) : []);
      } catch { /* none */ }
    })();
  }, []);

  const ytFiltered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? yt.filter((v) => v.title.toLowerCase().includes(s)) : yt;
  }, [yt, q]);

  return (
    <Shell title="Library" sub={yt.length ? `${yt.length} videos from YouTube${vods.length ? ` · ${vods.length} recording${vods.length === 1 ? "" : "s"}` : ""}` : "Your channel catalog, in one place"} brandName={brand.name} logo={brand.logo}>
      {/* YouTube catalog */}
      <div className="card">
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
          <div><h3>YouTube library</h3><p className="cs" style={{ margin: 0 }}>Pulled straight from your channel — new uploads show up here automatically.</p></div>
          {yt.length > 0 && (
            <div className="fld" style={{ marginLeft: "auto", marginBottom: 0, minWidth: 220 }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your videos" />
            </div>
          )}
        </div>

        {loading ? (
          <div className="note" style={{ margin: 0 }}>Loading your library…</div>
        ) : !ytConfigured ? (
          <div className="note" style={{ margin: 0, borderLeftColor: "var(--amber)" }}>
            <b>YouTube isn’t connected.</b> Add YOUTUBE_API_KEY on the server to pull your channel’s videos in here.
          </div>
        ) : yt.length === 0 ? (
          <div className="note" style={{ margin: 0 }}>No videos found on the channel yet.</div>
        ) : ytFiltered.length === 0 ? (
          <div className="note" style={{ margin: 0 }}>No videos match “{q}”.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
            {ytFiltered.map((v) => (
              <a key={v.id} href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", border: "1px solid var(--hair)", borderRadius: 12, overflow: "hidden", background: "var(--alt)" }}>
                <span style={{ aspectRatio: "16/9", backgroundColor: "var(--card)", backgroundImage: `url("${(v.thumbnail || "").replace(/"/g, "%22")}")`, backgroundSize: "cover", backgroundPosition: "center" }} />
                <span style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                  <b style={{ fontSize: 13.5, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{v.title}</b>
                  <span className="cs" style={{ margin: 0, fontSize: 12 }}>{fmtDate(v.publishedAt)}</span>
                </span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Owned-platform recordings (Cloudflare) — only when there are any. */}
      {vods.length > 0 && (
        <div className="card">
          <h3>Owned broadcasts</h3>
          <p className="cs">Recordings of shows you broadcast from the studio/phone — saved on your own player.</p>
          <div className="tbwrap" style={{ marginTop: 12 }}><table>
            <thead><tr><th>Recording</th><th>Status</th><th /></tr></thead>
            <tbody>
              {vods.map((uid) => (
                <tr key={uid}>
                  <td><b>{uid}</b><div className="muted">Cloudflare Stream recording</div></td>
                  <td><span className="pill ok">Ready</span></td>
                  <td><a className="btn sm" href={playbackUrl(uid)} target="_blank" rel="noreferrer">Open</a></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </Shell>
  );
}
