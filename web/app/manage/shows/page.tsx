"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/hayes/admin/Shell";
import type { Series } from "@/lib/siteData";

// Shows — the REAL editable series that appear across the public site. Read
// read-only from /api/site-config ({ content: { series: [...] } }); the actual
// editing lives in Settings → Content. No hardcoded sample shows.
export default function ShowsPage() {
  const [brand, setBrand] = useState({ name: "Coach Hayes Football", logo: "" });
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/site-config", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      if (d?.branding) setBrand({ name: d.branding.siteName || "Coach Hayes Football", logo: d.branding.logo || "" });
      const list = d?.content?.series;
      setSeries(Array.isArray(list) ? list : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const visibleCount = series.filter((s) => s.visible !== false).length;

  return (
    <Shell title="Shows" sub={series.length ? `${series.length} show${series.length === 1 ? "" : "s"} · ${visibleCount} visible` : "The slate that appears across your site"} brandName={brand.name} logo={brand.logo}>
      <div className="card">
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
          <div><h3>Shows</h3><p className="cs" style={{ margin: 0 }}>These are the series shown on the public site and the Shows page.</p></div>
          <Link href="/manage/settings" className="btn sm" style={{ marginLeft: "auto" }}>Edit in Settings</Link>
        </div>

        {loading ? (
          <div className="note" style={{ margin: 0 }}>Loading…</div>
        ) : series.length === 0 ? (
          <div className="note" style={{ margin: 0 }}>No shows yet. Shows appear on the public site and the Shows page once added.</div>
        ) : (
          <div className="tbwrap"><table>
            <thead><tr><th>Show</th><th>Category</th><th>Tag</th><th>Status</th></tr></thead>
            <tbody>
              {series.map((s, i) => (
                <tr key={s.key || i}>
                  <td><b>{s.title || "Untitled show"}</b>{s.blurb && <div className="muted">{s.blurb}</div>}</td>
                  <td className="muted">{(s.category || "").replace(/\n/g, " ") || "—"}</td>
                  <td className="muted">{s.tag || "—"}</td>
                  <td>{s.visible === false ? <span className="pill warn">Hidden</span> : <span className="pill ok">Visible</span>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}

        <div className="note" style={{ marginTop: 16 }}>
          Shows are edited in <b>Settings → Content</b> — add a series, change its title, category, artwork, or toggle whether it’s visible on the public site.
        </div>
      </div>
    </Shell>
  );
}
