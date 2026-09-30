// ============================================================================
// Coach Hayes Football — Firestore data model (Phase 0)
// ============================================================================
// Types for every collection in BUILD_BRIEF.md. Fields are inferred from the
// brief's data model + the approved templates. This is the single source of
// truth for document shapes; API routes and lib helpers import from here.
//
// Conventions:
//  - `id` is the Firestore document id (not stored in the doc body).
//  - Timestamps are Firestore server timestamps; typed as `number` (ms epoch)
//    on the client after conversion.
//  - Money is stored in integer cents to avoid float drift.
//  - Anything server-only (keys, tokens) is a *Ref (a pointer/secret id), never
//    the secret itself — secrets live in env / a secret manager, never Firestore.
// ============================================================================

export type Role = "coach" | "coordinator" | "timmy" | "mod" | "admin";
export type MembershipTier = "timmy" | "coordinator";
export type MembershipStatus = "active" | "past_due" | "canceled" | "trialing";

// --- users -----------------------------------------------------------------
export interface User {
  id: string;
  authProvider: "google" | "password";
  displayName: string;
  handle: string; // @handle, unique
  avatar?: string; // Storage URL
  roles: Role[];
  discordUserId?: string;
  createdAt: number;
}

// --- memberships -----------------------------------------------------------
export interface Membership {
  id: string; // = userId
  userId: string;
  tier: MembershipTier;
  stripeCustomerId: string;
  stripeSubId: string;
  status: MembershipStatus;
  currentPeriodEnd: number;
  discordSynced: boolean; // role granted in Discord?
  youtubeLinked: boolean; // legacy YT member linked their perks
  createdAt: number;
}

// --- shows -----------------------------------------------------------------
export interface Show {
  id: string;
  key: string; // stable slug, links library/channels
  name: string;
  cadence: string; // e.g. "Mon 8pm ET"
  team: string; // the team this show covers (Miami, Colorado, UCF…)
  channel?: string; // YouTube channel id
  graphicsPreset?: string;
  visible: boolean;
  thumbnail?: string;
}

// --- broadcasts ------------------------------------------------------------
export type BroadcastStatus = "scheduled" | "live" | "ended";
export interface Broadcast {
  id: string;
  showId: string;
  title: string;
  scheduledAt: number;
  status: BroadcastStatus;
  inputs: {
    whipInputUid?: string; // Cloudflare input A (studio → WHIP)
    rtmpsInputUid?: string; // Cloudflare input B (site player + VOD)
  };
  recordingId?: string; // Cloudflare Stream VOD uid
  chapters?: { at: number; label: string }[];
  startedAt?: number;
  endedAt?: number;
}

// --- destinations (PER-SHOW routing — the differentiator) -------------------
export type DestPlatform = "youtube" | "facebook" | "twitch" | "custom";
export interface Destination {
  id: string;
  showId: string; // destinations belong to SHOWS, not the account
  platform: DestPlatform;
  url: string; // RTMP(S) ingest URL
  keyRef: string; // pointer to the stream key secret (never the key itself)
  enabled: boolean;
}

// --- posts / rooms (community) ---------------------------------------------
export interface Room {
  id: string;
  name: string;
  public: boolean; // drives indexing (public = server-rendered + indexable)
  minTier?: MembershipTier; // gate; gated rooms are noindex
}
export interface Post {
  id: string;
  authorId: string;
  body: string;
  mediaRef?: string; // Storage/Stream ref
  room: string; // roomId
  visibility: "public" | "members" | MembershipTier;
  reactions: Record<string, number>; // e.g. { fire: 412 }
  createdAt: number;
}

// --- players / grades / submissions (rankings) ------------------------------
// MINORS: expose only school, position, classYear. Never contact/home address.
export interface Player {
  id: string;
  name: string;
  position: string;
  school: string;
  classYear: string; // e.g. "2026"
  slug: string; // server-rendered page
  removed?: boolean; // set by removal-request flow; hides the page
}
export interface Grade {
  id: string;
  playerId: string;
  chips: { power: number; speed: number; motor: number; technique: number; iq: number };
  notes?: string;
  videoId?: string; // Cloudflare Stream (gated) or YouTube (public breakdown)
  published: boolean;
}
export type SubmissionStatus = "new" | "queued" | "reviewed" | "removed";
export interface Submission {
  id: string;
  playerName: string;
  film: string; // URL to film
  submitterId: string;
  status: SubmissionStatus;
  priority: number;
  createdAt: number;
}

// --- removal requests (minors protection — day one) -------------------------
export interface RemovalRequest {
  id: string;
  playerId?: string;
  playerName: string;
  requesterEmail: string;
  relationship: string;
  reason?: string;
  status: "open" | "actioned" | "rejected";
  createdAt: number;
}

// --- fantasy (tracking ONLY — NO entry-fee processing) ----------------------
export interface LeagueLevel {
  id: string;
  name: string;
  entry: number; // cents — displayed, NOT charged on-platform
  prize: number; // cents
  seats: number;
  filled: number;
}
export type PaymentStatus = "unpaid" | "paid_offplatform" | "waived";
export interface Entrant {
  id: string;
  userId: string;
  levelId: string;
  email: string;
  paymentStatus: PaymentStatus; // status tracking only
  inviteSent: boolean; // Fantrax invite automation
  createdAt: number;
}

// --- products / orders (merch) ---------------------------------------------
export interface Product {
  id: string;
  name: string;
  price: number; // cents
  memberPrice: number; // cents (member discount)
  colourways: string[];
  printProviderId: string; // Printful/Printify product id
  image?: string;
  visible: boolean;
}
export type OrderStatus = "pending" | "paid" | "fulfilling" | "shipped" | "canceled";
export interface Order {
  id: string;
  userId: string;
  items: { productId: string; colourway?: string; qty: number; unit: number }[];
  status: OrderStatus;
  stripePaymentIntent?: string;
  fulfilmentId?: string; // POD provider order id
  createdAt: number;
}

// --- tips ------------------------------------------------------------------
export interface Tip {
  id: string;
  userId?: string;
  amount: number; // cents
  method: "stripe";
  broadcastId?: string;
  message?: string;
  createdAt: number;
}

// Collection name constants (avoid string typos across the codebase).
export const COLLECTIONS = {
  users: "users",
  memberships: "memberships",
  shows: "shows",
  broadcasts: "broadcasts",
  destinations: "destinations",
  posts: "posts",
  rooms: "rooms",
  players: "players",
  grades: "grades",
  submissions: "submissions",
  removalRequests: "removalRequests",
  leagueLevels: "leagueLevels",
  entrants: "entrants",
  products: "products",
  orders: "orders",
  tips: "tips",
} as const;
