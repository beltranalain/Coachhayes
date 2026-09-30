"use client";

import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/hayes/admin/Shell";
import { getIdToken } from "@/lib/firebase";

// Library — real past broadcasts (VODs) from Cloudflare Stream via
// /api/stream/vod. That endpoint returns an array of ready recording UIDs
// ({ videos: string[] }); it does NOT return titles/durations, so we only
// render what's real — the recording and a real playback link — and never
// invent metadata. No hardcoded sample episodes.
const CF_CODE = process.env.NEXT_PUBLIC_CF_STREAM_CUSTOMER_CODE || "";
const playbackUrl = (uid: string) =>
  CF_CODE
    ? `https://customer-${CF_CODE}.cloudflarestream.com/${uid}/iframe`
    : `https://iframe.videodelivery.net/${uid}`;

export default function LibraryPage() {
  const [brand, setBrand] = useState({ name: "Coach Hayes Football", logo: "" });
  const [videos, setVideos] = useState<string[]>([]);
  const [ok, setOk] = useState(true);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/site-config", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (d?.branding) setBrand({ name: d.branding.siteName || "Coach Hayes Football", logo: d.branding.logo || "" }); }).catch(() => {});
    (async () => {
      try {
        const t = await getIdToken();
        const r = await fetch("/api/stream/vod", { headers: t ? { Authorization: `Bearer ${t}` } : {}, cache: "no-store" });
        if (!r.ok) { setOk(false); return; }
        const d = await r.json();
        setVideos(Array.isArray(d.videos) ? d.videos.filter((v: unknown): v is string => typeof v === "string" && !!v) : []);
      } catch { setOk(false); } finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return videos;
    return videos.filter((uid) => uid.toLowerCase().includes(s));
  }, [videos, q]);

  return (
    <Shell title="Library" sub={videos.length ? `${videos.length} recording${videos.length === 1 ? "" : "s"} saved` : "Past broadcasts land here"} brandName={brand.name} logo={brand.logo}>
      <div className="card">
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
          <div><h3>Library</h3><p className="cs" style={{ margin: 0 }}>Every broadcast files itself here when it ends.</p></div>
          {videos.length > 0 && (
            <div className="fld" style={{ marginLeft: "auto", marginBottom: 0, minWidth: 220 }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search recordings" />
            </div>
          )}
        </div>

        {loading ? (
          <div className="note" style={{ margin: 0 }}>Loading…</div>
        ) : !ok ? (
          <div className="note" style={{ margin: 0, borderLeftColor: "var(--amber)" }}>
            <b>Recordings aren’t available.</b> Connect Cloudflare Stream on the server so past broadcasts are saved and listed here.
          </div>
        ) : videos.length === 0 ? (
          <div className="note" style={{ margin: 0 }}>No recordings yet. Past broadcasts are saved here automatically after you go live.</div>
        ) : filtered.length === 0 ? (
          <div className="note" style={{ margin: 0 }}>No recordings match “{q}”.</div>
        ) : (
          <div className="tbwrap"><table>
            <thead><tr><th>Recording</th><th>Status</th><th /></tr></thead>
            <tbody>
              {filtered.map((uid) => (
                <tr key={uid}>
                  <td><b>{uid}</b><div className="muted">Cloudflare Stream recording</div></td>
                  <td><span className="pill ok">Ready</span></td>
                  <td><a className="btn sm" href={playbackUrl(uid)} target="_blank" rel="noreferrer">Open</a></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </Shell>
  );
}
