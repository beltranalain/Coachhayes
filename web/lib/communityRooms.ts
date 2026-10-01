// Locker Room sections (client-safe). Gated rooms require a paid membership
// tier — the Film Room is unlocked by The Coordinator (or the team).
export type MinTier = "coordinator" | "timmy";
export type Room = { key: string; label: string; gated: boolean; minTier?: MinTier };
export const ROOMS: Room[] = [
  { key: "general", label: "Feed", gated: false },
  { key: "film", label: "Film Room", gated: true, minTier: "coordinator" },
];
export const isRoom = (k: string) => ROOMS.some((r) => r.key === k);
export const roomGated = (k: string) => ROOMS.find((r) => r.key === k)?.gated ?? false;
export const roomMinTier = (k: string): MinTier | null => ROOMS.find((r) => r.key === k)?.minTier ?? null;

// Tier ranking — higher unlocks lower. Coordinator is the top community tier.
const TIER_RANK: Record<string, number> = { timmy: 1, coordinator: 2 };
// Does `tier` satisfy the room's minimum? (team members pass separately.)
export function tierMeets(tier: string | null | undefined, min: MinTier | null): boolean {
  if (!min) return true;
  if (!tier) return false;
  return (TIER_RANK[tier] || 0) >= (TIER_RANK[min] || 0);
}
