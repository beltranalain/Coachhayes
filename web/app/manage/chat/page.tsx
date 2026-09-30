"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/hayes/admin/Shell";

// Chat — live chat only exists during a broadcast and is moderated inside the
// Studio's Chat tab. There is no standalone chat-history API, so this page is an
// honest explainer + relay-connection status. No fake messages or rules.
export default function ChatAdmin() {
  const [brand, setBrand] = useState({ name: "Coach Hayes Football", logo: "" });
  const wsConfigured = Boolean(process.env.NEXT_PUBLIC_CHAT_WS_URL);

  useEffect(() => {
    fetch("/api/site-config", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      if (d?.branding) setBrand({ name: d.branding.siteName || "Coach Hayes Football", logo: d.branding.logo || "" });
    }).catch(() => {});
  }, []);

  return (
    <Shell title="Chat" sub="Live chat is moderated inside the Studio" brandName={brand.name} logo={brand.logo}>
      <div className="row2">
        <div className="stack">
          <div className="card">
            <h3>Live chat</h3>
            <p className="cs">During a broadcast, chat from your site, YouTube, Twitch and Facebook merges into one queue. You moderate all of it from the <b>Chat</b> tab inside the Studio — acting there applies everywhere you have permission.</p>
            <div className="note" style={{ margin: "6px 0 0" }}>
              No live chat right now. Chat appears here when you&rsquo;re broadcasting.
            </div>
            <Link href="/manage/studio" className="btn acc" style={{ marginTop: 14, display: "inline-flex" }}>Open the studio</Link>
            {!wsConfigured ? (
              <div className="note" style={{ marginTop: 14, borderLeftColor: "var(--amber)" }}>
                <b>Chat backend not connected.</b> Set <code>NEXT_PUBLIC_CHAT_WS_URL</code> (the relay) to enable live chat.
              </div>
            ) : (
              <div className="note" style={{ marginTop: 14, borderLeftColor: "var(--green)" }}>
                <b>Chat relay connected.</b> Live chat is ready — it turns on automatically when you go live.
              </div>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h3>How moderation works</h3>
            <p className="cs">Everything happens live, in the Studio&rsquo;s Chat tab, while you&rsquo;re broadcasting.</p>
            <ol className="cs" style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8, lineHeight: 1.5 }}>
              <li><b>Timeout</b> a chatter to briefly stop them from posting.</li>
              <li><b>Remove</b> a message so it disappears for everyone watching.</li>
              <li><b>Pin</b> a message to feature it on the watch page and in the apps.</li>
              <li>Actions apply across every connected platform at once, wherever you have permission.</li>
            </ol>
          </div>
        </div>
      </div>
    </Shell>
  );
}
