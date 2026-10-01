import "server-only";
import { getAdminDb, adminConfigured } from "./firebaseAdmin";
import type { MembershipTier, MembershipStatus } from "./schema";

// Server-side membership resolution. A member's tier lives in memberships/{uid};
// it's set by the Stripe webhook (when connected) or granted by an admin. Only
// active/trialing subscriptions count as unlocked.
const ACTIVE: MembershipStatus[] = ["active", "trialing"];

export type MemberInfo = { tier: MembershipTier | null; status: MembershipStatus | null };

export async function getMembership(uid: string): Promise<MemberInfo> {
  if (!adminConfigured || !uid) return { tier: null, status: null };
  const db = getAdminDb();
  if (!db) return { tier: null, status: null };
  try {
    const doc = await db.collection("memberships").doc(uid).get();
    if (!doc.exists) return { tier: null, status: null };
    const d = doc.data() || {};
    const status: MembershipStatus | null = d.status || null;
    const tier: MembershipTier | null = status && ACTIVE.includes(status) ? d.tier || null : null;
    return { tier, status };
  } catch {
    return { tier: null, status: null };
  }
}

// The tier we treat the caller as having for gating. Team members (owner/manager
// or any resolved role) always get the top tier so staff can work every room.
export function effectiveTier(memberTier: MembershipTier | null, isTeam: boolean): MembershipTier | null {
  if (isTeam) return "coordinator";
  return memberTier;
}
