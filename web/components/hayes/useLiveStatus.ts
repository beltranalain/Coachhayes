"use client";

import { useEffect, useState } from "react";

// Polls the Cloudflare live-input status (the signal the Studio actually drives
// when you go live) every 5s, so public pages flip to "live" automatically —
// no refresh needed. `initial` seeds from the server so there's no flash.
export function useLiveStatus(initial = false): boolean {
  const [live, setLive] = useState(initial);
  useEffect(() => {
    let stop = false;
    const check = async () => {
      try {
        const r = await fetch("/api/stream/status", { cache: "no-store" });
        const d = await r.json();
        if (!stop) setLive(Boolean(d.live));
      } catch { /* keep last known state */ }
    };
    check();
    const id = setInterval(check, 5000);
    return () => { stop = true; clearInterval(id); };
  }, []);
  return live;
}
