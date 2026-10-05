import { NextResponse } from "next/server";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";
import { requireRole } from "@/lib/requireAdmin";
import {
  ytOAuthConfigured, getYtConfig, saveYtConfig, ownerAccessToken,
  listMembers, listLevels,
} from "@/lib/youtubeMembers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function gate(request: Request) {
  if (!adminConfigured) return { error: NextResponse.json({ error: "Not configured." }, { status: 400 }) };
  const role = await requireRole(request);
  if (!role || !["owner", "manager"].includes(role)) return { error: NextResponse.json({ error: "Not authorized." }, { status: 401 }) };
  const db = getAdminDb();
  if (!db) return { error: NextResponse.json({ error: "No database." }, { status: 500 }) };
  return { db };
}

// GET — connection status + current mapping + last sync summary.
export async function GET(request: Request) {
  const g = await gate(request); if (g.error) return g.error;
  const cfg = await getYtConfig();
  return NextResponse.json({
    configured: ytOAuthConfigured,
    connected: Boolean(cfg?.refreshToken),
    connectedChannelTitle: cfg?.connectedChannelTitle || "",
    memberCount: cfg?.memberCount || 0,
    levels: cfg?.levels || [],
    levelCounts: cfg?.levelCounts || {},
    mapping: cfg?.mapping || {},
    defaultTier: cfg?.defaultTier || "coordinator",
    lastSyncAt: cfg?.lastSyncAt || 0,
  });
}

// POST { action: "sync" | "mapping" | "disconnect", ... }
export async function POST(request: Request) {
  const g = await gate(request); if (g.error) return g.error;
  let b: any; try { b = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const action = String(b.action || "");

  if (action === "disconnect") {
    await saveYtConfig({ refreshToken: "", connectedAt: 0, connectedChannelTitle: "", memberCount: 0, levelCounts: {} });
    return NextResponse.json({ ok: true });
  }

  if (action === "mapping") {
    const mapping: Record<string, string> = {};
    if (b.mapping && typeof b.mapping === "object") {
      for (const [k, v] of Object.entries(b.mapping)) {
        const tier = String(v);
        if (tier === "timmy" || tier === "coordinator") mapping[String(k)] = tier;
      }
    }
    const defaultTier = b.defaultTier === "timmy" ? "timmy" : "coordinator";
    await saveYtConfig({ mapping, defaultTier });
    return NextResponse.json({ ok: true, mapping, defaultTier });
  }

  if (action === "sync") {
    if (!ytOAuthConfigured) return NextResponse.json({ error: "Add the YouTube connection keys first." }, { status: 400 });
    const token = await ownerAccessToken();
    if (!token) return NextResponse.json({ error: "Not connected — click Connect first." }, { status: 400 });
    const [members, levels] = await Promise.all([listMembers(token), listLevels(token)]);
    const levelCounts: Record<string, number> = {};
    for (const m of members) levelCounts[m.levelId || "unknown"] = (levelCounts[m.levelId || "unknown"] || 0) + 1;
    await saveYtConfig({ memberCount: members.length, levels, levelCounts, lastSyncAt: Date.now() });
    return NextResponse.json({ ok: true, memberCount: members.length, levels, levelCounts });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
