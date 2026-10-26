// Build a filled .xlsx of the last 3 recruiting classes (2027/2026/2025) from
// Coach's WRE YouTube playlists, enriched with grades from the Notion sheet where
// names match. Output matches the "Import with Excel" template so it round-trips.
// Run: node scripts/build-recruits-xlsx.mjs <outPath.xlsx> [notionCsvPath]
import { readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";

const OUT = process.argv[2];
const CSV = process.argv[3];
if (!OUT) { console.error("Usage: node scripts/build-recruits-xlsx.mjs <out.xlsx> [notion.csv]"); process.exit(1); }

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (!m) continue;
  let v = m[2].trim(); if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1); env[m[1]] = v;
}
const BASE = "https://coachhayes.vercel.app";
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : "";

async function jreq(url, data, tok, method = "POST") {
  const h = { "Content-Type": "application/json" }; if (tok) h.Authorization = "Bearer " + tok;
  const r = await fetch(url, { method, headers: h, body: JSON.stringify(data) });
  return r.json();
}
const tok = (await jreq(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
  { email: "coachhayesfootball@gmail.com", password: "Password12345", returnSecureToken: true })).idToken;
console.log("signed in");

const PLAYLISTS = [
  { id: "PLw6KVAiHK63HuoN05nSYhuPjrJz0By4Az", year: "2027" },
  { id: "PLw6KVAiHK63G05ErlE2s7veuYRWFQPJqS", year: "2026" },
  { id: "PLw6KVAiHK63FNf_CAjQ9K5hdNwtkjfFVw", year: "2025" },
];
const byName = new Map();
for (const pl of PLAYLISTS) {
  const r = await jreq(`${BASE}/api/admin/rankings/import`, { action: "preview", playlistId: pl.id, classYear: pl.year }, tok);
  const keep = (r.candidates || []).filter((c) => c.keep && c.name);
  for (const c of keep) { const k = norm(c.name); if (!byName.has(k)) byName.set(k, { ...c, classYear: c.classYear || pl.year }); }
  console.log(`  class ${pl.year}: ${keep.length} recruits`);
}

// Notion grades (Athlete Name -> Chip Grade / Position)
const gradeMap = new Map();
if (CSV) {
  const text = readFileSync(CSV, "utf8").replace(/^﻿/, "");
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; } else if (c !== "\r") f += c; }
  if (f || row.length) { row.push(f); rows.push(row); }
  const hdr = rows.shift().map((h) => h.trim());
  const ci = (n) => hdr.indexOf(n);
  for (const r of rows) { const nm = (r[ci("Athlete Name")] || "").trim(); if (nm) gradeMap.set(norm(nm), { chip: (r[ci("Chip Grade")] || "").trim(), pos: (r[ci("Position")] || "").trim() }); }
  console.log(`  Notion grades loaded: ${gradeMap.size}`);
}

const COLS = ["Name", "Position", "Class Year", "High School", "City", "State", "Committed To", "Film URL", "Height (in)", "Weight (lb)", "40 Time", "Size", "Speed", "Effort", "Fundamentals & Tech", "Intangibles", "Overall Chip", "Scouting Report", "Strengths", "Traits", "Size Note", "Speed Note", "Effort Note", "Fundamentals & Tech Note", "Intangibles Note", "SEO Title", "SEO Description", "Published"];
const posFix = (p) => ({ EGDE: "EDGE" }[(p || "").toUpperCase()] || p || "");
const data = [...byName.values()].map((c) => {
  const g = gradeMap.get(norm(c.name));
  const chip = g && ["blue", "gold", "silver", "bronze"].includes((g.chip || "").toLowerCase()) ? cap(g.chip) : "";
  const r = {}; for (const col of COLS) r[col] = "";
  r.Name = c.name; r.Position = posFix(c.position || (g && g.pos) || ""); r["Class Year"] = c.classYear;
  r["Committed To"] = c.commit || ""; r["Film URL"] = c.videoUrl || "";
  r.Size = chip; r.Speed = chip; r.Effort = chip; r["Fundamentals & Tech"] = chip; r.Intangibles = chip; r["Overall Chip"] = chip;
  r.Published = "No";
  return r;
});
// Sort newest class first, then name.
data.sort((a, b) => (b["Class Year"]).localeCompare(a["Class Year"]) || a.Name.localeCompare(b.Name));

const ws = XLSX.utils.json_to_sheet(data, { header: COLS });
ws["!cols"] = COLS.map((c) => ({ wch: Math.max(12, c.length + 2) }));
const guide = XLSX.utils.aoa_to_sheet([
  ["How to fill this in"],
  ["Pre-filled from Coach's WRE videos (name, position, class, commit, film). Grades filled where the Notion sheet had them."],
  ["Grades use: Bronze, Silver, Gold, or Blue. Blank Overall Chip = auto from the five grades."],
  ["Committed To: school name only — logo is found automatically. Height/Weight/40/notes are yours to add."],
  ["Published: No keeps a player Pending for review; Yes puts them live. Upload this file via Rankings → Import with Excel."],
]);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Players");
XLSX.utils.book_append_sheet(wb, guide, "Guide");
writeFileSync(OUT, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
const graded = data.filter((r) => r["Overall Chip"]).length;
console.log(`\nWrote ${data.length} recruits to ${OUT} (${graded} with grades pre-filled).`);
process.exit(0);
