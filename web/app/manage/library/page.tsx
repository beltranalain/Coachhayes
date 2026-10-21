"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Shell from "@/components/hayes/admin/Shell";
import { getIdToken } from "@/lib/firebase";

// Library — the coach's full YouTube catalog, paged on demand ("load more") and
// filterable by Video / Short / Live replay. Auto-pulled from his channel's
// uploads, so new videos appear on their own. Any owned-platform recordings
// (Cloudflare Stream) show as a secondary section.
const CF_CODE = process.env.NEXT_PUBLIC_CF_STREAM_CUSTOMER_CODE || "";
const playbackUrl = (uid: string) =>
  CF_CODE ? `https://customer-${CF_CODE}.cloudflarestream.com/${uid}/iframe` : `https://iframe.videodelivery.net/${uid}`;

type Kind = "short" | "video" | "live";
type YtVideo = { id: string; title: string; publishedAt: string; thumbnail: string; durationSec?: number; kind?: Kind };
const fmtDate = (s: string) => { try { return new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); } catch { return ""; } };
const fmtDur = (sec?: number) => { if (!sec) return ""; const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`; };

const FILTERS: { key: "all" | Kind; label: string }[] = [
  { key: "all", label: "All" },
  { key: "video", label: "Videos" },
  { key: "short", label: "Shorts" },
  { key: "live", label: "Live replays" },
];

export default function LibraryPage() {
  const [brand, setBrand] = useState({ name: "Coach Hayes Football", logo: "" });
  const [items, setItems] = useState<YtVideo[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [ytConfigured, setYtConfigured] = useState(true);
  const [vods, setVods] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | Kind>("all");

  const loadPage = useCallback(async (pageToken?: string) => {
    const r = await fetch(`/api/youtube?type=uploads&paged=1${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`, { cache: "no-store" });
    const d = await r.json();
    setYtConfigured(d?.configured !== false);
    const next = (Array.isArray(d?.items) ? d.items : []).filter((v: YtVideo) => v.id);
    setItems((prev) => (pageToken ? [...prev, ...next] : next));
    setToken(d?.nextPageToken ?? null);
  }, []);

  useEffect(() => {
    fetch("/api/site-config", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (d?.branding) setBrand({ name: d.branding.siteName || "Coach Hayes Football", logo: d.branding.logo || "" }); }).catch(() => {});
    loadPage().catch(() => setYtConfigured(false)).finally(() => setLoading(false));
    (async () => {
      try {
        const t = await getIdToken();
        const r = await fetch("/api/stream/vod", { headers: t ? { Authorization: `Bearer ${t}` } : {}, cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        setVods(Array.isArray(d.videos) ? d.videos.filter((v: unknown): v is string => typeof v === "string" && !!v) : []);
      } catch { /* none */ }
    })();
  }, [loadPage]);

  async function loadMore() { setLoadingMore(true); try { if (token) await loadPage(token); } finally { setLoadingMore(false); } }

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((v) => (filter === "all" || (v.kind || "video") === filter) && (!s || v.title.toLowerCase().includes(s)));
  }, [items, q, filter]);

  const counts = useMemo(() => ({
    video: items.filter((v) => (v.kind || "video") === "video").length,
    short: items.filter((v) => v.kind === "short").length,
    live: items.filter((v) => v.kind === "live").length,
  }), [items]);

  return (
    <Shell title="Library" sub={items.length ? `${items.length} loaded from YouTube${vods.length ? ` · ${vods.length} recording${vods.length === 1 ? "" : "s"}` : ""}` : "Your channel catalog, in one place"} brandName={brand.name} logo={brand.logo}>
      <div className="card">
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
          <div><h3>YouTube library</h3><p className="cs" style={{ margin: 0 }}>Pulled straight from your channel — new uploads show up here automatically.</p></div>
          {items.length > 0 && (
            <div className="fld" style={{ marginLeft: "auto", marginBottom: 0, minWidth: 220 }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your videos" />
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="chips" style={{ marginBottom: 16 }}>
            {FILTERS.map((f) => (
              <button key={f.key} type="button" className={`chipf${filter === f.key ? " on" : ""}`} onClick={() => setFilter(f.key)}>
                {f.label}{f.key !== "all" ? ` · ${counts[f.key]}` : ""}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="note" style={{ margin: 0 }}>Loading your library…</div>
        ) : !ytConfigured ? (
          <div className="note" style={{ margin: 0, borderLeftColor: "var(--amber)" }}>
            <b>YouTube isn’t connected.</b> Add YOUTUBE_API_KEY on the server to pull your channel’s videos in here.
          </div>
        ) : items.length === 0 ? (
          <div className="note" style={{ margin: 0 }}>No videos found on the channel yet.</div>
        ) : shown.length === 0 ? (
          <div className="note" style={{ margin: 0 }}>No videos match{q ? ` “${q}”` : " this filter"}.</div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
              {shown.map((v) => (
                <a key={v.id} href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", border: "1px solid var(--hair)", borderRadius: 12, overflow: "hidden", background: "var(--alt)" }}>
                  <span style={{ position: "relative", aspectRatio: "16/9", backgroundColor: "var(--card)", backgroundImage: `url("${(v.thumbnail || "").replace(/"/g, "%22")}")`, backgroundSize: "cover", backgroundPosition: "center" }}>
                    {v.kind === "live" && <span style={{ position: "absolute", top: 7, left: 7, background: "var(--live)", color: "#fff", fontSize: 10, fontWeight: 800, letterSpacing: 0.4, padding: "2px 6px", borderRadius: 5 }}>LIVE</span>}
                    {v.kind === "short" && <span style={{ position: "absolute", top: 7, left: 7, background: "rgba(0,0,0,.72)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 5 }}>SHORT</span>}
                    {v.durationSec ? <span style={{ position: "absolute", bottom: 7, right: 7, background: "rgba(0,0,0,.78)", color: "#fff", fontSize: 11, fontWeight: 600, padding: "1px 6px", borderRadius: 5 }}>{fmtDur(v.durationSec)}</span> : null}
                  </span>
                  <span style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                    <b style={{ fontSize: 13.5, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{v.title}</b>
                    <span className="cs" style={{ margin: 0, fontSize: 12 }}>{fmtDate(v.publishedAt)}</span>
                  </span>
                </a>
              ))}
            </div>
            {token && (
              <div style={{ textAlign: "center", marginTop: 18 }}>
                <button type="button" className="btn" onClick={loadMore} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more"}</button>
              </div>
            )}
          </>
        )}
      </div>

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
