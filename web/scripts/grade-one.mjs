import { readFileSync } from "node:fs";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  env[m[1]] = v;
}
const app = getApps().length ? getApps()[0] : initializeApp({
  credential: cert({ projectId: env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n") }),
});
const db = getFirestore(app);

const snap = await db.collection("players").where("slug", "==", "amir-sears").limit(1).get();
if (snap.empty) { console.log("amir-sears not found"); process.exit(0); }
await snap.docs[0].ref.set({
  categories: { power: "gold", speed: "blue", motor: "gold", technique: "gold", iq: "blue" },
  categoryNotes: {
    power: "Plays bigger than the listed weight. Finishes through first contact instead of falling off it.",
    speed: "Separates late on the vertical. Not a track guy, but pulls away when the ball is in the air.",
    motor: "Blocks on run downs with nobody watching. That is the tell.",
    technique: "Release package is real. Stacks leverage and finishes at the catch point.",
    iq: "Sits down in the zone without being told. Knows where the sticks are.",
  },
  chip: "gold", classYear: "2027", position: "WR", school: "Columbus",
}, { merge: true });
console.log("updated amir-sears");
process.exit(0);
