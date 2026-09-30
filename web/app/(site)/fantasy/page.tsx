import type { Metadata } from "next";
import { getHayesContent } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Fantasy",
  description: "Coach Hayes Football fantasy — three paid levels plus a free weekly game. Entrant tracking only; the platform never processes entry fees.",
};

// All copy + levels + steps come from content.fantasy (admin-editable). The
// league views need the Fantrax integration + leagueLevels/entrants (Phase 6).
// IMPORTANT: the platform tracks entrants + payment status only — it never
// processes entry fees (see BUILD_PLAN.md and the legal note below).
export default async function FantasyPage() {
  const { fantasy: c } = await getHayesContent();
  return (
    <div className="wide" style={{ paddingTop: 26, paddingBottom: 40 }}>
      <div className="fhead">
        <div>
          <p className="leaguename">{c.leagueName}</p>
          <h2>{c.heading}</h2>
        </div>
      </div>

      <div className="levels">
        <div className="lvhead">
          <div>
            <h3>{c.levelsHeading}</h3>
            <p>{c.levelsIntro}</p>
          </div>
          <span className="lvnote">{c.seasonNote}</span>
        </div>
        <div className="lvgrid">
          {c.levels.map((l) => (
            <div className={`lv${l.highlight ? " on" : ""}`} key={l.key}>
              <div className="lvin">${l.entry}</div>
              <span>entry</span>
              <div className="lvout">${l.prize}</div>
              <span>to the winner</span>
              <div className="lvbar">
                <b>{l.filled} of {l.seats} filled</b>
                <span className="lvtrack"><i style={{ width: `${(l.filled / l.seats) * 100}%` }} /></span>
              </div>
              <button className={`pill sm${l.highlight ? "" : " soft"}`}>{c.joinLabel}</button>
            </div>
          ))}
        </div>

        <div className="lvsteps">
          {c.steps.map((s) => (
            <div className="lvstep" key={s.n}><b>{s.n}</b><span>{s.text}</span></div>
          ))}
        </div>

        <p className="lvfine">{c.legal}</p>
      </div>

      <div className="openplay">
        <div>
          <b>{c.freeGameTitle}</b>
          <span>{c.freeGameText}</span>
        </div>
        <button className="pill sm">{c.freeGameCta}</button>
      </div>
    </div>
  );
}
