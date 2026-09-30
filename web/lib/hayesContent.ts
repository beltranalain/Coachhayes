// ============================================================================
// Hayes public-site content model
// ============================================================================
// The SINGLE source of truth for every editable string, number, tile, tier,
// chip and level on the public site. Components render from this — they contain
// NO hardcoded copy. Defaults below are the client-approved template copy; the
// admin Content panel writes overrides to Firestore `site/hayes`, and
// getHayesContent() merges those over these defaults (see lib/siteConfig.ts).
//
// Anything the creator should be able to change lives here, not in a component.
// ============================================================================

export type Stat = { value: string; label: string };
// `art` = a gradient art-well class (a1..a6) used when `image` is empty.
// `image` = an admin-uploaded image URL that overrides the gradient.
export type Tile = { key: string; kicker: string; title: string; blurb: string; href: string; art: string; image?: string };

export type HomeContent = {
  heroTag: string;
  ctaPrimary: string;
  ctaSecondary: string;
  statsEnabled: boolean;   // admin can hide the stat row entirely
  stats: Stat[];
  comingSoonTitle: string; // hero placeholder when off air
  onAirCaption: string;
  offAirCaption: string;
  stageSub: string;
  tilesHeading: string;
  tilesIntro: string;
  tiles: Tile[];
  weekHeading: string;
  weekIntro: string;
};

export type LiveContent = {
  showLabelSuffix: string; // e.g. "· Live" appended to the site name
  onAirHeadline: string;
  offAirHeadline: string;
  watchYouTubeLabel: string;
  callInLabel: string;
  pastLabel: string;
  ownPlatformNote: string;
  youtubeFallbackNote: string;
};

export type Tier = {
  key: string;
  name: string;
  who: string;
  price: string;
  priceSuffix: string;
  feeline: string;
  features: string[];
  cta: string;
  highlight: boolean;
  disabled: boolean; // checkout not live yet
};

export type MembershipContent = {
  heading: string;
  intro: string;
  tiers: Tier[];
  ytCardTitle: string;
  ytCardText: string;
  ytCardCta: string;
};

export type Chip = { key: string; name: string; ring: string; blurb: string };

export type RankingsContent = {
  kicker: string;
  title1: string;
  title2: string;
  dek: string;
  stats: Stat[];
  chips: Chip[];
  chipNote: string;
  emptyTitle: string;
  emptyText: string;
};

export type Level = { key: string; entry: number; prize: number; seats: number; filled: number; highlight: boolean };
export type Step = { n: string; text: string };

export type FantasyContent = {
  leagueName: string;
  heading: string;
  levelsHeading: string;
  levelsIntro: string;
  seasonNote: string;
  levels: Level[];
  joinLabel: string;
  steps: Step[];
  legal: string;
  freeGameTitle: string;
  freeGameText: string;
  freeGameCta: string;
};

export type CommunityNavItem = { key: string; label: string; lock?: string };

export type CommunityContent = {
  nav: CommunityNavItem[];
  signInCta: string;
  composerPlaceholder: string;
  emptyTitle: string;
  emptyText: string;
  emptyCta: string;
  watchTitle: string;
  watchText: string;
  watchCta: string;
  roomsTitle: string;
  roomsText: string;
};

export type ShopContent = {
  heading: string;
  intro: string;
  emptyTitle: string;
  emptyText: string;
  memberCta: string;
};

export type FooterLink = { label: string; href: string };
export type FooterColumn = { key: string; heading: string; links: FooterLink[] };
export type FooterContent = { columns: FooterColumn[]; legal: string[] };

export type HayesContent = {
  home: HomeContent;
  live: LiveContent;
  membership: MembershipContent;
  rankings: RankingsContent;
  fantasy: FantasyContent;
  community: CommunityContent;
  shop: ShopContent;
  footer: FooterContent;
};

// --- Chip ring colors from the approved rankings design -----------------------
const RING_GOLD = "#F5C542";
const RING_BLUE = "#2D6BFF";

export const DEFAULT_HAYES: HayesContent = {
  home: {
    heroTag: "Five shows a week, a fantasy league, a locker room, and film that actually explains the game.",
    ctaPrimary: "Watch live",
    ctaSecondary: "Go to the community",
    // Honest defaults (not fake counts). The admin edits these; a creator can
    // wire real counts (players graded, members, managers) once data exists.
    statsEnabled: true,
    stats: [
      { value: "5", label: "Shows a week" },
      { value: "2", label: "Ways to watch, one stream" },
      { value: "$0", label: "To get started" },
      { value: "1", label: "Login for everything" },
    ],
    comingSoonTitle: "Stream coming soon",
    onAirCaption: "We’re live right now",
    offAirCaption: "Catch the next broadcast",
    stageSub: "Streams here and on YouTube at the same time",
    tilesHeading: "Everything in one place.",
    tilesIntro: "The shows, the conversation, the league and the gear. No more chasing links across five platforms.",
    // `art` uses the on-brand gradient wells (no stock photos). `image` is empty
    // by default and can be set per-tile in the admin.
    tiles: [
      { key: "shows", kicker: "Live · Wednesdays", title: "The shows", blurb: "Five a week on Miami, Colorado, UCF and everything else. Live here and on the channel at the same second.", href: "/live", art: "a2", image: "" },
      { key: "community", kicker: "Members and free", title: "The community", blurb: "Talk football with people who actually watch the tape. Threads, not a firehose.", href: "/community", art: "a1", image: "" },
      { key: "fantasy", kicker: "Free to play", title: "Fantasy league", blurb: "Salary cap, shared player pool, weekly leaderboard. No draft night to schedule.", href: "/fantasy", art: "a3", image: "" },
      { key: "shop", kicker: "Ships in days", title: "The shop", blurb: "Po’ Lil Timmy and the rest. Now on this site, not somebody else’s.", href: "/shop", art: "a4", image: "" },
    ],
    weekHeading: "The week.",
    weekIntro: "Follow the shows you actually watch. One note an hour before each goes live.",
  },

  live: {
    showLabelSuffix: "· Live",
    onAirHeadline: "We’re on the air",
    offAirHeadline: "Off air — the next show streams here automatically",
    watchYouTubeLabel: "Watch on YouTube",
    callInLabel: "Request a call-in",
    pastLabel: "Past broadcasts",
    ownPlatformNote: "Playing on the owned player (Cloudflare Stream), simulcasting to YouTube at the same time.",
    youtubeFallbackNote: "Showing the YouTube live embed until Cloudflare Stream is fully wired; then this becomes the owned player with YouTube as the simulcast.",
  },

  membership: {
    heading: "Join the team.",
    intro: "Same two tiers Coach has always run, on this site instead of through a platform that takes a cut. One login covers the site, the apps, the community and Discord.",
    tiers: [
      {
        key: "free", name: "Free", who: "Everything public.", price: "$0", priceSuffix: "", feeline: "No card needed",
        features: ["Every live show", "The full archive", "Public community rooms", "Fantasy league", "Show reminders"],
        cta: "Create an account", highlight: false, disabled: false,
      },
      {
        key: "timmy", name: "Po’ Lil Timmy", who: "For the regulars.", price: "$4.99", priceSuffix: "/ month", feeline: "Price to be confirmed",
        features: ["Loyalty badge next to your name", "Custom emojis", "Member shout-outs on air", "Priority replies from Coach", "Members-only community rooms", "10% off everything in the shop"],
        cta: "Join", highlight: false, disabled: true,
      },
      {
        key: "coordinator", name: "The Coordinator", who: "Everything, plus the film.", price: "$9.99", priceSuffix: "/ month", feeline: "Price to be confirmed",
        features: ["Everything in Po’ Lil Timmy", "Members-only videos", "The Locker Room, here and on Discord", "Early video drops", "The postgame room after every show", "Priority in the call-in queue", "Front of the line on film submissions"],
        cta: "Join", highlight: true, disabled: true,
      },
    ],
    ytCardTitle: "Already a YouTube member?",
    ytCardText: "Nothing breaks. Link your account and your roles carry over here and in Discord. New members joining on this site keep more of their money with Coach.",
    ytCardCta: "Link my YouTube membership",
  },

  rankings: {
    kicker: "W.R.E. Player Rankings",
    title1: "Five chips. One grade.",
    title2: "Earned on film.",
    dek: "Every player is graded on five chips, earned one at a time on film. The overall only comes after all five have been looked at — no stars, no camp buzz, no offer counting.",
    stats: [
      { value: "5", label: "Chip categories" },
      { value: "On film", label: "Every grade" },
    ],
    chips: [
      { key: "power", name: "Power", ring: RING_GOLD, blurb: "Plays through contact, finishes runs, holds the point." },
      { key: "speed", name: "Speed", ring: RING_BLUE, blurb: "Gets to top gear, separates late, closes on the ball." },
      { key: "motor", name: "Motor", ring: RING_BLUE, blurb: "Effort on every snap, not just the ones on the highlight." },
      { key: "technique", name: "Technique", ring: RING_GOLD, blurb: "Hands, footwork, leverage. The coachable part." },
      { key: "iq", name: "Football IQ", ring: RING_BLUE, blurb: "Reads it before it happens and plays without hesitating." },
    ],
    chipNote: "Chip names to be confirmed with Coach; the finished build uses Coach’s own icons from the broadcasts.",
    emptyTitle: "Graded players will appear here",
    emptyText: "Each player gets a server-rendered page with their five chips and the film. Submit film through the show; the rankings publish in the rankings phase.",
  },

  fantasy: {
    leagueName: "Coach Hayes Football League · Salary cap · Shared player pool",
    heading: "Fantasy",
    levelsHeading: "The three levels",
    levelsIntro: "Ten managers per level. Same rules, different stakes.",
    seasonNote: "2026 season — amounts to be confirmed",
    levels: [
      { key: "l25", entry: 25, prize: 225, seats: 10, filled: 7, highlight: false },
      { key: "l50", entry: 50, prize: 450, seats: 10, filled: 9, highlight: true },
      { key: "l100", entry: 100, prize: 900, seats: 10, filled: 4, highlight: false },
    ],
    joinLabel: "Join this level",
    steps: [
      { n: "1", text: "Pick your level and enter your email — no more putting it in a CashApp memo." },
      { n: "2", text: "Pay however you already do. Coach marks you paid in the admin." },
      { n: "3", text: "Your Fantrax invite goes out automatically. No manual emails, nothing lost to spam." },
    ],
    legal: "Paid entry with cash prizes is regulated and varies by state. This flow tracks entrants and payment status; it does not process entry fees.",
    freeGameTitle: "Not in a paid level?",
    freeGameText: "Everyone else plays the free weekly game. Same player pool, one leaderboard, merch for the weekly winner.",
    freeGameCta: "Play the weekly game",
  },

  community: {
    nav: [
      { key: "feed", label: "Feed" },
      { key: "film", label: "Film Room", lock: "Coordinator" },
      { key: "notifs", label: "Notifications" },
      { key: "saved", label: "Saved" },
      { key: "profile", label: "Your profile" },
    ],
    signInCta: "Sign in to post",
    composerPlaceholder: "Sign in to say something about the game",
    emptyTitle: "The Locker Room opens soon",
    emptyText: "Threads, film clips and polls with people who actually watch the tape — public rooms for everyone, members-only rooms for The Coordinator. The feed goes live in the community phase.",
    emptyCta: "See membership",
    watchTitle: "Watch live",
    watchText: "The show streams here and on YouTube at the same time.",
    watchCta: "Go to the live page",
    roomsTitle: "Rooms",
    roomsText: "Public rooms are open to everyone and indexed by search. Gated rooms unlock with The Coordinator.",
  },

  shop: {
    heading: "The shop.",
    intro: "Po’ Lil Timmy and the rest — now on this site, not somebody else’s. Members save 10% on everything.",
    emptyTitle: "The store is being set up",
    emptyText: "Print-on-demand gear, checkout on this domain, and automatic member pricing. The catalog goes live in the merch phase.",
    memberCta: "Members save 10% — see membership",
  },

  footer: {
    columns: [
      { key: "watch", heading: "Watch", links: [
        { label: "Live", href: "/live" }, { label: "Shows", href: "/shows" },
        { label: "Schedule", href: "/live" }, { label: "Archive", href: "/library" },
      ] },
      { key: "teams", heading: "Teams", links: [
        { label: "Miami", href: "/live" }, { label: "Colorado", href: "/live" },
        { label: "UCF", href: "/live" }, { label: "All CFB", href: "/live" },
      ] },
      { key: "play", heading: "Play", links: [
        { label: "Fantasy league", href: "/fantasy" }, { label: "Leaderboard", href: "/fantasy" },
        { label: "Rules", href: "/fantasy" },
      ] },
      { key: "community", heading: "Community", links: [
        { label: "The Locker Room", href: "/community" }, { label: "Discord", href: "/community" },
        { label: "Rules", href: "/community" },
      ] },
      { key: "more", heading: "More", links: [
        { label: "Shop", href: "/shop" }, { label: "Membership", href: "/membership" },
        { label: "Contact", href: "/contact" },
      ] },
    ],
    legal: [
      "Film analysis and opinion.",
      "Not affiliated with or endorsed by any university or athletic program.",
    ],
  },
};
