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
