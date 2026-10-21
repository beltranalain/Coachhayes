// Remove the demo Locker Room data created by seed-community.mjs. Deletes every
// post whose id starts with "seed_post_" (and its comments subcollection).
//
//   node scripts/seed-community-clear.mjs     (run from the web/ folder)

import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[m[1]] = v;
}
initializeApp({
  credential: cert({
    projectId: env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: (env.FIREBASE_ADMIN_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore();

async function run() {
  const snap = await db.collection("posts").get();
  let n = 0;
  for (const doc of snap.docs) {
    if (!doc.id.startsWith("seed_post_")) continue;
    const cs = await doc.ref.collection("comments").get();
    for (const c of cs.docs) await c.ref.delete();
    await doc.ref.delete();
    n++;
  }
  console.log(`Removed ${n} demo posts (and their comments).`);
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
