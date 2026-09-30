"use client";

import Link from "next/link";
import { useLiveStatus } from "@/components/hayes/useLiveStatus";

// The on-air/off-air headline + destination dots on the Live page. Reactive:
// polls the Cloudflare live status so it flips to "on air" the moment the Studio
// goes live, without a refresh.
export default function LiveHeadline({
  initialLive, siteName, showLabel, onAir, offAir, channelId, watchLabel, callLabel, pastLabel,
}: {
  initialLive: boolean; siteName: string; showLabel: string; onAir: string; offAir: string;
  channelId: string; watchLabel: string; callLabel: string; pastLabel: string;
}) {
  const live = useLiveStatus(initialLive);
  return (
    <>
      <div className="lhead">
        <div>
          <p className="lshow">{siteName} {showLabel}</p>
          <h1>{live ? onAir : offAir}</h1>
        </div>
        <div className="lacts">
          <a className="pill sm" href={`https://www.youtube.com/channel/${channelId}/live`} target="_blank" rel="noopener noreferrer">{watchLabel}</a>
          <Link className="pill sm soft" href="/contact">{callLabel}</Link>
          <Link className="pill sm soft" href="/library">{pastLabel}</Link>
        </div>
      </div>

      <div className="ldests">
        <span className={`dst${live ? "" : " off"}`}>
          <i />
          <span className="mark xs" aria-label={siteName} />
          This site
        </span>
        <span className={`dst${live ? "" : " off"}`}>
          <i />
          <span className="pmark yt" aria-label="YouTube">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.5 15.6V8.4l6.3 3.6-6.3 3.6z" /></svg>
          </span>
          YouTube
        </span>
      </div>
    </>
  );
}
