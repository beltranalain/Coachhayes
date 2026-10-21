"use client";

import { useEffect, useRef, useState } from "react";

// Polls the combined live status (/api/live/status) and shows whichever source
// is actually on air: the coach's YouTube live stream (his usual way) OR the
// native phone/studio broadcast on Cloudflare. The player mounts the moment a
// show goes live and swaps automatically — no reload. `cfSrc` is the Cloudflare
// iframe base (empty when Stream isn't configured).
type Status = { live: boolean; source: "youtube" | "cloudflare" | "off"; videoId: string | null };

export default function LivePlayer({ cfSrc, logo }: { cfSrc: string; logo?: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [key, setKey] = useState(0);
  const was = useRef(false);

  useEffect(() => {
    let stop = false;
    const check = async () => {
      try {
        const r = await fetch("/api/live/status", { cache: "no-store" });
        const d: Status = await r.json();
        if (stop) return;
        setStatus(d);
        if (d.live && !was.current) setKey((k) => k + 1); // fresh mount on going live
        was.current = d.live;
      } catch {
        /* keep last known state */
      }
    };
    check();
    const id = setInterval(check, 10000);
    return () => { stop = true; clearInterval(id); };
  }, []);

  const allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";

  if (status?.source === "youtube" && status.videoId) {
    return (
      <>
        <span className="badge"><i />Live</span>
        <iframe
          key={key}
          src={`https://www.youtube.com/embed/${status.videoId}?autoplay=1&rel=0&modestbranding=1`}
          title="Live on YouTube"
          allow={allow}
          allowFullScreen
        />
      </>
    );
  }

  if (status?.source === "cloudflare" && cfSrc) {
    const sep = cfSrc.includes("?") ? "&" : "?";
    return (
      <>
        <span className="badge"><i />Live</span>
        <iframe key={key} src={`${cfSrc}${sep}autoplay=true&muted=true`} title="Live" allow={allow} allowFullScreen />
      </>
    );
  }

  return (
    <div className="player-offair">
      <div className="offair-mark">
        {logo ? <img src={logo} alt="" /> : <span className="offair-dot" />}
      </div>
      {status === null ? (
        <span className="offair-check">One moment - getting the stream ready</span>
      ) : (
        <>
          <p>Off air</p>
          <span>The show streams here automatically the moment it goes live.</span>
        </>
      )}
    </div>
  );
}
