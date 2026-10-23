// Backfill each imported recruit's film with Coach's own YouTube WRE breakdown.
// Fetches every video title on the channel, matches a player by name tokens
// (surname + at least one other name token must appear in the title), and sets
// videoUrl to that YouTube link. Players with no matching video keep whatever
// film they already have (e.g. the Hudl link from the Notion sheet).
//
// Re-run anytime Coach posts more WRE videos to swap more placeholders over.
// Run: node scripts/match-youtube-films.mjs [source]   (default source: notion-wre)
import { readFileSync } from "node:fs";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const SOURCE = process.argv[2] || "notion-wre";
const UPLOADS = process.argv[3] || "UUiU3F0NPnqqpovm7fHxtvtA"; // Coach Hayes uploads playlist

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (!m) continue;
  let v = m[2].trim(); if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1); env[m[1]] = v;
}
const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert({ projectId: env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = getFirestore(app);
const YKEY = env.YOUTUBE_API_KEY;
if (!YKEY) { console.error("YOUTUBE_API_KEY missing from .env.local"); process.exit(1); }

// --- pull every video title on the channel (1 unit/page, cheap) ---
const vids = new Map(); let token = "", pages = 0;
while (pages < 60) {
  const u = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${UPLOADS}&key=${YKEY}${token ? `&pageToken=${token}` : ""}`;
  const d = await (await fetch(u)).json();
  for (const it of d.items || []) { const vid = it.snippet?.resourceId?.videoId; if (vid) vids.set(vid, it.snippet?.title || ""); }
  token = d.nextPageToken || ""; pages++;
  if (!token) break;
}
console.log(`Channel videos: ${vids.size}`);

const SUFF = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);
const toks = (s) => (s || "").toLowerCase().split(/[^a-z0-9]+/).filter((t) => t && !SUFF.has(t));
const CUES = new Set(["wre", "film", "breakdown", "breaking", "commit", "commits", "different", "elite", "lands", "adds", "add", "highlights"]);
const vtok = new Map(); for (const [vid, t] of vids) vtok.set(vid, new Set(toks(t)));
function best(name) {
  const tk = toks(name); if (tk.length < 2) return null;
  const surname = tk[tk.length - 1], others = new Set(tk.slice(0, -1)), tkset = new Set(tk);
  let bestVid = null, bestScore = -1, bestLen = 1e9;
  for (const [vid, ts] of vtok) {
    if (!ts.has(surname)) continue;
    let overlap = false; for (const o of others) if (ts.has(o)) { overlap = true; break; }
    if (!overlap) continue;
    let common = 0; for (const t of tkset) if (ts.has(t)) common++;
    const title = (vids.get(vid) || "").toLowerCase();
    let cue = 0; for (const w of title.split(/[^a-z0-9#]+/)) if (CUES.has(w)) cue++;
    const score = common * 10 + cue, len = (vids.get(vid) || "").length;
    if (score > bestScore || (score === bestScore && len < bestLen)) { bestVid = vid; bestScore = score; bestLen = len; }
  }
  return bestVid;
}

const snap = await db.collection("players").get();
const targets = snap.docs.filter((d) => d.data()?.source === SOURCE);
console.log(`Players with source="${SOURCE}": ${targets.length}`);
let done = 0; const none = [];
for (const d of targets) {
  const p = d.data();
  const vid = best(p.name);
  if (vid) {
    const url = `https://www.youtube.com/watch?v=${vid}`;
    if ((p.videoUrl || "") !== url) await d.ref.set({ videoUrl: url, updatedAt: Date.now() }, { merge: true });
    console.log(`  YT  ${p.name}  ->  ${vids.get(vid).slice(0, 52)}`);
    done++;
  } else none.push(p.name);
}
console.log(`\n${done} matched to a YouTube video; ${none.length} have none on the channel (film unchanged).`);
if (none.length) console.log("No YouTube video:", none.join(", "));
process.exit(0);
