"use client";

import { useEffect, useState } from "react";

export type LiveNow = { live: boolean; source: "youtube" | "cloudflare" | "off"; videoId: string | null; viewers: number | null };

// Polls the combined live status (the coach's YouTube stream OR the Cloudflare
// studio) every 8s, so public pages flip to "live" automatically — no refresh.
// `initial` seeds from the server so there's no flash.
export function useLiveNow(initial = false): LiveNow {
  const [state, setState] = useState<LiveNow>({ live: initial, source: initial ? "youtube" : "off", videoId: null, viewers: null });
  useEffect(() => {
    let stop = false;
    const check = async () => {
      try {
        const r = await fetch("/api/live/status", { cache: "no-store" });
        const d = await r.json();
        if (!stop) setState({ live: Boolean(d.live), source: d.source || "off", videoId: d.videoId ?? null, viewers: d.viewers ?? null });
      } catch { /* keep last known state */ }
    };
    check();
    const id = setInterval(check, 8000);
    return () => { stop = true; clearInterval(id); };
  }, []);
  return state;
}

// Boolean convenience wrapper (back-compat for callers that only need on/off).
export function useLiveStatus(initial = false): boolean {
  return useLiveNow(initial).live;
}
