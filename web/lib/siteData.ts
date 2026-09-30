// Central content model. Today these are defaults baked into the app so it
// runs with zero setup. Once Firestore is connected, the admin Content and
// Branding sections write to it and these become the fallback.
//
// Brandable defaults (studio name, shows, colors, emails) come from lib/brand.ts
// - edit THAT file to rebrand. Everything else here is neutral product default.

import { STUDIO_NAME, TAGLINE, DOMAIN, ACCENT, EMAIL_GENERAL, EMAIL_BOOKING, SHOWS } from "./brand";

export type NavItem = { href: string; label: string };

export const NAV: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/live", label: "Live" },
  { href: "/shows", label: "Shows" },
  { href: "/library", label: "Library" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export const BRAND = {
  name: STUDIO_NAME,
  tagline: TAGLINE,
  host: STUDIO_NAME,
  domain: DOMAIN,
  accent: ACCENT,
  emailGeneral: EMAIL_GENERAL,
  emailBooking: EMAIL_BOOKING,
};

export const HERO = {
  headlinePre: "Real stories, live from ",
  headlineGlow: STUDIO_NAME,
  headlinePost: ", on our own stage.",
  intro:
    "Live broadcasts, original series, and the full show family. Streaming on our own platform and on YouTube at the same time.",
  primaryLabel: "Watch Live",
  secondaryLabel: "Explore the Shows",
};

export type Series = {
  key: string;
  title: string;
  tag: string;
  badge: string;
  blurb: string;
  href: string;
  by: string;       // host / credit line
  category: string; // two-word slate label, e.g. "Live\nTalk"
  art: string;      // gradient art-well class: a1..a6 (fallback when no image)
  image?: string;   // custom thumbnail (data URL); overrides the gradient art
  visible?: boolean; // shown on the public site (defaults to true when unset)
};

export const SERIES: Series[] = SHOWS as Series[];

export type DemoVideo = {
  title: string;
  seriesKey: string;
  seriesName: string;
  badge: string;
  duration: string;
};

// Placeholder library rows shown until real videos load from YouTube / Stream.
// Built from the brand's SHOWS so they always match the configured shows.
const nameOf = (i: number) => SHOWS[i % SHOWS.length]?.title || "Show";
const keyOf = (i: number) => SHOWS[i % SHOWS.length]?.key || "show";
const badgeOfIdx = (i: number) => SHOWS[i % SHOWS.length]?.badge || "Show";
export const DEMO_VIDEOS: DemoVideo[] = [
  { title: "Season Opener", seriesKey: keyOf(0), seriesName: nameOf(0), badge: badgeOfIdx(0), duration: "42:10" },
  { title: "Late Evening, Long Talk", seriesKey: keyOf(1), seriesName: nameOf(1), badge: badgeOfIdx(1), duration: "28:45" },
  { title: "The Long Way Home", seriesKey: keyOf(3), seriesName: nameOf(3), badge: badgeOfIdx(3), duration: "19:02" },
  { title: "One Quick Thing", seriesKey: keyOf(2), seriesName: nameOf(2), badge: badgeOfIdx(2), duration: "06:31" },
  { title: "Chapter One: The Turn", seriesKey: keyOf(4), seriesName: nameOf(4), badge: badgeOfIdx(4), duration: "51:22" },
  { title: "Guests and Ground Rules", seriesKey: keyOf(0), seriesName: nameOf(0), badge: badgeOfIdx(0), duration: "38:04" },
  { title: "Neighbors and Notes", seriesKey: keyOf(1), seriesName: nameOf(1), badge: badgeOfIdx(1), duration: "33:17" },
  { title: "Highway at Dusk", seriesKey: keyOf(3), seriesName: nameOf(3), badge: badgeOfIdx(3), duration: "24:50" },
];

export type ScheduleItem = { when: string; title: string; note: string; cover?: string; startsAt?: number; tz?: string };

// Empty by default - the creator adds real broadcasts in Studio -> Schedule.
export const SCHEDULE: ScheduleItem[] = [
];

// ---- Editable site configuration (admin -> Firestore -> public site) ----
// These shapes are what the admin Content and Branding pages read and write.
// DEFAULT_* are the fallback used in demo mode and before anything is saved.

export type SiteContent = {
  aboutText: string;
  emailGeneral: string;
  emailBooking: string;
  portrait: string; // About-page portrait image (data URL) or ""
  series: Series[]; // the shows shown across the site (editable in admin)

  // Editable page headings/intros. Each hero title is split into two lines so the
  // second line can render in the brand accent color (matches the site design).
  showsEyebrow: string;
  showsTitle1: string;
  showsTitle2: string;
  showsIntro: string;

  libraryEyebrow: string;
  libraryTitle1: string;
  libraryTitle2: string;
  libraryIntro: string;

  aboutEyebrow: string;
  aboutTitle1: string;
  aboutTitle2: string;
  aboutClosingTitle1: string;
  aboutClosingTitle2: string;
  aboutClosingText: string;
};

export const DEFAULT_CONTENT: SiteContent = {
  aboutText:
    "An independent studio making original shows - live talk, long-form conversation, and series told in chapters. One team, one platform, streaming on our own site and on YouTube at the same time.\n\nEdit this text and everything else in the admin Content and Branding panels once Firestore is connected.",
  emailGeneral: BRAND.emailGeneral,
  emailBooking: BRAND.emailBooking,
  portrait: "",
  series: SERIES,

  showsEyebrow: "The slate",
  showsTitle1: "Our shows.",
  showsTitle2: "One platform.",
  showsIntro: "Every production has its own page, its own schedule and its own reminder list. Pick the ones you actually want.",

  libraryEyebrow: "On demand",
  libraryTitle1: "The",
  libraryTitle2: "archive",
  libraryIntro: "The player pulls real uploads from YouTube; the archive grid fills from your own Cloudflare Stream library as broadcasts are saved.",

  aboutEyebrow: `What's ${BRAND.name}?`,
  aboutTitle1: "One studio.",
  aboutTitle2: "Many shows.",
  aboutClosingTitle1: "Behind every show",
  aboutClosingTitle2: "is a real voice.",
  aboutClosingText: "Own the platform, keep the audience. Broadcasts go out live here and on YouTube at the same time, so nobody gets left behind while the home base stays fully yours.",
};

// Visible series in display order - the single source the public site reads.
// Treats an unset `visible` as visible (so older saved data still shows).
export function visibleSeries(list?: Series[] | null): Series[] {
  const arr = Array.isArray(list) && list.length ? list : SERIES;
  return arr.filter((s) => s.visible !== false);
}

// Turn a series' Link field into a safe destination. Handles three cases the
// non-technical admin might enter: an internal page ("/live"), a full URL
// ("https://youtube.com/..."), or a bare domain ("youtube.com/@x") - which we
// promote to https:// so it doesn't 404 as a same-site path.
export function normalizeHref(href: string): { url: string; external: boolean } {
  const h = (href || "").trim();
  if (!h) return { url: "/", external: false };
  if (/^https?:\/\//i.test(h)) return { url: h, external: true };
  if (h.startsWith("/")) return { url: h, external: false };
  // Bare domain (a dot appears before any slash) -> treat as an external site.
  if (/^[^/\s]+\.[^/\s]/.test(h)) return { url: "https://" + h, external: true };
  return { url: "/" + h.replace(/^\/+/, ""), external: false };
}

export type SiteBranding = {
  siteName: string;
  tagline: string;
  domain: string;
  accent: string;
  background: string;
  live: string;
  logo: string; // data URL (resized client-side) or ""
  favicon: string; // data URL or ""
  showChannelBug: boolean; // permanent show-name label on the live page
  channelBug: string; // label text (falls back to the show name)
  tipsEnabled: boolean; // show the tip / "Send a tip" buttons in chat
  liveDelivery: "own" | "youtube"; // site player: own Cloudflare (paid) or free YouTube embed
  youtubeChannelId: string; // the channel the live embed + "Watch on YouTube" point at
  twitchChannel: string; // twitch username to merge chat from (blank = off)
  hostName: string; // display name for the host (on the tile, in chat, guest roster)
  textColor: string; // main text color override ("" = auto-contrast to background)
  headingFont: string; // display/heading typeface name (see lib/fonts.ts), or "__custom__"
  bodyFont: string; // body/UI typeface name (see lib/fonts.ts), or "__custom__"
  customFont: string; // uploaded font file as a data URL ("" = none)
  customFontName: string; // label for the uploaded font (from its filename)
};

export const DEFAULT_BRANDING: SiteBranding = {
  siteName: BRAND.name,
  tagline: BRAND.tagline,
  domain: BRAND.domain,
  accent: ACCENT,
  background: "#0A0908",
  live: "#E8402A",
  logo: "",
  favicon: "",
  showChannelBug: false,
  channelBug: `${BRAND.name} Live`,
  tipsEnabled: true,
  liveDelivery: "own",
  // Set in the admin (Settings -> YouTube channel) or lib/brand.ts CHANNELS.
  youtubeChannelId: "",
  twitchChannel: "",
  hostName: "Host",
  textColor: "",
  headingFont: "Anton",
  bodyFont: "Inter",
  customFont: "",
  customFontName: "",
};

// Sentinel value used by the font pickers to mean "the uploaded custom font".
export const CUSTOM_FONT = "__custom__";
// The @font-face family name the custom font is registered under.
export const CUSTOM_FONT_FAMILY = "SiteCustomFont";

// Branded "scene": background behind the host, optional green-screen removal,
// plus a frame overlay + logo (like a TV broadcast look).
export type SiteScene = {
  enabled: boolean;
  mode: "none" | "chroma" | "ml"; // background removal: off / green-screen / AI
  chroma: string; // key color for green-screen
  background: string; // data URL
  frame: string; // transparent PNG overlay, data URL
  logo: string; // data URL (top-center)
  tickerOn: boolean; // rotating lower-third news ticker
  tickerLabel: string; // colored label box on the left (e.g. "CWTV")
  ticker: string; // messages, one per line - scroll across the bottom
};

export const DEFAULT_SCENE: SiteScene = {
  enabled: false,
  mode: "chroma",
  chroma: "#00b140",
  background: "",
  frame: "",
  logo: "",
  tickerOn: false,
  tickerLabel: "",
  ticker: "",
};

// Intro / "starting soon" bumper: a branded holding screen (or looping intro
// video) shown on the broadcast before the live content starts.
export type SiteBumper = {
  enabled: boolean;
  mode: "card" | "video";
  headline: string;
  subtext: string;
  background: string; // data URL (card background)
  videoUrl: string;   // CORS-enabled MP4 URL (video mode)
  startsAt: number;   // epoch ms; 0 = no countdown
};

export const DEFAULT_BUMPER: SiteBumper = {
  enabled: false,
  mode: "card",
  headline: "Starting soon",
  subtext: "",
  background: "",
  videoUrl: "",
  startsAt: 0,
};

// Soundboard: short sound-effect pads the host taps during a broadcast.
export type SoundPad = { id: string; label: string; url: string };

export const DEFAULT_SOUNDS: SoundPad[] = [];

// Rundown: a PTI-style right-rail list of the show's topics. The active topic
// is highlighted and its image shows at the top of the rail. Optional segment
// timer counts how long you've been on the current topic.
// seconds = segment length for a countdown clock (0 = count up "time on topic").
export type RundownItem = { title: string; image: string; seconds: number }; // image = data URL or ""
export type SiteRundown = {
  enabled: boolean;
  title: string;       // header label above the list, e.g. "RUNDOWN"
  showTimer: boolean;  // show the on-topic timer
  activeIndex: number; // which topic is current (highlighted + image shown)
  items: RundownItem[];
};

export const DEFAULT_RUNDOWN: SiteRundown = {
  enabled: false,
  title: "RUNDOWN",
  showTimer: true,
  activeIndex: 0,
  items: [],
};

export const LIBRARY_FILTERS = [
  { key: "all", label: "All" },
  ...SHOWS.map((s) => ({ key: s.key, label: s.title })),
];
