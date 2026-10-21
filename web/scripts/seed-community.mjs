// One-off: seed the Locker Room (posts + comments) with demo users so we can see
// the feed, link thumbnails, and comment threads. Every doc id is prefixed
// "seed_" so it's trivial to remove later (see seed-community-clear.mjs).
//
//   node scripts/seed-community.mjs        (run from the web/ folder)

import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// --- load the admin service account from web/.env.local ----------------------
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

// --- demo users --------------------------------------------------------------
const U = (n, name) => ({ uid: `seed_user_${n}`, author: name, picture: `https://i.pravatar.cc/160?u=seed_user_${n}` });
const users = [
  U(1, "Marcus Johnson"), U(2, "Deja Williams"), U(3, "Coach Tony"), U(4, "Ray Ray"),
  U(5, "Gridiron Guru"), U(6, "Simone Carter"), U(7, "Tae from Tampa"), U(8, "Film Room Fanatic"),
  U(9, "Nana B"), U(10, "QB1 Dreams"),
  U(11, "Padre Mike"), U(12, "Canes4Life"), U(13, "Reek"), U(14, "Coach Dee"), U(15, "Southside Scout"),
  U(16, "Mo the Film Guy"), U(17, "Trench Truther"), U(18, "Jaylen's Mom"),
];

const DAY = 86400000, HR = 3600000;
const base = Date.now();
const ago = (d, h = 0) => base - d * DAY - h * HR;

// --- posts (text, some with links for thumbnails, one poll). Timestamps are
// spread across the last week so they scramble in among the video posts.
const posts = [
  { by: 1, t: ago(0, 7), likes: 14, text: "Miami's O-line looked completely different in the second half. Hayes called it on the stream last week." },
  { by: 2, t: ago(0, 13), likes: 9, text: "Who y'all got this weekend — Colorado or the field? 👀 no wrong answers (there's a wrong answer)." },
  { by: 3, t: ago(0, 21), likes: 31, text: "Film don't lie. This kid's footwork at center is cleaner than half the guys getting P4 offers. https://www.espn.com/college-football/" },
  { by: 4, t: ago(1, 5), likes: 6, text: "Call-in queue was crazy tonight lol. Coach stayed on for an extra hour, respect." },
  { by: 5, t: ago(1, 12), likes: 22, text: "Breaking down the 24-team playoff math and honestly it kind of works? read this then argue with me https://www.cbssports.com/college-football/" },
  { by: 6, t: ago(1, 20), likes: 11, text: "The Locker Room > every other football chat on the internet. it's not close." },
  { by: 7, t: ago(2, 4), likes: 4, text: "somebody clip the part where Coach roasted the participation trophy take 😭" },
  { by: 8, t: ago(2, 14), likes: 18, text: "If you're not watching the postgame room after the show you're missing the best part. That's where the real tape talk happens." },
  { by: 9, t: ago(2, 22), likes: 27, text: "My grandson's highlight finally got evaluated and the breakdown was so detailed. Thank you Coach 🙏 Good read on recruiting too https://sports.yahoo.com/college-football/" },
  { by: 10, t: ago(3, 6), likes: 8, text: "Hot take: a 3-star with a motor beats a 5-star who takes plays off every single time." },
  { by: 2, t: ago(3, 16), likes: 15, text: "Bleacher Report actually got one right for once lol https://bleacherreport.com/college-football" },
  { by: 5, t: ago(4, 3), likes: 12, text: "", poll: { options: ["Colorado", "Miami", "UCF", "The upset nobody sees"], votedBy: {} } },
  { by: 3, t: ago(4, 15), likes: 19, text: "PSA for the young coaches in here: leverage and pad level win more reps than any scheme. Watch the hips, not the arms." },
  // Image posts (various aspect ratios) to see how photos render in the feed.
  { by: 7, t: ago(0, 17), likes: 24, text: "Game day 🔥 who else is at the stadium tonight", img: "https://picsum.photos/seed/chfgame/1100/620" },
  { by: 9, t: ago(1, 16), likes: 33, text: "My grandson after the win. Proud nana moment 🥹", img: "https://picsum.photos/seed/chfnana/760/940" },
  { by: 4, t: ago(2, 18), likes: 17, text: "New film study setup is ready. Coach's breakdowns hit different on the big screen.", img: "https://picsum.photos/seed/chffilm/900/900" },
  // A few more, spread deeper into the week.
  { by: 6, t: ago(3, 22), likes: 9, text: "Coach's read on the Kalen DeBoer situation was spot on. called it before anyone else did." },
  { by: 8, t: ago(5, 4), likes: 13, text: "Rewatched the FSU breakdown twice. the detail on the O-line stunts is nuts." },
  { by: 1, t: ago(5, 16), likes: 7, text: "new here — this place actually talks ball instead of just yelling. love it so far." },
  { by: 10, t: ago(6, 7), likes: 16, text: "Malachi Toney really does deserve a statue lol what a game that was" },
  { by: 3, t: ago(6, 18), likes: 21, text: "That 2OT win over FSU might be the game of the year. Canes refused to lose." },
  // More random chatter, spread across the week.
  { by: 11, t: ago(0, 10), likes: 5, text: "First time catching the show live tonight. way better than the big networks ngl." },
  { by: 12, t: ago(0, 19), likes: 28, text: "CANES UP. that's the whole post." },
  { by: 13, t: ago(1, 8), likes: 7, text: "anybody got the link to the fantasy league? trying to get my squad in before the deadline" },
  { by: 14, t: ago(1, 23), likes: 17, text: "As a youth coach, the pad level breakdown changed how I teach my D-line. thank you Coach." },
  { by: 15, t: ago(2, 9), likes: 11, text: "Scouting note: watch #7 on the Northwestern tape. kid is a problem off the edge." },
  { by: 16, t: ago(2, 20), likes: 24, text: "The film room content is worth the membership by itself. it's not even close." },
  { by: 17, t: ago(3, 9), likes: 9, text: "Hot take: the trenches win titles, not the QB stats everyone cries about." },
  { by: 18, t: ago(3, 19), likes: 33, text: "My son got his first offer today after y'all put his tape in front of the right people 🥹🙏" },
  { by: 12, t: ago(4, 7), likes: 6, text: "who's doing the call-in show this week? got a question about the Miami secondary" },
  { by: 1, t: ago(4, 18), likes: 13, text: "The 'Good Bad & Ugly' breakdowns hit different. Coach doesn't sugarcoat anything." },
  { by: 5, t: ago(5, 8), likes: 10, text: "poll was fun, we need more of those in here", poll: { options: ["More polls", "More film breakdowns", "More call-ins", "All of it"], votedBy: {} } },
  { by: 13, t: ago(5, 20), likes: 8, text: "lurked for months, finally joined. this is the only football community that actually watches the tape." },
  { by: 7, t: ago(6, 2), likes: 19, text: "Tailgate pics from Saturday 🔥 what a scene at Hard Rock", img: "https://picsum.photos/seed/chftailgate/1080/700" },
  { by: 16, t: ago(6, 13), likes: 14, text: "Rewatching the Clemson game breakdown. the detail on the pull reads is elite coaching." },
  { by: 14, t: ago(6, 21), likes: 12, text: "If you coach youth ball and you're not in here, you're missing free clinics every week." },
];

// --- comment threads (flat; reads as a back-and-forth) -----------------------
// keyed by post index (0-based)
const threads = {
  0: [[3, "Facts, their guard play was night and day"], [7, "the LT finally staying square helped too"], [1, "exactly, one adjustment changed the whole game"]],
  2: [[5, "offers are gonna come, mark my words"], [3, "already got 2 FCS looks after this breakdown dropped"], [9, "love to see it 🙌"]],
  4: [[10, "nah 24 is too many, dilutes it"], [5, "did you read it tho? the seeding fixes that"], [10, "...ok that part actually makes sense"]],
  7: [[6, "the postgame room is elite"], [4, "wish it went even longer ngl"]],
  8: [[1, "congrats!! what position?"], [9, "center, 2027 class 😁"], [8, "that breakdown was clean, saw it"]],
  11: [[7, "Colorado all day"], [2, "upset special, you'll see"], [6, "putting my chips on Miami"]],
};

async function run() {
  let np = 0, nc = 0;
  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    const u = users[p.by - 1];
    const comments = threads[i] || [];
    const id = `seed_post_${i + 1}`;
    await db.collection("posts").doc(id).set({
      uid: u.uid, author: u.author, picture: u.picture,
      text: p.text || "", ts: p.t, likes: p.likes || 0, likedBy: [],
      commentCount: comments.length, room: "general", savedBy: [],
      image: p.img || null, clip: null, poll: p.poll || null, kind: null, player: null, show: null,
    });
    np++;
    for (let j = 0; j < comments.length; j++) {
      const [cby, ctext] = comments[j];
      const cu = users[cby - 1];
      await db.collection("posts").doc(id).collection("comments").doc(`seed_c_${i + 1}_${j + 1}`).set({
        uid: cu.uid, author: cu.author, picture: cu.picture, text: ctext, ts: p.t + (j + 1) * 7 * 60000,
      });
      nc++;
    }
  }
  console.log(`Seeded ${np} posts and ${nc} comments into the Locker Room (room: general).`);
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
