// Import a Notion "HS WRE Recording Queue" CSV export into the `players`
// collection as PENDING (unpublished) recruits, pre-graded from the sheet's
// "Chip Grade" column. Coach reviews in the admin (Rankings -> Pending) and
// publishes. Dedups by name against what's already on the board.
//
// Run: node scripts/import-notion-wre.mjs "C:/path/to/HS W R E Recording Queue ..._all.csv"
import { readFileSync } from "node:fs";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const csvPath = process.argv[2];
if (!csvPath) { console.error("Usage: node scripts/import-notion-wre.mjs <csv path>"); process.exit(1); }

// --- load .env.local (handles quoted multiline private key) ---
const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  env[m[1]] = v;
}
const app = getApps().length ? getApps()[0] : initializeApp({
  credential: cert({
    projectId: env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore(app);

// --- tiny CSV parser (quoted fields may contain commas / newlines) ---
function parseCsv(text) {
  const rows = []; let row = [], field = "", q = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const rows = parseCsv(readFileSync(csvPath, "utf8")).filter((r) => r.some((c) => c.trim()));
const header = rows.shift().map((h) => h.trim());
const col = (name) => header.indexOf(name);
const iName = col("Athlete Name"), iFilm = col("247 link"), iChip = col("Chip Grade"), iPos = col("Position");

const CHIP = { blue: "blue", gold: "gold", silver: "silver", bronze: "bronze" };
const chipOf = (s) => CHIP[(s || "").trim().toLowerCase()] || "bronze";
const POSFIX = { EGDE: "EDGE", EDGE: "EDGE" };
const posOf = (s) => { const p = (s || "").trim().toUpperCase(); return POSFIX[p] || p; };
const CHIP_WEIGHT = { bronze: 1, silver: 2, gold: 3, blue: 4 };
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const existing = new Set();
const snap = await db.collection("players").get();
snap.forEach((d) => existing.add(norm(d.data()?.name || "")));
console.log(`Board has ${existing.size} players already.`);

const now = Date.now();
let created = 0, skipped = 0, i = 0;
for (const r of rows) {
  const name = (r[iName] || "").trim();
  if (!name) continue;
  if (existing.has(norm(name))) { console.log(`  skip (already on board): ${name}`); skipped++; continue; }
  existing.add(norm(name));
  const chip = chipOf(r[iChip]);
  const cats = { power: chip, speed: chip, motor: chip, technique: chip, iq: chip };
  const videoUrl = (r[iFilm] || "").trim();
  await db.collection("players").add({
    name, classYear: "", chip, categories: cats, categoryNotes: {},
    position: posOf(r[iPos]).slice(0, 24), school: "", city: "", state: "",
    commit: "", commitLogo: "",
    slug: slugify(name),
    bio: "", strengths: [], traits: [],
    videoUrl: videoUrl.slice(0, 500),
    heightIn: 0, weightLb: 0, fortyYd: "",
    seoTitle: "", seoDescription: "",
    published: false, removed: false, source: "notion-wre",
    order: -now - i, createdAt: now, updatedAt: now,
  });
  console.log(`  + ${name} — ${posOf(r[iPos])} — ${chip}${videoUrl ? " — film" : ""}`);
  created++; i++;
}
console.log(`\nDone. Created ${created} pending recruits, skipped ${skipped} (already on the board).`);
process.exit(0);
