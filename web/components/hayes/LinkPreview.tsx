"use client";

import { useEffect, useState } from "react";

type Preview = { url: string; host: string; site: string; title: string; image: string; description: string };

// Renders a thumbnail/link card for a URL (Open Graph), so the feed shows the
// site's preview instead of a raw www address. Fetched via /api/link-preview.
export default function LinkPreview({ url }: { url: string }) {
  const [p, setP] = useState<Preview | null>(null);
  const [dead, setDead] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, { cache: "force-cache" })
      .then((r) => r.json())
      .then((d) => { if (!alive) return; if (d?.error) setDead(true); else setP(d); })
      .catch(() => { if (alive) setDead(true); });
    return () => { alive = false; };
  }, [url]);

  if (dead) return null;
  const host = p?.site || hostOf(url);

  return (
    <a className="linkcard" href={url} target="_blank" rel="noreferrer noopener">
      {p?.image ? (
        <span className="linkcard-img" style={{ backgroundImage: `url("${p.image.replace(/"/g, "%22")}")` }} aria-hidden />
      ) : (
        <span className="linkcard-img linkcard-img-none" aria-hidden><span>{(host[0] || "·").toUpperCase()}</span></span>
      )}
      <span className="linkcard-body">
        <span className="linkcard-site">{host}</span>
        <b className="linkcard-title">{p ? (p.title || host) : "Loading preview…"}</b>
        {p?.description ? <span className="linkcard-desc">{p.description}</span> : null}
      </span>
    </a>
  );
}

function hostOf(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; }
}
