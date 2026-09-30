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
const snap = await db.collection("players").where("slug", "==", "amir-sears").limit(1).get();
if (snap.empty) { console.log("not found"); process.exit(0); }
await snap.docs[0].ref.set({ commit: "Miami", commitLogo: "https://a.espncdn.com/i/teamlogos/ncaa/500/2390.png" }, { merge: true });
console.log("amir committed to Miami"); process.exit(0);
