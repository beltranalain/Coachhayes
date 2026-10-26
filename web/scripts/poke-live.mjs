// Force the Live page to re-detect NOW: find the channel's current live stream
// via the uploads playlist (cheap, no search.list) and seed it into Firestore
// `site/liveState`. The resolver then confirms it with a 1-unit videos.list on
// the next poll, so the site flips live immediately. Clears itself when the
// show ends. Useful when live detection is lagging or the Search quota is spent.
// Run: node scripts/poke-live.mjs [channelId]
import { readFileSync } from "node:fs";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (!m) continue;
  let v = m[2].trim(); if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1); env[m[1]] = v;
}
const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert({ projectId: env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = getFirestore(app);
const YKEY = env.YOUTUBE_API_KEY;
const channelId = process.argv[2] || "UCiU3F0NPnqqpovm7fHxtvtA";
const uploads = "UU" + channelId.slice(2);
const API = "https://www.googleapis.com/youtube/v3";

const pl = await (await fetch(`${API}/playlistItems?part=contentDetails&maxResults=15&playlistId=${uploads}&key=${YKEY}`)).json();
const ids = (pl.items || []).map((i) => i.contentDetails?.videoId).filter(Boolean);
const v = await (await fetch(`${API}/videos?part=snippet,liveStreamingDetails&id=${ids.join(",")}&key=${YKEY}`)).json();
const live = (v.items || []).find((i) => i.snippet?.liveBroadcastContent === "live");

if (!live) { console.log("No live stream found in the latest uploads — nothing to seed."); process.exit(0); }
await db.collection("site").doc("liveState").set({ videoId: live.id, viewers: Number(live.liveStreamingDetails?.concurrentViewers) || null, lastSearchAt: 0, updatedAt: Date.now() }, { merge: true });
console.log(`Seeded live: ${live.id} — ${live.snippet.title.slice(0, 60)} (viewers: ${live.liveStreamingDetails?.concurrentViewers || "?"})`);
console.log("The Live page should flip on within ~20s.");
process.exit(0);
