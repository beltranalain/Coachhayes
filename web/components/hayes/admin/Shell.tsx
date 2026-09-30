"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

// Hayes "Control Room" admin shell: sidebar (grouped nav) + sticky topbar, in
// the approved admin design (scoped under .hzadmin). Dual theme via data-theme.
type Item = { key: string; label: string; href: string; icon: ReactNode; tag?: string; live?: boolean; classic?: boolean };
type Group = { label: string; items: Item[] };

const I = (p: ReactNode) => (
  <svg className="ic" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6}>{p}</svg>
);

// Mirrors the approved admin mock (hayes-admin-demo): grouped nav, these exact
// items + icons. Pages live under /manage/*.
const GROUPS: Group[] = [
  {
    label: "Broadcast",
    items: [
      { key: "golive", label: "Go live", href: "/manage/go-live", icon: I(<><rect x="2" y="4" width="12" height="12" rx="2.5" /><path d="M14 9 18 6.5v7L14 11z" fill="currentColor" stroke="none" /></>), live: true },
      { key: "studio", label: "Studio", href: "/manage/studio", icon: I(<><rect x="2.5" y="3.5" width="15" height="10.5" rx="2" /><path d="M7 17.5h6M10 14v3.5" /></>) },
      { key: "guests", label: "Guests", href: "/manage/guests", icon: I(<><circle cx="7" cy="7" r="3" /><path d="M2 17c0-3 2.2-5 5-5s5 2 5 5" /><path d="M13 5h5M13 9h5M13 13h3" /></>) },
      { key: "chat", label: "Chat", href: "/manage/chat", icon: I(<path d="M3 4h14v10H8l-4 3z" />) },
      { key: "destinations", label: "Destinations", href: "/manage/destinations", icon: I(<path d="M3 10h4M12 4h5M12 10h5M12 16h5M7 10l5-6M7 10h5M7 10l5 6" />) },
    ],
  },
  {
    label: "Content",
    items: [
      { key: "shows", label: "Shows", href: "/manage/shows", icon: I(<><rect x="2.5" y="4" width="15" height="12" rx="2.5" /><path d="M2.5 8h15" /></>) },
      { key: "schedule", label: "Schedule", href: "/manage/schedule", icon: I(<><rect x="3" y="4" width="14" height="13" rx="2.5" /><path d="M3 8h14M7 2v4M13 2v4" /></>) },
      { key: "library", label: "Library", href: "/manage/library", icon: I(<><path d="M3 6.5 10 3l7 3.5-7 3.5z" /><path d="M3 10.5 10 14l7-3.5M3 14 10 17.5 17 14" /></>) },
      { key: "rankings", label: "Rankings", href: "/manage/rankings", icon: I(<><circle cx="10" cy="10" r="7" /><path d="M10 6v8M7 9l3-3 3 3" /></>) },
      { key: "players", label: "Players", href: "/manage/players", icon: I(<><circle cx="9" cy="9" r="6" /><path d="M13.5 13.5 18 18" /></>) },
    ],
  },
  {
    label: "Community",
    items: [
      { key: "community", label: "Feed & roles", href: "/manage/community", icon: I(<><circle cx="7" cy="8" r="2.6" /><circle cx="14" cy="8" r="2.6" /><path d="M2.5 16c0-2.4 2-4 4.5-4s4.5 1.6 4.5 4M11 16c0-2.4 2-4 4.5-4s2 .4 2 .4" /></>) },
      { key: "fantasy", label: "Fantasy", href: "/manage/fantasy", icon: I(<><rect x="3" y="4" width="14" height="13" rx="2.5" /><path d="M7 8h6M7 11h6M7 14h3" /></>) },
      { key: "merch", label: "Merch", href: "/manage/merch", icon: I(<><path d="M5 7h10l1 10H4z" /><path d="M8 7a2 2 0 0 1 4 0" /></>) },
    ],
  },
  {
    label: "Audience",
    items: [
      { key: "members", label: "Members", href: "/manage/members", icon: I(<><circle cx="10" cy="7" r="3.2" /><path d="M4 17c0-3.3 2.7-5 6-5s6 1.7 6 5" /></>) },
      { key: "tips", label: "Tips", href: "/manage/tips", icon: I(<path d="M10 3v14M6.5 6.5h5a2.5 2.5 0 0 1 0 5h-3a2.5 2.5 0 0 0 0 5h5" />) },
      { key: "email", label: "Email list", href: "/manage/email", icon: I(<><rect x="3" y="5" width="14" height="10" rx="2" /><path d="M3 6l7 5 7-5" /></>) },
      { key: "settings", label: "Settings", href: "/manage/settings", icon: I(<><circle cx="10" cy="10" r="7" /><path d="M10 6v4l3 2" /></>) },
    ],
  },
];

type Theme = "light" | "dark";

export default function Shell({
  title,
  sub,
  brandName,
  logo,
  actions,
  children,
}: {
  title: string;
  sub?: string;
  brandName: string;
  logo?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const path = usePathname();
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    try {
      const s = localStorage.getItem("hz-admin-theme");
      if (s === "dark" || s === "light") setTheme(s);
    } catch {}
  }, []);
  const applyTheme = (t: Theme) => {
    setTheme(t);
    try { localStorage.setItem("hz-admin-theme", t); } catch {}
  };
  void brandName; void logo; // sidebar brand is fixed to the mock ("Coach Hayes")

  return (
    <div className="hzadmin" data-theme={theme}>
      <div className="shell">
        <aside>
          {/* Matches the admin mock exactly: plain mark + "Coach Hayes". */}
          <div className="brand">
            <span className="mk brandmk" />
            <b>Coach Hayes<em>Control Room</em></b>
          </div>
          {GROUPS.map((g) => (
            <div className="navgrp" key={g.label || g.items[0]?.key}>
              {g.label && <div className="lbl">{g.label}</div>}
              <nav>
                {g.items.map((it) => (
                  <Link key={it.key} href={it.href} className={path === it.href ? "on" : undefined}>
                    {it.icon}
                    {it.label}
                    {it.tag && <span className="tag">{it.tag}</span>}
                    {it.classic && <span className="tag" style={{ fontSize: 9.5, opacity: 0.7 }}>classic</span>}
                    {it.live && <span className="dot" />}
                  </Link>
                ))}
              </nav>
            </div>
          ))}
        </aside>

        <main>
          <div className="topbar">
            <div>
              <h1>{title}</h1>
              {sub && <div className="sub">{sub}</div>}
            </div>
            <div className="right">
              {/* Mock order: theme toggle, then the on-air pill, then avatar. */}
              <div className="themeSw">
                <button className={theme === "light" ? "on" : undefined} onClick={() => applyTheme("light")}>Light</button>
                <button className={theme === "dark" ? "on" : undefined} onClick={() => applyTheme("dark")}>Dark</button>
              </div>
              {actions}
              <Link href="/" className="av" title="View site" target="_blank" />
            </div>
          </div>
          <div className="inner" style={{ padding: "26px 30px" }}>{children}</div>
        </main>
      </div>
    </div>
  );
}
