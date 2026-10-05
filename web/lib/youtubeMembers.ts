import "server-only";
import { getAdminDb } from "./firebaseAdmin";

// YouTube channel memberships -> platform access. The channel OWNER authorizes
// once (OAuth, offline) so we can read the member list; each member then links
// their YouTube account to claim the matching tier here. We never see or touch
// billing — we only read who is a current member and at what level.
//
// Setup: set YOUTUBE_OAUTH_CLIENT_ID + YOUTUBE_OAUTH_CLIENT_SECRET, then the
// owner clicks "Connect" in admin (stores a refresh token in Firestore).

// The client ID isn't secret (it's used in the browser too), so it can live in
// the public env var; only the secret must stay server-side.
const CLIENT_ID = process.env.YOUTUBE_OAUTH_CLIENT_ID || process.env.NEXT_PUBLIC_YOUTUBE_OAUTH_CLIENT_ID || "";
const CLIENT_SECRET = process.env.YOUTUBE_OAUTH_CLIENT_SECRET || "";
export const ytOAuthConfigured = Boolean(CLIENT_ID && CLIENT_SECRET);

const YT = "https://www.googleapis.com/youtube/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

// Owner scope (read the channel's member list + levels).
export const OWNER_SCOPE = "https://www.googleapis.com/auth/youtube.channel-memberships.creator";
// Member scope (read the linking member's own channel id).
export const MEMBER_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";

const CONFIG_DOC = "integrations/youtube";

export type YtConfig = {
  refreshToken?: string;
  connectedAt?: number;
  connectedChannelTitle?: string;
  mapping?: Record<string, string>; // YouTube levelId -> platform tier
  defaultTier?: string;             // tier granted to any current member w/o a mapping
  lastSyncAt?: number;
  memberCount?: number;
  levels?: Array<{ id: string; name: string }>;
  levelCounts?: Record<string, number>; // levelId -> count
};

export type YtMember = { channelId: string; displayName: string; level: string; levelId: string; since: string };

async function configRef() {
  const db = getAdminDb();
  if (!db) return null;
  const [col, id] = CONFIG_DOC.split("/");
  return db.collection(col).doc(id);
}

export async function getYtConfig(): Promise<YtConfig | null> {
  const ref = await configRef();
  if (!ref) return null;
  const snap = await ref.get();
  return snap.exists ? (snap.data() as YtConfig) : {};
}

export async function saveYtConfig(patch: Partial<YtConfig>): Promise<void> {
  const ref = await configRef();
  if (!ref) return;
  await ref.set(patch, { merge: true });
}

export async function isYtConnected(): Promise<boolean> {
  const cfg = await getYtConfig();
  return Boolean(cfg?.refreshToken);
}

// ---- OAuth ----

export function consentUrl(redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: OWNER_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${p.toString()}`;
}

// Exchange an auth code for tokens (returns the long-lived refresh token).
export async function exchangeCode(code: string, redirectUri: string): Promise<{ refreshToken?: string; accessToken?: string } | null> {
  try {
    const r = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return { refreshToken: d.refresh_token, accessToken: d.access_token };
  } catch {
    return null;
  }
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const r = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refreshToken, grant_type: "refresh_token" }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.access_token || null;
  } catch {
    return null;
  }
}

// A fresh owner access token from the stored refresh token.
export async function ownerAccessToken(): Promise<string | null> {
  const cfg = await getYtConfig();
  if (!cfg?.refreshToken) return null;
  return refreshAccessToken(cfg.refreshToken);
}

// ---- YouTube membership reads (owner token) ----

export async function listLevels(token: string): Promise<Array<{ id: string; name: string }>> {
  try {
    const r = await fetch(`${YT}/membershipsLevels?part=id,snippet`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.items || []).map((it: any) => ({
      id: it.id,
      name: it.snippet?.levelDetails?.displayName || it.snippet?.displayName || "Level",
    }));
  } catch {
    return [];
  }
}

// Every current member (paginated). channelId + display name + their level.
export async function listMembers(token: string): Promise<YtMember[]> {
  const out: YtMember[] = [];
  let pageToken = "";
  try {
    do {
      const u = `${YT}/members?part=snippet&maxResults=1000&mode=all_current${pageToken ? `&pageToken=${pageToken}` : ""}`;
      const r = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) break;
      const d = await r.json();
      for (const it of d.items || []) {
        const md = it.snippet?.memberDetails || {};
        const ms = it.snippet?.membershipsDetails || {};
        if (!md.channelId) continue;
        out.push({
          channelId: md.channelId,
          displayName: md.displayName || "",
          level: ms.highestAccessibleLevelDisplayName || "",
          levelId: ms.highestAccessibleLevel || "",
          since: ms.membershipsDuration?.memberSince || "",
        });
      }
      pageToken = d.nextPageToken || "";
    } while (pageToken && out.length < 20000);
  } catch {
    /* return what we have */
  }
  return out;
}

// Is a specific channel a current member? Returns their level if so.
export async function checkMember(token: string, channelId: string): Promise<{ isMember: boolean; level: string; levelId: string } | null> {
  try {
    const u = `${YT}/members?part=snippet&mode=all_current&filterByMemberChannelId=${encodeURIComponent(channelId)}`;
    const r = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const d = await r.json();
    const it = (d.items || [])[0];
    if (!it) return { isMember: false, level: "", levelId: "" };
    const ms = it.snippet?.membershipsDetails || {};
    return { isMember: true, level: ms.highestAccessibleLevelDisplayName || "", levelId: ms.highestAccessibleLevel || "" };
  } catch {
    return null;
  }
}

// ---- Member side ----

// The linking member's own channel id, from their Google access token (scope
// youtube.readonly). Trusted because WE call the API with their token.
export async function memberChannel(memberToken: string): Promise<{ id: string; title: string } | null> {
  try {
    const r = await fetch(`${YT}/channels?part=id,snippet&mine=true`, { headers: { Authorization: `Bearer ${memberToken}` } });
    if (!r.ok) return null;
    const d = await r.json();
    const it = (d.items || [])[0];
    if (!it?.id) return null;
    return { id: it.id, title: it.snippet?.title || "" };
  } catch {
    return null;
  }
}

// Map a YouTube level to a platform tier using the admin's mapping (falls back
// to defaultTier for any current member without an explicit mapping).
export function tierForLevel(cfg: YtConfig | null, levelId: string): string | null {
  const mapping = cfg?.mapping || {};
  if (levelId && mapping[levelId]) return mapping[levelId];
  return cfg?.defaultTier || "coordinator";
}
