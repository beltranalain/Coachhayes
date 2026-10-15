// One-off: create a super-admin (owner) login for Coach Hayes to test with.
// Does two things against the Firebase project in .env.local:
//   1. Creates (or updates) a Firebase Auth email/password account so he can sign in.
//   2. Writes him into Firestore site/team as role "owner" so he has full access
//      even where the env owner list differs (e.g. a deploy).
// Env owner protection in lib/team.ts means an env owner can't be demoted; this
// adds a second owner alongside info@donkeyideas.com.
// Run: node scripts/add-super-admin.mjs <email> <password> [displayName]
import { readFileSync } from "node:fs";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// --- load .env.local (handles quoted multiline private key) ---
const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  env[m[1]] = v;
}

// Credentials come from the command line (or ADMIN_EMAIL / ADMIN_PASSWORD env)
// so we never commit a live password into git history.
const EMAIL = (process.argv[2] || process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const PASSWORD = process.argv[3] || process.env.ADMIN_PASSWORD || "";
const DISPLAY_NAME = process.argv[4] || "Super Admin";

if (!EMAIL || !EMAIL.includes("@") || PASSWORD.length < 6) {
  console.error("Usage: node scripts/add-super-admin.mjs <email> <password> [displayName]");
  console.error("  (password must be at least 6 characters)");
  process.exit(1);
}

const app = getApps().length ? getApps()[0] : initializeApp({
  credential: cert({
    projectId: env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});
const auth = getAuth(app);
const db = getFirestore(app);

// 1) Auth account ----------------------------------------------------------
let uid;
try {
  const existing = await auth.getUserByEmail(EMAIL);
  uid = existing.uid;
  await auth.updateUser(uid, {
    password: PASSWORD,
    emailVerified: true,
    displayName: existing.displayName || DISPLAY_NAME,
    disabled: false,
  });
  console.log(`Updated existing auth user ${EMAIL} (uid ${uid}) — password reset.`);
} catch (e) {
  if (e.code === "auth/user-not-found") {
    const created = await auth.createUser({
      email: EMAIL,
      password: PASSWORD,
      emailVerified: true,
      displayName: DISPLAY_NAME,
    });
    uid = created.uid;
    console.log(`Created auth user ${EMAIL} (uid ${uid}).`);
  } else {
    throw e;
  }
}

// 2) Owner role in Firestore site/team ------------------------------------
const ref = db.collection("site").doc("team");
const snap = await ref.get();
const members = Array.isArray(snap.data()?.members) ? snap.data().members : [];
const idx = members.findIndex(
  (m) => typeof m?.email === "string" && m.email.trim().toLowerCase() === EMAIL
);
if (idx >= 0) {
  members[idx] = { email: EMAIL, role: "owner" };
} else {
  members.push({ email: EMAIL, role: "owner" });
}
await ref.set({ members }, { merge: true });
console.log(`Set ${EMAIL} as owner in Firestore site/team (${members.length} member(s) total).`);

console.log("\nDone. Login:");
console.log(`  Email:    ${EMAIL}`);
console.log(`  Password: ${PASSWORD}`);
process.exit(0);
