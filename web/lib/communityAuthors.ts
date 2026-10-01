import "server-only";

// Live author identity for community content. Posts/comments store a snapshot of
// the author name/picture at write time; we overlay the member's current profile
// (name + avatar) at read time so edits show everywhere without bloating docs.
export type AuthorInfo = { name: string | null; avatar: string | null };

export async function authorMap(db: FirebaseFirestore.Firestore, uids: (string | undefined)[]): Promise<Record<string, AuthorInfo>> {
  const ids = Array.from(new Set(uids.filter((u): u is string => !!u)));
  if (!ids.length) return {};
  const map: Record<string, AuthorInfo> = {};
  try {
    const refs = ids.map((id) => db.collection("profiles").doc(id));
    const snaps = await db.getAll(...refs);
    snaps.forEach((s) => { if (s.exists) { const d = s.data() || {}; map[s.id] = { name: d.name || null, avatar: d.avatar || null }; } });
  } catch {}
  return map;
}

// Apply the live profile identity onto a row that has { uid, author, picture }.
export function withLiveAuthor<T extends { uid?: string; author?: string; picture?: string | null }>(row: T, map: Record<string, AuthorInfo>): T {
  const a = row.uid ? map[row.uid] : undefined;
  if (!a) return row;
  return { ...row, author: a.name || row.author, picture: a.avatar ?? row.picture ?? null };
}
