import "server-only";
import { getAdminAuth, adminConfigured } from "./firebaseAdmin";

// Verify a Firebase ID token for ANY signed-in member (not just admins/team).
// Used by the community feed so any logged-in user can post/comment/like.
export type CommunityUser = { uid: string; name: string; email: string | null; picture: string | null };

export async function verifyUser(request: Request): Promise<CommunityUser | null> {
  if (!adminConfigured) return null;
  const h = request.headers.get("authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  const auth = getAdminAuth();
  if (!auth || !token) return null;
  try {
    const d = await auth.verifyIdToken(token);
    return {
      uid: d.uid,
      name: (d.name as string) || d.email?.split("@")[0] || "Member",
      email: d.email || null,
      picture: (d.picture as string) || null,
    };
  } catch {
    return null;
  }
}
