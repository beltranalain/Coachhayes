"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/hayes/admin/Shell";

// Guests — the invite + green-room entry point. The LIVE roster (bring on /
// backstage / remove) is managed in the Studio during a broadcast; this page
// owns the invite link and settings. No fake roster is shown.
const ROOM = "main";

export default function GuestsAdmin() {
  const [brand, setBrand] = useState({ name: "Coach Hayes Football", logo: "", domain: "" });
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    fetch("/api/site-config", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      if (d?.branding) setBrand({ name: d.branding.siteName || "Coach Hayes Football", logo: d.branding.logo || "", domain: d.branding.domain || "" });
    }).catch(() => {});
  }, []);

  const base = brand.domain ? `https://${brand.domain.replace(/^https?:\/\//, "")}` : origin;
  const inviteUrl = `${base}/join/${ROOM}`;
  const wsConfigured = Boolean(process.env.NEXT_PUBLIC_CHAT_WS_URL);
  function copy() { navigator.clipboard?.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }

  return (
    <Shell title="Guests" sub="Invite guests and run the green room" brandName={brand.name} logo={brand.logo}>
      <div className="row2">
        <div className="stack">
          <div className="card">
            <h3>Green room</h3>
            <p className="cs">Guests appear here the moment they open the invite link — no one is in the room until then.</p>
            <div className="note" style={{ margin: "6px 0 0" }}>
              No guests in the room yet. Share the invite link and open the <b>Studio</b> — everyone who joins shows up live there, where you bring them on stage, send them backstage, mute, or remove.
            </div>
            <Link href="/admin/studio" className="btn acc" style={{ marginTop: 14, display: "inline-flex" }}>Open the studio</Link>
            {!wsConfigured && (
              <div className="note" style={{ marginTop: 14, borderLeftColor: "var(--amber)" }}>
                <b>Green-room backend not connected.</b> Set <code>NEXT_PUBLIC_CHAT_WS_URL</code> (the relay) so guests can join from the link.
              </div>
            )}
          </div>

          <div className="card">
            <h3>How it works</h3>
            <ol className="cs" style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8, lineHeight: 1.5 }}>
              <li>Send the invite link to a guest — they join in their browser, nothing to install.</li>
              <li>They land <b>backstage</b> (in the room, not in the shot — no CPU/bandwidth cost).</li>
              <li>In the Studio you <b>bring them on stage</b> when it’s their turn. Stage limit is 6.</li>
              <li>Mute, move backstage, or remove anyone at any time.</li>
            </ol>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h3>Invite link</h3>
            <p className="cs">Guests join in a browser. Nothing to install, no account needed.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input readOnly value={inviteUrl} style={{ flex: 1, background: "var(--soft)", border: "1px solid var(--hair)", borderRadius: 10, padding: "9px 12px", fontSize: 13, color: "var(--ink)" }} />
              <button className="btn sm" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
