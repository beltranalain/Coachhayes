// EDIT THIS FILE to rebrand: {{STUDIO_NAME}}, {{TAGLINE}}, {{DOMAIN}},
// your shows, and your YouTube channels.
//
// This is the ONE place a buyer edits to make the template their own. Every
// other file (siteData.ts, channels.ts, components, pages) pulls its defaults
// from here. Most of it can also be overridden at runtime from the admin
// Branding / Content / Schedule panels once Firestore is connected.

export const STUDIO_NAME = "Coach Hayes Football";
export const TAGLINE = "Football, read the way a coach reads it.";
export const DOMAIN = "coachhayesfootball.com";

// Contact addresses shown on the site + used as fallbacks for the contact form.
export const EMAIL_GENERAL = `hello@${DOMAIN}`;
export const EMAIL_BOOKING = `booking@${DOMAIN}`;

// Design accent. The Hayes design system is dual-theme: blue accent in light,
// gold accent in dark (see the CSS token layer in app/globals-hayes.css). This
// constant is the light-theme accent; the dark override lives in the stylesheet.
export const ACCENT = "#0B6BFF";

// ---- Your shows -----------------------------------------------------------
// `key` links a show to its library filter, demo videos, and (optionally) a
// YouTube channel. Keep keys stable if you wire up channels below.
export type BrandShow = {
  key: string;
  title: string;
  tag: string;        // short marketing label
  badge: string;      // pill label on cards
  blurb: string;      // one or two sentence description
  href: string;       // where the card links
  by: string;         // host / credit line
  category: string;   // two-line slate label, e.g. "Live\nTalk"
  art: string;        // gradient art-well class: a1..a6
};

export const SHOWS: BrandShow[] = [
  {
    key: "live-show",
    title: "The Live Show",
    tag: "Flagship",
    badge: "Live talk",
    blurb:
      "The main broadcast. Live talk, guests, and whatever the chat brings in - no script, no rundown.",
    href: "/live",
    by: STUDIO_NAME,
    category: "Live\nTalk",
    art: "a2",
  },
  {
    key: "long-play",
    title: "Long Play",
    tag: "Long-form",
    badge: "Long-form",
    blurb: "Unhurried, long-form conversation. Real perspectives, no studio polish.",
    href: "/library",
    by: STUDIO_NAME,
    category: "Long\nForm",
    art: "a5",
  },
  {
    key: "quick-takes",
    title: "Quick Takes",
    tag: "Short-form",
    badge: "Short-form",
    blurb: "Short segments straight to the point. Under ten minutes, posted straight to the archive.",
    href: "/library",
    by: STUDIO_NAME,
    category: "Short\nForm",
    art: "a3",
  },
  {
    key: "on-the-road",
    title: "On The Road",
    tag: "On the road",
    badge: "On the road",
    blurb: "Thoughts and stories shot on the move. The show that travels with you.",
    href: "/library",
    by: STUDIO_NAME,
    category: "On the\nRoad",
    art: "a4",
  },
  {
    key: "the-series",
    title: "The Series",
    tag: "Docu-series",
    badge: "Docu-series",
    blurb: "A documentary series told in chapters. The turns, the setbacks, and the comebacks.",
    href: "/library",
    by: STUDIO_NAME,
    category: "Docu\nSeries",
    art: "a6",
  },
];

// The flagship show anchors the Live page and dashboard defaults.
export const PRIMARY_SHOW_KEY = SHOWS[0].key;

// ---- Your YouTube channels -----------------------------------------------
// Leave channelId / handle empty for the demo (YouTube features render
// graceful empty states). Fill them in to pull live status + uploads.
// uploadsPlaylist is derived automatically from channelId.
export type BrandChannel = {
  key: string;
  name: string;
  handle: string;    // e.g. "@yourchannel" (leave "" for demo)
  channelId: string; // e.g. "UCxxxxxxxx" (leave "" for demo)
};

export const CHANNELS: BrandChannel[] = [
  { key: "live-show", name: "The Live Show", handle: "", channelId: "" },
  { key: "long-play", name: "Long Play", handle: "", channelId: "" },
  { key: "quick-takes", name: "Quick Takes", handle: "", channelId: "" },
];
