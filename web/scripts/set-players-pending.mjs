// Flip the named players to PENDING (unpublished) and sink them to the bottom
// of the board. Run: node scripts/set-players-pending.mjs "Trey Taylor" "Ian Ellis, Jr."
import { readFileSync } from "node:fs";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const names = process.argv.slice(2);
if (!names.length) { console.error('Usage: node scripts/set-players-pending.mjs "Name One" "Name Two"'); process.exit(1); }

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (!m) continue;
  let v = m[2].trim(); if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1); env[m[1]] = v;
}
const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert({ projectId: env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = getFirestore(app);

const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const want = new Set(names.map(norm));
const snap = await db.collection("players").get();
const now = Date.now(); let n = 0;
for (const d of snap.docs) {
  const data = d.data();
  if (want.has(norm(data.name || ""))) {
    await d.ref.set({ published: false, order: -now - n, updatedAt: now }, { merge: true });
    console.log(`  pending: ${data.name}`); n++;
  }
}
console.log(`Done. ${n} set to Pending.`);
process.exit(0);
