import { ImageResponse } from "next/og";
import { getPlayerBySlug, CHIP_META } from "@/lib/rankings";
import { getSiteConfig } from "@/lib/siteConfig";

export const runtime = "nodejs";
export const alt = "Player recruiting card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Dynamic share card for each player page — chip color, name, position, school,
// class year, and the grade. Rendered on the fly by next/og.
export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [p, { branding }] = await Promise.all([getPlayerBySlug(slug), getSiteConfig()]);
  const site = branding.siteName || "Coach Hayes Football";
  const ring = p ? CHIP_META[p.chip].ring : "#2D6BFF";
  const chipLabel = p ? CHIP_META[p.chip].label : "";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0B0D10", color: "#fff", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 26, letterSpacing: 2, textTransform: "uppercase", color: "#9AA4B2", fontWeight: 700 }}>{site} · Rankings</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, background: "rgba(255,255,255,.06)", border: `2px solid ${ring}`, borderRadius: 999, padding: "12px 24px" }}>
            <div style={{ width: 26, height: 26, borderRadius: 999, background: ring }} />
            <div style={{ fontSize: 30, fontWeight: 800 }}>{chipLabel}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 96, fontWeight: 800, lineHeight: 1.02, letterSpacing: -3 }}>{p ? p.name : "Player"}</div>
          <div style={{ fontSize: 40, color: "#C7CFDA", marginTop: 16 }}>
            {p ? `${p.position} · ${p.school}${p.state ? `, ${p.state}` : ""} · Class of ${p.classYear}` : ""}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: ring }} />
          <div style={{ fontSize: 28, color: "#9AA4B2" }}>Graded on film — {chipLabel} prospect</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
