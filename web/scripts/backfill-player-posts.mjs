// One-time backfill: create a community feed post for every existing published
// player that doesn't already have one. Mirrors the auto-post in
// app/api/admin/players/route.ts. Run: node scripts/backfill-player-posts.mjs
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Load .env.local (simple parse — handles KEY=VALUE and quoted multiline keys).
const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[m[1]] = v;
}

const projectId = env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!projectId || !clientEmail || !privateKey) { console.error("Missing FIREBASE_ADMIN_* in .env.local"); process.exit(1); }

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

const CHIP_LABEL = { blue: "Blue chip", gold: "Gold chip", silver: "Silver chip", bronze: "Bronze chip" };
const CATS = [["power", "Power"], ["speed", "Speed"], ["motor", "Motor"], ["technique", "Technique"], ["iq", "Football IQ"]];

function postText(f) {
  const lines = [];
  const meta = [f.position, f.school, f.classYear ? `Class of ${f.classYear}` : ""].filter(Boolean).join(" · ");
  lines.push(`New in the rankings: ${f.name}`);
  if (meta) lines.push(meta);
  lines.push(`Overall grade: ${CHIP_LABEL[f.chip] || f.chip || "Unranked"}`);
  const cats = CATS.filter(([k]) => f.categories && f.categories[k]).map(([k, label]) => `${label}: ${CHIP_LABEL[f.categories[k]] || f.categories[k]}`);
  if (cats.length) lines.push(cats.join(" · "));
  if (f.commit) lines.push(`Committed: ${f.commit}`);
  lines.push(`Full breakdown: /rankings/${f.slug}`);
  return lines.join("\n");
}

const run = async () => {
  const bDoc = await db.collection("site").doc("branding").get();
  const branding = bDoc.exists ? bDoc.data() : {};
  const author = branding?.siteName || "Coach Hayes Football";
  const picture = branding?.logo || null;

  const [players, existing] = await Promise.all([
    db.collection("players").get(),
    db.collection("posts").where("kind", "==", "player").get(),
  ]);
  const byPlayer = new Map(existing.docs.map((d) => [d.data().playerId, d.ref]));

  const playerObj = (p) => ({
    name: p.name, position: p.position || "", classYear: p.classYear || "",
    school: p.school || "", commit: p.commit || "", commitLogo: p.commitLogo || "", slug: p.slug || "",
    chip: p.chip || "bronze", categories: p.categories || {}, categoryNotes: p.categoryNotes || {},
  });

  let created = 0, updated = 0;
  // Oldest players first so the feed order reads naturally (newest player on top).
  const docs = players.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => p.published !== false && !p.removed)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  let ts = Date.now() - docs.length * 1000; // stagger timestamps so ordering is stable
  for (const p of docs) {
    const clip = typeof p.videoUrl === "string" && /^https?:\/\//.test(p.videoUrl) ? p.videoUrl.slice(0, 500) : null;
    const existingRef = byPlayer.get(p.id);
    if (existingRef) {
      // Refresh the structured breakdown + text on the existing post (keep ts/likes).
      await existingRef.set({ author, picture, text: postText(p), clip, kind: "player", playerId: p.id, playerSlug: p.slug || "", player: playerObj(p) }, { merge: true });
      updated++;
      console.log(`  ~ ${p.name} (updated)`);
    } else {
      await db.collection("posts").add({
        uid: "system-rankings", author, picture,
        text: postText(p), ts: ts++,
        likes: 0, likedBy: [], commentCount: 0, room: "general", savedBy: [],
        image: null, clip, poll: null,
        kind: "player", playerId: p.id, playerSlug: p.slug || "", player: playerObj(p),
      });
      created++;
      console.log(`  + ${p.name} (created)`);
    }
  }
  console.log(`\nDone. Created ${created}, updated ${updated}.`);
  process.exit(0);
};
run().catch((e) => { console.error(e); process.exit(1); });
