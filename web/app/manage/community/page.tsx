"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/hayes/admin/Shell";

// Feed & roles — the Locker Room community feed (posts, rooms, roles,
// moderation) is a later phase and isn't live yet. Honest placeholder only:
// no fake members, posts, reports, or roles.
export default function CommunityAdmin() {
  const [brand, setBrand] = useState({ name: "Coach Hayes Football", logo: "" });

  useEffect(() => {
    fetch("/api/site-config", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      if (d?.branding) setBrand({ name: d.branding.siteName || "Coach Hayes Football", logo: d.branding.logo || "" });
    }).catch(() => {});
  }, []);

  return (
    <Shell title="Feed & roles" sub="The Locker Room community feed" brandName={brand.name} logo={brand.logo}>
      <div className="row2">
        <div className="stack">
          <div className="card">
            <h3>Community feed</h3>
            <p className="cs">The Locker Room is your community feed — posts, rooms, roles and moderation, all in one place.</p>
            <div className="note" style={{ margin: "6px 0 0" }}>
              The Locker Room community feed isn&rsquo;t live yet. Posts, rooms, roles and moderation are on the roadmap for a later phase — nothing here is real until it ships.
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h3>Public page</h3>
            <p className="cs">See what fans see today while the full feed is being built.</p>
            <Link href="/community" target="_blank" className="btn sm" style={{ display: "inline-flex" }}>View the public Community page</Link>
          </div>
        </div>
      </div>
    </Shell>
  );
}
