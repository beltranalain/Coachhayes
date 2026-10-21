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
initializeApp({ credential: cert({ projectId: env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: (env.FIREBASE_ADMIN_PRIVATE_KEY || "").replace(/\\n/g, "\n") }) });
const db = getFirestore();

const snap = await db.collection("posts").get();
const byRoom = {}, byKind = {};
let noTs = 0;
snap.forEach((d) => {
  const x = d.data();
  byRoom[x.room || "(none)"] = (byRoom[x.room || "(none)"] || 0) + 1;
  byKind[x.kind || "user"] = (byKind[x.kind || "user"] || 0) + 1;
  if (!x.ts) noTs++;
});
console.log("total docs:", snap.size);
console.log("byRoom:", byRoom);
console.log("byKind:", byKind);
console.log("missing ts:", noTs);
process.exit(0);
