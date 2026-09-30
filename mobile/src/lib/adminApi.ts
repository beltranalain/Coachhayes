// Thin client over the website's admin API routes, mirroring lib/api.ts but for
// the authenticated Studio endpoints. Every request carries the signed-in
// admin's Firebase ID token as a Bearer, exactly like the website's fetches.
//
// These call the SAME backend the website uses (API_BASE), so the schedule,
// tips, costs and health an admin sees here match the site's Studio.

import { API_BASE } from "./config";
import { getFirebaseAuth } from "./firebase";
import type { ScheduleItem } from "./api";

// ---- Auth header ------------------------------------------------------------
async function authHeader(): Promise<Record<string, string>> {
  const token = await getFirebaseAuth().currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function getAuthedJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: await authHeader(),
    cache: "no-store" as RequestCache,
  });
  if (res.status === 401) throw new Error("not-authorized");
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return (await res.json()) as T;
}

// ---- Tips -------------------------------------------------------------------
export type TipEntry = { name: string; amount: number; message: string; ts: number };
export type TipsResponse = {
  configured: boolean;
  total: number;
  count?: number;
  tips: TipEntry[];
};

export function fetchAdminTips(): Promise<TipsResponse> {
  return getAuthedJSON<TipsResponse>("/api/admin/tips");
}

// ---- Usage / costs ----------------------------------------------------------
export type CostBreakdown = { key?: string; name: string; detail: string; cost: number | null; free: boolean };
export type CostEstimate = {
  perShow: number;
  perMonth: number;
  typicalViewers: number;
  avgShowMinutes: number;
  showsPerMonth: number;
};
export type UsageResponse = {
  configured?: boolean;
  total: number;
  budget: number;
  breakdown: CostBreakdown[];
  estimate: CostEstimate;
  prices: { storagePer1k: number; deliveryPer1k: number };
};

export function fetchAdminUsage(): Promise<UsageResponse> {
  return getAuthedJSON<UsageResponse>("/api/admin/usage");
}

// ---- Health -----------------------------------------------------------------
export type HealthStatus = "ok" | "fail" | "off";
export type HealthResponse = {
  firebase: HealthStatus;
  youtube: HealthStatus;
  stream: HealthStatus;
  chat: HealthStatus;
  stripe: HealthStatus;
  resend: HealthStatus;
};

export function fetchAdminHealth(): Promise<HealthResponse> {
  return getAuthedJSON<HealthResponse>("/api/admin/health");
}

// ---- Roles / RBAC -----------------------------------------------------------
// Mirrors the web RBAC. The server (whoami/team + gated APIs) is the source of
// truth; the client resolves the caller's role to shape the nav and gate
// screens. Roles: "owner" | "manager" | "host" | "moderator".
export type Role = "owner" | "manager" | "host" | "moderator";

export type Whoami = { email: string; role: Role; isOwner: boolean };

// Resolve the signed-in user's identity + role. Throws "not-authorized" when
// the account is not on the team (server returns 401 with role: null).
export function fetchWhoami(): Promise<Whoami> {
  return getAuthedJSON<Whoami>("/api/admin/whoami");
}

export type TeamMember = { email: string; role: Role; protected: boolean };
export type TeamResponse = {
  configured: boolean;
  members: TeamMember[];
  me: { email: string; role: Role; isOwner: boolean };
};

export function fetchTeam(): Promise<TeamResponse> {
  return getAuthedJSON<TeamResponse>("/api/admin/team");
}

export type TeamAction = "add" | "remove" | "setRole";
export type TeamSaveResult = {
  ok?: boolean;
  demo?: boolean;
  members?: TeamMember[];
  error?: string;
};

// Owner-only add/remove/setRole. Mirrors POST /api/admin/team.
export async function saveTeamMember(
  action: TeamAction,
  email: string,
  role?: Role
): Promise<TeamSaveResult> {
  const res = await fetch(`${API_BASE}/api/admin/team`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ action, email, ...(role ? { role } : {}) }),
  });
  if (res.status === 401) throw new Error("not-authorized");
  const json = (await res.json().catch(() => ({}))) as TeamSaveResult;
  if (!res.ok && !json?.error) throw new Error(`Request failed: ${res.status}`);
  return json;
}

// ---- Client-side capability matrix (mirrors the web matrix) -----------------
// Which app admin screens each role may open. Defense-in-depth only; the server
// still enforces access on every gated API.
export type AdminScreen = "schedule" | "tips" | "costs" | "settings" | "team";

export function canAccess(role: Role | null | undefined, screen: AdminScreen): boolean {
  if (!role) return false;
  switch (screen) {
    case "team":
      return role === "owner";
    case "schedule":
      return role === "owner" || role === "manager" || role === "host";
    case "tips":
    case "costs":
    case "settings":
      return role === "owner" || role === "manager";
    default:
      return false;
  }
}

// ---- Schedule save ----------------------------------------------------------
// Persist the full schedule array via the shared site-config endpoint. The web
// sends { section: "schedule", data: { items } }; we mirror that exactly.
export type SaveResult = { saved?: boolean; demo?: boolean; error?: string };

export async function saveSchedule(items: ScheduleItem[]): Promise<SaveResult> {
  const res = await fetch(`${API_BASE}/api/site-config`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ section: "schedule", data: { items } }),
  });
  if (res.status === 401) throw new Error("not-authorized");
  const json = (await res.json().catch(() => ({}))) as SaveResult;
  if (!res.ok && !json?.error) throw new Error(`Request failed: ${res.status}`);
  return json;
}

// ---- Timezone helpers (mirrors web admin/schedule) --------------------------
export const TZ_OPTIONS = [
  { id: "America/New_York", label: "Eastern (ET)" },
  { id: "America/Chicago", label: "Central (CT)" },
  { id: "America/Denver", label: "Mountain (MT)" },
  { id: "America/Los_Angeles", label: "Pacific (PT)" },
];

// Interpret a wall-clock string ("2026-09-11T20:00") as a time in `tz` and
// return the UTC epoch ms (DST-correct via Intl). Same math as the website.
export function wallClockToEpoch(local: string, tz: string): number {
  const naive = new Date(local + ":00Z").getTime();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(naive)
    .reduce((a: Record<string, string>, p) => {
      a[p.type] = p.value;
      return a;
    }, {});
  const asTz = Date.UTC(
    +parts.year,
    +parts.month - 1,
    +parts.day,
    +parts.hour,
    +parts.minute,
    +parts.second
  );
  return naive - (asTz - naive);
}

export function fmtWhen(epoch: number, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(epoch);
  } catch {
    return new Date(epoch).toLocaleString();
  }
}
