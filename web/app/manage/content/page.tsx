"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/hayes/admin/Shell";
import { getIdToken } from "@/lib/firebase";
import type { HayesContent, Stat, Tile } from "@/lib/hayesContent";

type SectionKey = keyof HayesContent;
const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "live", label: "Live" },
  { key: "membership", label: "Membership" },
  { key: "rankings", label: "Rankings" },
  { key: "fantasy", label: "Fantasy" },
  { key: "community", label: "Community" },
  { key: "shop", label: "Shop" },
  { key: "footer", label: "Footer" },
];

export default function ContentEditor() {
  const [content, setContent] = useState<HayesContent | null>(null);
  const [section, setSection] = useState<SectionKey>("home");
  const [status, setStatus] = useState<string>("");
  const [brandName, setBrandName] = useState("Coach Hayes Football");
  const [logo, setLogo] = useState("");

  useEffect(() => {
    fetch("/api/hayes-content", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setContent(d.content))
      .catch(() => setStatus("Could not load content."));
    fetch("/api/site-config", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d?.branding?.siteName) setBrandName(d.branding.siteName); if (d?.branding?.logo) setLogo(d.branding.logo); })
      .catch(() => {});
  }, []);

  // Update a field within the current section.
  function patch(part: object) {
    setContent((c) => (c ? { ...c, [section]: { ...(c[section] as object), ...part } } : c));
  }

  async function save() {
    if (!content) return;
    setStatus("Saving…");
    try {
      const token = await getIdToken();
      const res = await fetch("/api/hayes-content", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ section, data: content[section] }),
      });
      const d = await res.json();
      if (d.saved) setStatus("Saved — live on the site.");
      else if (d.demo) setStatus("Preview only (Firebase not connected).");
      else setStatus(d.error || "Save failed.");
    } catch {
      setStatus("Save failed.");
    }
    setTimeout(() => setStatus(""), 4000);
  }

  return (
    <Shell title="Website content" sub="Edit the public site — changes save to your database and go live." brandName={brandName} logo={logo}>
      {!content ? (
        <p style={{ color: "var(--sub)" }}>Loading…</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "170px minmax(0,1fr)", gap: 22, alignItems: "start" }}>
          {/* Section switcher */}
          <div className="card" style={{ padding: 10 }}>
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={section === s.key ? "on" : undefined}
                style={{
                  display: "block", width: "100%", textAlign: "left", padding: "9px 11px", borderRadius: 8,
                  fontSize: 13.8, marginBottom: 2, fontWeight: section === s.key ? 600 : 400,
                  background: section === s.key ? "var(--acc)" : "transparent",
                  color: section === s.key ? "var(--accInk)" : "var(--ink)",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Editor */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {section === "home" && <HomeEditor content={content.home} patch={patch} />}
            {section === "membership" && <MembershipEditor content={content.membership} patch={patch} />}
            {section !== "home" && section !== "membership" && (
              <GenericEditor obj={content[section] as Record<string, unknown>} patch={patch} />
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 4 }}>
              <button className="btn" style={{ background: "var(--acc)", color: "var(--accInk)", padding: "11px 22px", borderRadius: 10, fontWeight: 600 }} onClick={save}>
                Save {SECTIONS.find((s) => s.key === section)?.label}
              </button>
              {status && <span style={{ fontSize: 13, color: status.includes("failed") || status.includes("not") ? "var(--live)" : "var(--green)" }}>{status}</span>}
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

// ---- Reusable field controls -------------------------------------------------
function Field({ label, value, onChange, area }: { label: string; value: string; onChange: (v: string) => void; area?: boolean }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span style={{ display: "block", fontSize: 12, color: "var(--sub)", marginBottom: 6, fontWeight: 600 }}>{label}</span>
      {area ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} style={inputStyle} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
      )}
    </label>
  );
}
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid var(--hair)",
  background: "var(--soft)", color: "var(--ink)", fontSize: 14,
};
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: 15, marginBottom: 14 }}>{title}</h3>
      {children}
    </div>
  );
}

// ---- Home editor -------------------------------------------------------------
function HomeEditor({ content: h, patch }: { content: HayesContent["home"]; patch: (p: object) => void }) {
  const setStat = (i: number, part: Partial<Stat>) => patch({ stats: h.stats.map((s, j) => (j === i ? { ...s, ...part } : s)) });
  const setTile = (i: number, part: Partial<Tile>) => patch({ tiles: h.tiles.map((t, j) => (j === i ? { ...t, ...part } : t)) });
  return (
    <>
      <Card title="Hero">
        <Field label="Tagline (under the headline)" value={h.heroTag} onChange={(v) => patch({ heroTag: v })} area />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Primary button" value={h.ctaPrimary} onChange={(v) => patch({ ctaPrimary: v })} />
          <Field label="Secondary link" value={h.ctaSecondary} onChange={(v) => patch({ ctaSecondary: v })} />
        </div>
        <Field label="Off-air placeholder title" value={h.comingSoonTitle} onChange={(v) => patch({ comingSoonTitle: v })} />
        <Field label="Stage subtitle" value={h.stageSub} onChange={(v) => patch({ stageSub: v })} />
      </Card>

      <Card title="Stats row">
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 13.5 }}>
          <input type="checkbox" checked={h.statsEnabled} onChange={(e) => patch({ statsEnabled: e.target.checked })} />
          Show the stats row
        </label>
        {h.stats.map((s, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10, marginBottom: 8 }}>
            <input value={s.value} onChange={(e) => setStat(i, { value: e.target.value })} placeholder="5" style={inputStyle} />
            <input value={s.label} onChange={(e) => setStat(i, { label: e.target.value })} placeholder="Shows a week" style={inputStyle} />
          </div>
        ))}
      </Card>

      <Card title="Feature tiles">
        {h.tiles.map((t, i) => (
          <div key={t.key} style={{ borderTop: i ? "1px solid var(--hair)" : "none", paddingTop: i ? 14 : 0, marginTop: i ? 14 : 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Kicker" value={t.kicker} onChange={(v) => setTile(i, { kicker: v })} />
              <Field label="Title" value={t.title} onChange={(v) => setTile(i, { title: v })} />
            </div>
            <Field label="Blurb" value={t.blurb} onChange={(v) => setTile(i, { blurb: v })} area />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Links to" value={t.href} onChange={(v) => setTile(i, { href: v })} />
              <Field label="Image URL (optional — overrides gradient)" value={t.image ?? ""} onChange={(v) => setTile(i, { image: v })} />
            </div>
          </div>
        ))}
      </Card>

      <Card title="Sections">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Tiles heading" value={h.tilesHeading} onChange={(v) => patch({ tilesHeading: v })} />
          <Field label="Week heading" value={h.weekHeading} onChange={(v) => patch({ weekHeading: v })} />
        </div>
        <Field label="Tiles intro" value={h.tilesIntro} onChange={(v) => patch({ tilesIntro: v })} area />
        <Field label="Week intro" value={h.weekIntro} onChange={(v) => patch({ weekIntro: v })} area />
      </Card>
    </>
  );
}

// ---- Membership editor (tiers) ----------------------------------------------
function MembershipEditor({ content: m, patch }: { content: HayesContent["membership"]; patch: (p: object) => void }) {
  const setTier = (i: number, part: object) => patch({ tiers: m.tiers.map((t, j) => (j === i ? { ...t, ...part } : t)) });
  return (
    <>
      <Card title="Heading">
        <Field label="Heading" value={m.heading} onChange={(v) => patch({ heading: v })} />
        <Field label="Intro" value={m.intro} onChange={(v) => patch({ intro: v })} area />
      </Card>
      {m.tiers.map((t, i) => (
        <Card title={`Tier: ${t.name}`} key={t.key}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Name" value={t.name} onChange={(v) => setTier(i, { name: v })} />
            <Field label="Who it's for" value={t.who} onChange={(v) => setTier(i, { who: v })} />
            <Field label="Price" value={t.price} onChange={(v) => setTier(i, { price: v })} />
            <Field label="Price suffix" value={t.priceSuffix} onChange={(v) => setTier(i, { priceSuffix: v })} />
          </div>
          <Field label="Fee line" value={t.feeline} onChange={(v) => setTier(i, { feeline: v })} />
          <Field label="Features (one per line)" value={t.features.join("\n")} onChange={(v) => setTier(i, { features: v.split("\n").filter(Boolean) })} area />
        </Card>
      ))}
    </>
  );
}

// ---- Generic editor (top-level string fields of a section) ------------------
function GenericEditor({ obj, patch }: { obj: Record<string, unknown>; patch: (p: object) => void }) {
  const strings = Object.entries(obj).filter(([, v]) => typeof v === "string") as [string, string][];
  const others = Object.entries(obj).filter(([, v]) => typeof v !== "string");
  return (
    <>
      <Card title="Text">
        {strings.map(([k, v]) => (
          <Field key={k} label={k} value={v} onChange={(nv) => patch({ [k]: nv })} area={v.length > 60} />
        ))}
      </Card>
      {others.length > 0 && (
        <div className="card" style={{ padding: 16, color: "var(--sub)", fontSize: 13 }}>
          Lists on this section ({others.map(([k]) => k).join(", ")}) get dedicated editors next — they still save
          from their approved defaults for now.
        </div>
      )}
    </>
  );
}
