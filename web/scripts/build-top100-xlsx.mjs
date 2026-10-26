// Build the top-100-per-class recruiting Excel (2027/2026/2025) from the
// agent-collected JSON (247Sports/ESPN/Rivals data), merged with Coach's own
// chip grades from the Notion sheet where names match. Output matches the
// "Import with Excel" template (plus Rank/Stars reference columns, which the
// importer ignores). Run: node scripts/build-top100-xlsx.mjs <out.xlsx> [notion.csv]
import { readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";

const OUT = process.argv[2];
const CSV = process.argv[3];
if (!OUT) { console.error("Usage: node scripts/build-top100-xlsx.mjs <out.xlsx> [notion.csv]"); process.exit(1); }

const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : "";
const here = (p) => new URL(p, import.meta.url);

// Coach's chip grades from the Notion sheet (name -> Bronze/Silver/Gold/Blue).
const gradeMap = new Map();
if (CSV) {
  const text = readFileSync(CSV, "utf8").replace(/^﻿/, "");
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; } else if (c !== "\r") f += c; }
  if (f || row.length) { row.push(f); rows.push(row); }
  const hdr = rows.shift().map((h) => h.trim()); const ci = (n) => hdr.indexOf(n);
  for (const r of rows) { const nm = (r[ci("Athlete Name")] || "").trim(); const g = (r[ci("Chip Grade")] || "").trim();
    if (nm && ["blue", "gold", "silver", "bronze"].includes(g.toLowerCase())) gradeMap.set(norm(nm), cap(g)); }
  console.log(`Notion grades: ${gradeMap.size}`);
}

const COLS = ["Rank", "Stars", "Name", "Position", "Class Year", "High School", "City", "State", "Committed To", "Film URL", "Height (in)", "Weight (lb)", "40 Time", "Size", "Speed", "Effort", "Fundamentals & Tech", "Intangibles", "Overall Chip", "Scouting Report", "Strengths", "Traits", "Size Note", "Speed Note", "Effort Note", "Fundamentals & Tech Note", "Intangibles Note", "SEO Title", "SEO Description", "Published"];

const all = [];
let matched = 0;
for (const year of ["2027", "2026", "2025"]) {
  const list = JSON.parse(readFileSync(here(`../scripts/data/recruits-${year}.json`), "utf8"));
  for (const p of list) {
    const chip = gradeMap.get(norm(p.name)) || "";
    if (chip) matched++;
    const r = {}; for (const c of COLS) r[c] = "";
    r.Rank = p.rank ?? ""; r.Stars = p.stars ?? ""; r.Name = p.name || ""; r.Position = p.position || "";
    r["Class Year"] = p.classYear || year; r["High School"] = p.highSchool || ""; r.City = p.city || ""; r.State = p.state || "";
    r["Committed To"] = p.commit || ""; r["Height (in)"] = p.heightInches ?? ""; r["Weight (lb)"] = p.weightLb ?? "";
    // Coach's grade (if he's already rated this player) seeds all five + overall.
    r.Size = chip; r.Speed = chip; r.Effort = chip; r["Fundamentals & Tech"] = chip; r.Intangibles = chip; r["Overall Chip"] = chip;
    r.Published = "No";
    all.push(r);
  }
  console.log(`  ${year}: ${list.length} players`);
}
console.log(`Total ${all.length} players; ${matched} already have a Coach chip grade.`);

const ws = XLSX.utils.json_to_sheet(all, { header: COLS });
ws["!cols"] = COLS.map((c) => ({ wch: c === "Name" || c === "High School" ? 24 : c === "Committed To" ? 16 : Math.max(9, c.length + 1) }));
ws["!freeze"] = { xSplit: 0, ySplit: 1 };
const guide = XLSX.utils.aoa_to_sheet([
  ["Top 100 recruits per class (2027 / 2026 / 2025) — data from 247Sports / ESPN / Rivals."],
  ["Rank and Stars are reference columns from the services (the importer ignores them)."],
  ["Grades (Size/Speed/Effort/Fundamentals & Tech/Intangibles) are pre-filled ONLY where Coach already rated the player; otherwise blank for him to grade."],
  ["Grades use Bronze/Silver/Gold/Blue. Blank Overall Chip = auto from the five grades."],
  ["Committed To: school name only — logo is found automatically on import. Film URL is left blank to add later."],
  ["Published: No keeps a player Pending for review. Upload via Rankings -> Import with Excel (reads the 'Players' sheet)."],
  ["Note: commitments change often; verify before publishing. City is derived from the high school's location in some cases."],
]);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Players");
XLSX.utils.book_append_sheet(wb, guide, "Guide");
writeFileSync(OUT, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
console.log(`\nWrote ${all.length} recruits to ${OUT}`);
process.exit(0);
