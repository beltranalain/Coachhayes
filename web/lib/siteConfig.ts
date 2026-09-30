import "server-only";

import { getAdminDb, adminConfigured } from "./firebaseAdmin";
import {
  DEFAULT_CONTENT,
  DEFAULT_BRANDING,
  DEFAULT_SCENE,
  DEFAULT_BUMPER,
  DEFAULT_SOUNDS,
  DEFAULT_RUNDOWN,
  SCHEDULE,
  type SiteContent,
  type SiteBranding,
  type SiteScene,
  type SiteBumper,
  type SoundPad,
  type SiteRundown,
  type ScheduleItem,
} from "./siteData";
import { CHANNELS, makeChannel, type Channel } from "./channels";
import { DEFAULT_HAYES, type HayesContent } from "./hayesContent";

export type SiteConfig = {
  content: SiteContent;
  branding: SiteBranding;
  schedule: ScheduleItem[];
  scene: SiteScene;
  bumper: SiteBumper;
  sounds: SoundPad[];
  rundown: SiteRundown;
  channels: Channel[];
};

const FALLBACK: SiteConfig = {
  content: DEFAULT_CONTENT,
  branding: DEFAULT_BRANDING,
  schedule: SCHEDULE,
  scene: DEFAULT_SCENE,
  bumper: DEFAULT_BUMPER,
  sounds: DEFAULT_SOUNDS,
  rundown: DEFAULT_RUNDOWN,
  channels: CHANNELS,
};

// Reads editable content + branding + schedule from Firestore, merged over the
// defaults. Falls back to defaults when Firebase Admin is not configured.
export async function getSiteConfig(): Promise<SiteConfig> {
  if (!adminConfigured) return FALLBACK;
  try {
    const db = getAdminDb();
    if (!db) return FALLBACK;
    const [c, b, s, sc, bm, sd, rd, ch] = await Promise.all([
      db.collection("site").doc("content").get(),
      db.collection("site").doc("branding").get(),
      db.collection("site").doc("schedule").get(),
      db.collection("site").doc("scene").get(),
      db.collection("site").doc("bumper").get(),
      db.collection("site").doc("sounds").get(),
      db.collection("site").doc("rundown").get(),
      db.collection("site").doc("channels").get(),
    ]);
    const scheduleItems = s.exists ? (s.data()?.items as ScheduleItem[] | undefined) : undefined;
    const soundItems = sd.exists ? (sd.data()?.items as SoundPad[] | undefined) : undefined;
    const channelItems = ch.exists ? (ch.data()?.items as any[] | undefined) : undefined;
    return {
      content: { ...DEFAULT_CONTENT, ...(c.exists ? (c.data() as Partial<SiteContent>) : {}) } as SiteContent,
      branding: { ...DEFAULT_BRANDING, ...(b.exists ? (b.data() as Partial<SiteBranding>) : {}) },
      schedule: Array.isArray(scheduleItems) ? scheduleItems : SCHEDULE,
      scene: { ...DEFAULT_SCENE, ...(sc.exists ? (sc.data() as Partial<SiteScene>) : {}) },
      bumper: { ...DEFAULT_BUMPER, ...(bm.exists ? (bm.data() as Partial<SiteBumper>) : {}) },
      sounds: Array.isArray(soundItems) ? soundItems : DEFAULT_SOUNDS,
      rundown: { ...DEFAULT_RUNDOWN, ...(rd.exists ? (rd.data() as Partial<SiteRundown>) : {}) },
      channels: Array.isArray(channelItems) && channelItems.length ? channelItems.map(makeChannel) : CHANNELS,
    };
  } catch {
    return FALLBACK;
  }
}

// Editable public-site content (the Hayes pages). Reads Firestore `site/hayes`
// and merges each section over the approved defaults, so the admin can edit any
// string/stat/tile/tier/chip/level without touching code. Falls back to
// DEFAULT_HAYES when Firebase isn't configured or nothing is saved yet.
export async function getHayesContent(): Promise<HayesContent> {
  if (!adminConfigured) return DEFAULT_HAYES;
  try {
    const db = getAdminDb();
    if (!db) return DEFAULT_HAYES;
    const doc = await db.collection("site").doc("hayes").get();
    if (!doc.exists) return DEFAULT_HAYES;
    const saved = (doc.data() || {}) as Partial<HayesContent>;
    // Shallow-merge each section over its default so a partially-saved doc still
    // fills in every field (arrays are taken wholesale when present).
    const merged = {} as HayesContent;
    (Object.keys(DEFAULT_HAYES) as (keyof HayesContent)[]).forEach((k) => {
      merged[k] = { ...(DEFAULT_HAYES[k] as object), ...((saved[k] as object) || {}) } as never;
    });
    return merged;
  } catch {
    return DEFAULT_HAYES;
  }
}
