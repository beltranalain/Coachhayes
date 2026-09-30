import type { Metadata } from "next";
import Link from "next/link";
import { getHayesContent } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Community",
  description: "The Locker Room — talk football with people who actually watch the tape.",
};

// All copy comes from content.community (admin-editable). The feed itself is
// wired to posts/rooms in Phase 3; an honest empty state shows until then.
export default async function CommunityPage() {
  const { community: c } = await getHayesContent();
  return (
    <div className="wide" style={{ paddingTop: 26, paddingBottom: 40 }}>
      <div className="feedwrap">
        {/* LEFT RAIL */}
        <aside className="lrail">
          <nav className="fnav">
            {c.nav.map((n, i) => (
              <a key={n.key} className={i === 0 ? "on" : undefined} href={n.key === "profile" ? "/membership" : "#"}>
                <span className="i" />
                {n.label}
                {n.lock && <span className="lk">{n.lock}</span>}
              </a>
            ))}
          </nav>
          <Link className="pill" href="/account" style={{ width: "100%", marginTop: 14 }}>{c.signInCta}</Link>
        </aside>

        {/* FEED */}
        <div className="feed">
          <div className="composer">
            <span className="dv a4" />
            <div className="cbody">
              <input placeholder={c.composerPlaceholder} disabled />
              <div className="ctools">
                <button className="ct" disabled>Photo</button>
                <button className="ct" disabled>Clip</button>
                <button className="ct" disabled>Poll</button>
                <Link className="pill sm" href="/account" style={{ marginLeft: "auto" }}>Join</Link>
              </div>
            </div>
          </div>

          <div className="card" style={{ textAlign: "center", padding: "48px 30px" }}>
            <h3 style={{ marginBottom: 8 }}>{c.emptyTitle}</h3>
            <p style={{ color: "var(--sub)", maxWidth: "44ch", margin: "0 auto" }}>{c.emptyText}</p>
            <Link className="pill" href="/membership" style={{ marginTop: 18 }}>{c.emptyCta}</Link>
          </div>
        </div>

        {/* RIGHT RAIL */}
        <aside className="rrail">
          <div className="rcard">
            <h4>{c.watchTitle}</h4>
            <p style={{ color: "var(--sub)", fontSize: 13.5, margin: "6px 0 12px" }}>{c.watchText}</p>
            <Link className="pill sm soft" href="/live">{c.watchCta}</Link>
          </div>
          <div className="rcard">
            <h4>{c.roomsTitle}</h4>
            <p style={{ color: "var(--sub)", fontSize: 13.5, marginTop: 6 }}>{c.roomsText}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
