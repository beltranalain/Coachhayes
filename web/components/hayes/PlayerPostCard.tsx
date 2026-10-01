import Link from "next/link";
import { CategoryIcon } from "@/components/hayes/CategoryChips";
import { CHIP_META, CATEGORIES, type Chip, type CategoryKey } from "@/lib/chips";

export type PlayerPost = {
  name: string;
  position?: string;
  classYear?: string;
  school?: string;
  commit?: string;
  commitLogo?: string;
  slug?: string;
  chip?: Chip;
  categories?: Partial<Record<CategoryKey, Chip>>;
  categoryNotes?: Partial<Record<CategoryKey, string>>;
};

// The "breakdown" card shown for auto-generated player posts in the community
// feed — mirrors the rankings player page so chips look identical everywhere.
export default function PlayerPostCard({ p }: { p: PlayerorNull }) {
  if (!p || !p.name) return null;
  const cats = p.categories || {};
  const set = CATEGORIES.filter((c) => cats[c.key]);
  const overall: Chip = p.chip || "bronze";
  const chip = CHIP_META[overall];
  const avg = set.length
    ? (set.reduce((s, c) => s + (CHIP_META[cats[c.key] as Chip]?.weight || 0), 0) / set.length).toFixed(1)
    : null;

  return (
    <div className="pbreak">
      <p className="rkkick" style={{ color: chip.ring }}>The breakdown</p>
      <h3 className="pbtitle">{p.name}{p.position ? ` — ${p.position}` : ""}{p.classYear ? `, class of ${p.classYear}` : ""}</h3>
      {p.school && <p className="pbmeta">{p.school}</p>}

      <div className="pbrows">
        {CATEGORIES.map((cat) => {
          const t = cats[cat.key] as Chip | undefined;
          const note = p.categoryNotes?.[cat.key];
          return (
            <div className="pbrow" key={cat.key}>
              <CategoryIcon category={cat.key} chip={t} size={40} />
              <div className="pbmain">
                <div className="pbhd"><b>{cat.label}</b>{t && <span style={{ color: CHIP_META[t].ring, fontWeight: 700, fontSize: 13 }}>{CHIP_META[t].label}</span>}</div>
                {note && <p className="pbnote">{note}</p>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pboverall">
        <span className="pbchip" style={{ background: chip.ring, boxShadow: `0 0 0 4px color-mix(in srgb, ${chip.ring} 35%, transparent)` }} />
        <div style={{ flex: 1 }}>
          <p className="rkkick" style={{ color: chip.ring, marginBottom: 2 }}>Overall ranking</p>
          <b style={{ fontSize: 22, letterSpacing: "-.02em" }}>{chip.label}</b>
          {avg && <span style={{ color: "var(--sub)", marginLeft: 10 }}>Score {avg}</span>}
        </div>
        {p.slug && <Link className="pill sm soft" href={`/rankings/${p.slug}`} style={{ marginLeft: "auto" }}>Full breakdown →</Link>}
      </div>

      {p.commitLogo && (
        <div className="pbcommitwrap">
          <img className="pbcommit xl" src={p.commitLogo} alt={p.commit || ""} title={p.commit || ""} />
        </div>
      )}
    </div>
  );
}

type PlayerorNull = PlayerPost | null | undefined;
