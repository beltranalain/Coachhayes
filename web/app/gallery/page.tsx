// Phase 0 — Component Gallery
// Renders the Coach Hayes Football design system in BOTH themes, driven by data
// (no hardcoded one-off markup: every card/badge/tile below maps a data array).
// This is the Phase 0 "done when": every core element from the templates,
// in light and dark, prop-driven. Source of truth: templates/hayes-site-demo.html.

type Tier = { cls: string; label: string };
const TIERS: Tier[] = [
  { cls: "coach", label: "Coach" },
  { cls: "coord", label: "Coordinator" },
  { cls: "timmy", label: "Po’ Lil Timmy" },
  { cls: "mod", label: "Moderator" },
];

const BUTTONS = [
  { cls: "pill", label: "Watch live" },
  { cls: "pill dark", label: "Join" },
  { cls: "pill soft", label: "Learn more" },
  { cls: "pill sm", label: "Small" },
];

const STATS = [
  { n: "5", label: "Shows every week" },
  { n: "340", label: "Players graded" },
  { n: "1,240", label: "In the community" },
  { n: "86", label: "Fantasy managers" },
];

const TOKENS = [
  { name: "--app", note: "page background" },
  { name: "--card", note: "card surface" },
  { name: "--ink", note: "primary text" },
  { name: "--sub", note: "secondary text" },
  { name: "--acc", note: "accent (blue light / gold dark)" },
  { name: "--green", note: "success / online" },
  { name: "--live", note: "on-air red" },
  { name: "--amber", note: "warning / Timmy tier" },
];

const SHOWS = [
  { title: "Canes Talk Live", by: "Coach Hayes", cat: "Live\nTalk", art: "a2" },
  { title: "Hayes St.", by: "Coach Hayes", cat: "Film\nRoom", art: "a1" },
  { title: "Prime Time", by: "Coach Hayes", cat: "Recruit\nWatch", art: "a3" },
  { title: "Knight Life", by: "Coach Hayes", cat: "UCF\nWeekly", art: "a4" },
];

const CHAT = [
  { name: "Coach Hayes", host: true, src: "", text: "Third-and-six is the rep that tells you if this line is ready." },
  { name: "Brother J", host: false, src: "YT", text: "the tackle never passed him off either" },
  { name: "ellenvee", host: false, src: "", text: "run it back at half speed tonight" },
];

function Showcase() {
  return (
    <div className="wide" style={{ paddingTop: 28, paddingBottom: 40 }}>
      {/* Tokens */}
      <h3 style={{ marginBottom: 16 }}>Color tokens</h3>
      <div className="g4" style={{ marginBottom: 40 }}>
        {TOKENS.map((t) => (
          <div key={t.name} className="card" style={{ padding: 16 }}>
            <div style={{ height: 44, borderRadius: 12, background: `var(${t.name})`, border: "1px solid var(--hair)", marginBottom: 10 }} />
            <b style={{ fontFamily: "var(--fdisp)", fontSize: 14 }}>{t.name}</b>
            <div style={{ color: "var(--sub)", fontSize: 12.5, marginTop: 2 }}>{t.note}</div>
          </div>
        ))}
      </div>

      {/* Typography */}
      <h3 style={{ marginBottom: 16 }}>Typography</h3>
      <div className="card" style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: 46 }}>Football, read the way a coach reads it.</h1>
        <h2 style={{ fontSize: 30, marginTop: 14 }}>Section heading</h2>
        <p style={{ color: "var(--sub)", marginTop: 12, fontSize: 18 }}>
          Body copy in the body typeface. Five shows a week, a fantasy league, a locker room,
          and film that actually explains the game.
        </p>
      </div>

      {/* Buttons */}
      <h3 style={{ marginBottom: 16 }}>Buttons &amp; pills</h3>
      <div className="card" style={{ marginBottom: 40, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
        {BUTTONS.map((b) => (
          <button key={b.label} className={b.cls}>{b.label}</button>
        ))}
        <a className="link">Text link</a>
      </div>

      {/* Membership tier badges */}
      <h3 style={{ marginBottom: 16 }}>Membership &amp; role badges</h3>
      <div className="card" style={{ marginBottom: 40, display: "flex", gap: 12, flexWrap: "wrap" }}>
        {TIERS.map((t) => (
          <span key={t.cls} className={`badge ${t.cls}`}>{t.label}</span>
        ))}
        <span className="tagp">Tag pill</span>
        <span className="chip">Chip</span>
      </div>

      {/* Stats */}
      <h3 style={{ marginBottom: 16 }}>Stat row</h3>
      <div className="card" style={{ marginBottom: 40 }}>
        <div className="stats" style={{ padding: 0 }}>
          {STATS.map((s) => (
            <div key={s.label} className="stat">
              <b>{s.n}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Live stage */}
      <h3 style={{ marginBottom: 16 }}>Live stage</h3>
      <div className="stage" style={{ marginBottom: 40 }}>
        <span className="lv"><i />Live now · 2,418 watching</span>
        <button className="play" aria-label="Watch">
          <svg width="22" height="25" viewBox="0 0 13 15" fill="currentColor"><path d="M0 0l13 7.5L0 15z" /></svg>
        </button>
        <div className="scap">
          <b>Miami vs Stanford: the good, the bad and the ugly</b>
          <span>Canes Talk Live · also on YouTube and Facebook</span>
        </div>
      </div>

      {/* Show cards */}
      <h3 style={{ marginBottom: 16 }}>Show cards</h3>
      <div className="g4" style={{ marginBottom: 40 }}>
        {SHOWS.map((s) => (
          <div key={s.title} className={`cat art ${s.art}`} style={{ minHeight: 200, borderRadius: 16, display: "flex", alignItems: "flex-end", padding: 16 }}>
            <span className="cl" style={{ whiteSpace: "pre-line" }}>{s.cat}</span>
          </div>
        ))}
      </div>

      {/* Chat */}
      <h3 style={{ marginBottom: 16 }}>Live chat</h3>
      <div className="card" style={{ marginBottom: 20, maxWidth: 380 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          {CHAT.map((m, i) => (
            <div key={i} className={`msg${m.host ? " is-host" : ""}`}>
              {m.src && <span className="src">{m.src}</span>}
              <b>{m.name}</b>{m.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function GalleryPage() {
  return (
    <>
      {/* Light theme panel */}
      <div className="hz" data-theme="light">
        <div className="wide" style={{ paddingTop: 34 }}>
          <span className="tagp">Phase 0 · Design system</span>
          <h1 style={{ fontSize: 40, margin: "12px 0 6px" }}>Component gallery — Light</h1>
          <p style={{ color: "var(--sub)" }}>Every core element from the approved templates, driven by data.</p>
        </div>
        <Showcase />
      </div>

      {/* Dark theme panel */}
      <div className="hz" data-theme="dark" style={{ minHeight: "100vh" }}>
        <div className="wide" style={{ paddingTop: 34 }}>
          <span className="tagp">Phase 0 · Design system</span>
          <h1 style={{ fontSize: 40, margin: "12px 0 6px" }}>Component gallery — Dark</h1>
          <p style={{ color: "var(--sub)" }}>Same components, dark theme — gold accent, Plus Jakarta Sans.</p>
        </div>
        <Showcase />
      </div>
    </>
  );
}
