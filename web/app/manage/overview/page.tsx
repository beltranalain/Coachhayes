import Link from "next/link";
import { getAllStats, getStatsByChannel, getLiveInfo, youtubeConfigured } from "@/lib/youtube";
import { getSiteConfig } from "@/lib/siteConfig";
import { formatCount } from "@/lib/format";
import { getAdminDb, getAdminAuth, adminConfigured } from "@/lib/firebaseAdmin";
import { getCostEstimate } from "@/lib/costEstimate";
import BarChart from "@/components/BarChart";
import Shell from "@/components/hayes/admin/Shell";

const money = (n: number) =>
  "$" + n.toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const DAYS = 14;
const dayMs = 86400000;

// Sum values into the last N days; index 0 = oldest, last = today.
function dailyBuckets(items: { ts: number; v: number }[], now: number) {
  const b = Array.from({ length: DAYS }, () => 0);
  for (const it of items) {
    const ago = Math.floor((now - it.ts) / dayMs);
    if (ago >= 0 && ago < DAYS) b[DAYS - 1 - ago] += it.v;
  }
  return b;
}

export default async function ManageOverview() {
  const { branding, channels } = await getSiteConfig();
  const [stats, byChannel, live, cost] = await Promise.all([
    getAllStats(channels.map((c) => c.channelId)),
    getStatsByChannel(channels.map((c) => c.channelId)),
    getLiveInfo(channels[0]?.channelId || ""),
    getCostEstimate(),
  ]);
  const now = Date.now();
  const dayLabels = Array.from({ length: DAYS }, (_, i) =>
    new Date(now - (DAYS - 1 - i) * dayMs).getDate().toString()
  );

  // Real revenue from the tips collection + real site users from Firebase Auth.
  // Nothing is fabricated - these stay at zero / empty until real data exists.
  let tips: { amount: number; ts: number }[] = [];
  let userTimes: number[] = [];
  let totalUsers = 0;
  if (adminConfigured) {
    try {
      const db = getAdminDb();
      const snap = await db?.collection("tips").orderBy("ts", "desc").limit(1000).get();
      tips = snap?.docs.map((d) => ({ amount: Number(d.data().amount) || 0, ts: Number(d.data().ts) || 0 })) ?? [];
    } catch { /* no tips yet */ }
    try {
      const auth = getAdminAuth();
      const res = await auth?.listUsers(1000);
      const users = res?.users ?? [];
      totalUsers = users.length;
      userTimes = users.map((u) => new Date(u.metadata.creationTime || 0).getTime()).filter(Boolean);
    } catch { /* auth not available */ }
  }

  const revenueTotal = tips.reduce((s, t) => s + t.amount, 0);
  const weekRevenue = tips.filter((t) => t.ts >= now - 7 * dayMs).reduce((s, t) => s + t.amount, 0);
  const newUsersWeek = userTimes.filter((t) => t >= now - 7 * dayMs).length;

  const dailyRevenue = dailyBuckets(tips.map((t) => ({ ts: t.ts, v: t.amount })), now);
  const dailyUsers = dailyBuckets(userTimes.map((ts) => ({ ts, v: 1 })), now);

  // Per-channel figures aligned to our channel order (real YouTube stats).
  const rows = channels.map((c) => {
    const s = byChannel.find((x) => x.channelId === c.channelId);
    return { label: c.name, subs: s?.subscribers ?? 0, views: s?.views ?? 0 };
  });

  return (
    <Shell
      title="Overview"
      sub="Your studio at a glance"
      brandName={branding.siteName}
      logo={branding.logo}
      actions={
        <>
          <span className={`live-pill${live.live ? " is-live" : ""}`}>
            <span className="dot" /><span>{live.live ? "Live now" : "Offline"}</span>
          </span>
          <Link className="btn btn-primary btn-sm" href="/manage/go-live">Go Live</Link>
        </>
      }
    >
      {!youtubeConfigured && (
        <div className="notice" style={{ marginBottom: 22 }}>
          <strong>YouTube not connected.</strong> Add YOUTUBE_API_KEY to fill in subscribers,
          views, and video counts across your connected channels.
        </div>
      )}

      {!adminConfigured && (
        <div className="notice" style={{ marginBottom: 22 }}>
          <strong>Site accounts not connected yet.</strong> Users and revenue show real numbers
          once Firebase Admin is configured - nothing is fabricated until then.
        </div>
      )}

      <div className="stat-grid g7">
        <div className="stat-card">
          <div className="k">Users</div>
          <div className="v">{adminConfigured ? formatCount(totalUsers) : "—"}</div>
          <div className="d flat">{adminConfigured ? (newUsersWeek > 0 ? `+${newUsersWeek} this week` : "Signed up on the site") : "Not connected yet"}</div>
        </div>
        <div className="stat-card">
          <div className="k">Subscribers</div>
          <div className="v">{formatCount(stats?.subscribers)}</div>
          <div className="d flat">YouTube, all channels</div>
        </div>
        <div className="stat-card">
          <div className="k">Total views</div>
          <div className="v">{formatCount(stats?.views)}</div>
          <div className="d flat">All-time</div>
        </div>
        <div className="stat-card">
          <div className="k">Videos</div>
          <div className="v">{formatCount(stats?.videos)}</div>
          <div className="d flat">Published on YouTube</div>
        </div>
        <div className="stat-card">
          <div className="k">Revenue</div>
          <div className="v">{adminConfigured ? money(revenueTotal) : "—"}</div>
          <div className="d flat">{adminConfigured ? (weekRevenue > 0 ? `${money(weekRevenue)} this week` : "Tips, all-time") : "Not connected yet"}</div>
        </div>
        <div className="stat-card">
          <div className="k">Est. cost / show</div>
          <div className="v">{money(Math.round(cost.estimate.perShow))}</div>
          <div className="d flat">~{cost.estimate.typicalViewers.toLocaleString()} viewers x {cost.estimate.avgShowMinutes} min</div>
        </div>
        <div className="stat-card">
          <div className="k">Live status</div>
          <div className="v">{live.live ? "On air" : "Off air"}</div>
          <div className="d flat">{live.viewers != null ? `${live.viewers.toLocaleString()} watching` : branding.siteName}</div>
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          <h3>Revenue</h3>
          <div className="panel-sub">
            Tips over the last {DAYS} days{revenueTotal > 0 ? ` - ${money(revenueTotal)} total` : ""}.
          </div>
          <BarChart data={dailyRevenue} labels={dayLabels} format={money} />
        </div>
        <div className="panel">
          <h3>New users</h3>
          <div className="panel-sub">
            People who signed up on the site, last {DAYS} days{totalUsers > 0 ? ` - ${totalUsers} total` : ""}.
          </div>
          <BarChart data={dailyUsers} labels={dayLabels} format={(n) => String(n)} />
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          <h3>Subscribers by channel</h3>
          <div className="panel-sub">Live from the YouTube Data API.</div>
          <BarChart data={rows.map((r) => r.subs)} labels={rows.map((r) => r.label)} format={formatCount} />
        </div>
        <div className="panel">
          <h3>Views by channel</h3>
          <div className="panel-sub">All-time views per channel.</div>
          <BarChart data={rows.map((r) => r.views)} labels={rows.map((r) => r.label)} format={formatCount} />
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          <h3>Channels</h3>
          <div className="panel-sub">Connected via the YouTube Data API.</div>
          {channels.length ? (
            channels.map((c) => (
              <div className="dest-row" key={c.key}>
                <div>
                  <div className="dest-name">{c.name}</div>
                  <div className="dest-meta">{c.handle ? `youtube.com/${c.handle}` : c.channelId}</div>
                </div>
                <a className="btn btn-ghost btn-sm" href={c.url} target="_blank" rel="noopener noreferrer">Open</a>
              </div>
            ))
          ) : (
            <p className="muted" style={{ fontSize: "13.5px" }}>
              No channels connected yet. Add them in Settings.
            </p>
          )}
        </div>
        <div className="panel">
          <h3>Recent activity</h3>
          <div className="panel-sub">Broadcast and upload events.</div>
          <p className="muted" style={{ fontSize: "13.5px" }}>
            Events will appear here once you go live or stream webhooks are connected.
            Nothing is fabricated - this stays empty until real events come in.
          </p>
        </div>
      </div>
    </Shell>
  );
}
