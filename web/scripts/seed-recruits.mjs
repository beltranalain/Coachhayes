// One-off: seed the 12 recruits Coach sent into the `players` collection so they
// show on the public board AND in the admin. Enriches each from YouTube metadata
// (position / class year / a starter bio). Chip defaults to "bronze" (on the
// radar) — Coach re-grades in the admin. Run: node scripts/seed-recruits.mjs
import { readFileSync } from "node:fs";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
const YT = env.YOUTUBE_API_KEY;

const RECRUITS = [
  ["Amir Sears", "https://www.youtube.com/watch?v=iQ9SNKgSpyc"],
  ["Trenton Blaylock", "https://www.youtube.com/watch?v=7eGciB4jFUg"],
  ["Jamir Dean", "https://www.youtube.com/watch?v=zmJPqjpFZzo"],
  ["Ammari Irvin", "https://www.youtube.com/watch?v=nge29ycMEaE"],
  ["Jalaythan Mayfield", "https://www.youtube.com/watch?v=qmV-BFVZr0o"],
  ["DeMarco Jenkins", "https://www.youtube.com/watch?v=G2IfPlSLX3s"],
  ["Noah Glover", "https://www.youtube.com/watch?v=YnhbU1XW19k"],
  ["Jaiden Bryant", "https://www.youtube.com/watch?v=nmhXKHRcpK0"],
  ["Noah Roberts", "https://www.youtube.com/watch?v=WqXA8M3uJdM"],
  ["Keysan Taylor", "https://www.youtube.com/watch?v=rwFInlT34Xw"],
  ["Jonathan Galette", "https://www.youtube.com/watch?v=FCNHRal7mQw"],
  ["Derwin Fields", "https://www.youtube.com/watch?v=FJ0mD8metxU"],
];

const POS = ["QB","RB","FB","WR","TE","OT","OG","OL","C","DE","DT","DL","EDGE","LB","MLB","OLB","ILB","CB","DB","S","FS","SS","SAF","ATH","K","P","LS"];
const ytId = (u) => (u.match(/(?:v=|youtu\.be\/)([\w-]{11})/) || [])[1];
const slugify = (name, y) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") + (y ? "-" + y : "");
const CHIP_WEIGHT = { bronze: 1, silver: 2, gold: 3, blue: 4 };
const defaultOrder = (chip, createdAt) => CHIP_WEIGHT[chip] * 1e13 + createdAt;

async function ytMeta(url) {
  const id = ytId(url);
  if (!id || !YT) return {};
  try {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${id}&key=${YT}`);
    const d = await r.json();
    const sn = d?.items?.[0]?.snippet;
    return sn ? { title: sn.title, description: (sn.description || "").slice(0, 1500), channel: sn.channelTitle } : {};
  } catch { return {}; }
}
function parse(name, meta) {
  const hay = `${meta.title || ""} ${meta.description || ""}`;
  const up = hay.toUpperCase();
  const pos = POS.find((p) => new RegExp(`\\b${p}\\b`).test(up)) || "";
  const ym = hay.match(/\b(20(2[4-9]|3[0-2]))\b/);
  const classYear = ym ? ym[1] : "";
  // school: text before " High" / "HS" if present
  const sm = meta.title && meta.title.match(/([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3})\s+(?:High School|HS)\b/);
  const school = sm ? sm[1] + (sm[0].includes("High School") ? " High School" : " HS") : "";
  return { pos, classYear, school };
}

const now = Date.now();
let i = 0;
for (const [name, url] of RECRUITS) {
  const meta = await ytMeta(url);
  const { pos, classYear, school } = parse(name, meta);
  const chip = "bronze";
  const createdAt = now - i * 1000; // preserve list order (earlier = higher)
  const slug = slugify(name, classYear);
  const bio = `${name}${pos ? `, ${pos}` : ""}${school ? ` at ${school}` : ""}${classYear ? `, class of ${classYear}` : ""}. Highlight film under review — Coach Hayes grade pending.`;

  // de-dupe by slug
  const existing = await db.collection("players").where("slug", "==", slug).limit(1).get();
  const doc = {
    name, slug, position: pos, school, city: "", state: "", classYear, chip,
    bio, strengths: [], traits: [], videoUrl: url,
    heightIn: 0, weightLb: 0, fortyYd: "",
    seoTitle: `${name}${pos ? ` — ${pos}` : ""}${classYear ? ` (${classYear})` : ""} | Coach Hayes Football Rankings`,
    seoDescription: bio.slice(0, 155),
    published: true, removed: false, source: "seed",
    order: defaultOrder(chip, createdAt), createdAt, updatedAt: now,
  };
  if (existing.empty) {
    const ref = await db.collection("players").add(doc);
    console.log(`+ ${name}  [${pos || "?"} ${classYear || "?"}]  ${ref.id}`);
  } else {
    await existing.docs[0].ref.set({ ...doc, createdAt: existing.docs[0].data().createdAt || createdAt }, { merge: true });
    console.log(`~ ${name}  [${pos || "?"} ${classYear || "?"}]  (updated)`);
  }
  i++;
}
console.log("done:", RECRUITS.length, "recruits");
process.exit(0);
