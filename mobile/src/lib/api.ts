// Thin client over the website's public API routes. Native fetch is not subject
// to CORS, so we can call these Vercel routes directly and share the backend.

import { API_BASE } from "./config";

export type StreamStatus = { live: boolean };

export type ScheduleItem = {
  when: string;
  title: string;
  note: string;
  cover?: string;
  startsAt?: number; // epoch ms
  tz?: string;
};

export type SiteBranding = {
  siteName?: string;
  tagline?: string;
  logo?: string; // image URL or data-URL, or "" when unset
  accent?: string;
  channelBug?: string;
};

export type SiteConfig = {
  configured?: boolean;
  content?: { aboutText: string; emailGeneral: string; emailBooking: string };
  branding?: SiteBranding;
  schedule: ScheduleItem[];
  scene?: Record<string, unknown>;
};

export type YtVideo = {
  id: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
};

export type YoutubeResponse = {
  configured: boolean;
  channel?: string;
  items?: YtVideo[];
};

async function getJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return (await res.json()) as T;
}

// ---- Rankings + evaluations -------------------------------------------------
export type ChipKey = "bronze" | "silver" | "gold" | "blue";
export type Categories = Partial<Record<"power" | "speed" | "motor" | "technique" | "iq", ChipKey>>;

export type RankPlayer = {
  slug: string; name: string; position: string; school: string; city: string; state: string;
  classYear: string; chip: ChipKey; chipLabel: string; categories: Categories | null;
  videoUrl: string; commit: string; commitLogo: string;
  hasEval: boolean; evalAccess: "none" | "free" | "locked"; evalPrice: string;
};

export type Evaluation = {
  size: string; speed: string; effort: string; positionAnalysis: string;
  strengths: string[]; improvements: string[]; recommendedTargets: string[];
  additionalComments: string; developmentPriorities: string[]; finalAssessment: string;
  projection: string; evaluatedOn: string;
};
export type EvalResponse = {
  hasEval: boolean; locked?: boolean; evaluation?: Evaluation;
  teaser?: string; price?: string; evaluatedOn?: string;
};

// Public board feed (published players, no evaluation content).
export function fetchPlayers(): Promise<{ players: RankPlayer[] }> {
  return getJSON<{ players: RankPlayer[] }>("/api/rankings/players");
}

// Paywall-gated evaluation. Pass the signed-in user's ID token so admins /
// unlocked viewers get the full report; everyone else gets the teaser.
export async function fetchEvaluation(slug: string, token?: string | null): Promise<EvalResponse> {
  const res = await fetch(`${API_BASE}/api/rankings/evaluation?slug=${encodeURIComponent(slug)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return { hasEval: false };
  return (await res.json()) as EvalResponse;
}

// Pull a YouTube video id from a URL (for the thumbnail + inline player). Hudl
// and other links return null — the card then uses a gradient poster.
export function youtubeId(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// ---- Community feed ---------------------------------------------------------
export type FeedPost = {
  id: string; uid: string; author: string; picture: string | null; text: string;
  ts: number; likes: number; commentCount: number; room: string;
  image: string | null; clip: string | null; kind: string | null;
  player: any | null; show: any | null;
};

export function fetchFeed(room = "general"): Promise<{ posts: FeedPost[] }> {
  return getJSON<{ posts: FeedPost[] }>(`/api/community/posts?room=${encodeURIComponent(room)}`);
}

// ---- Blog -------------------------------------------------------------------
export type BlogPost = { id: string; slug: string; title: string; excerpt: string; category: string; readMins: number; cover: string; publishedAt: number };
export function fetchBlog(): Promise<{ posts: BlogPost[] }> {
  return getJSON<{ posts: BlogPost[] }>("/api/blog");
}

// "3d" / "4h" / "now" style short relative time.
export function timeAgo(ts?: number): string {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7); if (w < 5) return `${w}w`;
  return `${Math.floor(d / 30)}mo`;
}

// Is the Cloudflare live input currently receiving a broadcast?
export function fetchStreamStatus(): Promise<StreamStatus> {
  return getJSON<StreamStatus>("/api/stream/status");
}

// Editable site config incl. the broadcast schedule (Firestore over defaults).
export function fetchSiteConfig(): Promise<SiteConfig> {
  return getJSON<SiteConfig>("/api/site-config");
}

// Past episodes from YouTube (server proxies the API key).
export function fetchUploads(): Promise<YoutubeResponse> {
  return getJSON<YoutubeResponse>("/api/youtube?type=uploads");
}

// Start a tip: returns a Stripe PaymentIntent client secret to feed the sheet.
export async function startTipCheckout(input: {
  amount: number;
  message: string;
  name: string;
  uid: string;
}): Promise<{ clientSecret?: string; error?: string }> {
  const res = await fetch(`${API_BASE}/api/tips/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return res.json();
}

// Upcoming (future) broadcasts from the schedule, soonest first.
export function upcoming(schedule: ScheduleItem[]): ScheduleItem[] {
  const now = Date.now();
  return schedule
    .filter((s) => typeof s.startsAt === "number" && (s.startsAt as number) > now)
    .sort((a, b) => (a.startsAt as number) - (b.startsAt as number));
}

// Human "in 1h 12m" style countdown from now to a future epoch ms.
export function countdownLabel(startsAt?: number): string {
  if (!startsAt) return "";
  const ms = startsAt - Date.now();
  if (ms <= 0) return "starting now";
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `in ${d}d ${h}h`;
  if (h > 0) return `in ${h}h ${m}m`;
  if (m > 0) return `in ${m}m ${s}s`;
  return `in ${s}s`;
}

export function formatWhen(item: ScheduleItem): string {
  if (item.startsAt) {
    try {
      return new Date(item.startsAt).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      /* fall through */
    }
  }
  return item.when || "";
}
