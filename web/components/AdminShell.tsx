"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { navForRole } from "@/lib/adminNav";
import { useAdminRole } from "@/lib/adminRole";
import { BRAND } from "@/lib/siteData";
import { loadConfig } from "@/lib/saveSection";
import { firebaseConfigured, getFirebaseAuth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

// Section icons keyed by route, so the sidebar matches the Hayes admin mock.
const ICO = (p: React.ReactNode) => (
  <svg className="ic" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} width={17} height={17}>{p}</svg>
);
const ICONS: Record<string, React.ReactNode> = {
  "/admin": ICO(<><rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1.5" /><rect x="11" y="2.5" width="6.5" height="6.5" rx="1.5" /><rect x="2.5" y="11" width="6.5" height="6.5" rx="1.5" /><rect x="11" y="11" width="6.5" height="6.5" rx="1.5" /></>),
  "/admin/go-live": ICO(<><rect x="2" y="4" width="12" height="12" rx="2.5" /><path d="M14 9 18 6.5v7L14 11z" fill="currentColor" stroke="none" /></>),
  "/admin/studio": ICO(<><rect x="2.5" y="4" width="15" height="12" rx="2.5" /><circle cx="10" cy="10" r="2.5" /></>),
  "/admin/on-air": ICO(<><circle cx="10" cy="10" r="7" /><circle cx="10" cy="10" r="2.5" fill="currentColor" stroke="none" /></>),
  "/admin/videos": ICO(<><rect x="2.5" y="4" width="15" height="12" rx="2.5" /><path d="M8 8l4 2-4 2z" fill="currentColor" stroke="none" /></>),
  "/admin/schedule": ICO(<><rect x="3" y="4" width="14" height="13" rx="2.5" /><path d="M3 8h14M7 2v4M13 2v4" /></>),
  "/admin/content": ICO(<><rect x="2.5" y="3.5" width="15" height="13" rx="2.5" /><path d="M2.5 7.5h15M6 11h8M6 13.5h5" /></>),
  "/manage/content": ICO(<><rect x="2.5" y="3.5" width="15" height="13" rx="2.5" /><path d="M2.5 7.5h15M6 11h8M6 13.5h5" /></>),
  "/admin/branding": ICO(<><circle cx="10" cy="10" r="7" /><path d="M10 3v14M3 10h14" /></>),
  "/admin/users": ICO(<><circle cx="10" cy="7" r="3.2" /><path d="M4 17c0-3.3 2.7-5 6-5s6 1.7 6 5" /></>),
  "/admin/tips": ICO(<path d="M10 3v14M6.5 6.5h5a2.5 2.5 0 0 1 0 5h-3a2.5 2.5 0 0 0 0 5h5" />),
  "/admin/costs": ICO(<><circle cx="10" cy="10" r="7" /><path d="M7 10h6M10 7v6" /></>),
  "/admin/analytics": ICO(<path d="M3 17V9M8 17V4M13 17v-6M18 17V7" />),
  "/admin/settings": ICO(<><circle cx="10" cy="10" r="7" /><path d="M10 6v4l3 2" /></>),
  "/admin/team": ICO(<><circle cx="7" cy="8" r="2.6" /><circle cx="13" cy="8" r="2.6" /><path d="M3 16c0-2 1.8-3.4 4-3.4M17 16c0-2-1.8-3.4-4-3.4" /></>),
  "/admin/help": ICO(<><circle cx="10" cy="10" r="7" /><path d="M8 8a2 2 0 1 1 3 1.7c-.6.4-1 .8-1 1.6M10 14h.01" /></>),
};

// The legacy admin, reskinned into the Hayes "Control Room" design system
// (scoped under .hzadmin). Every page's markup/engine is unchanged; a
// compatibility CSS layer in admin-hayes.css restyles the legacy classes.
type Theme = "light" | "dark";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role } = useAdminRole();
  const nav = navForRole(role);
  const [brand, setBrand] = useState<{ name: string; logo: string }>({ name: BRAND.name, logo: "" });
  const [navOpen, setNavOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    loadConfig()
      .then((cfg) => { if (cfg?.branding) setBrand({ name: cfg.branding.siteName || BRAND.name, logo: cfg.branding.logo || "" }); })
      .catch(() => {});
    try {
      const s = localStorage.getItem("hz-admin-theme");
      if (s === "dark" || s === "light") setTheme(s);
    } catch {}
  }, []);
  useEffect(() => { setNavOpen(false); }, [pathname]);

  const applyTheme = (t: Theme) => { setTheme(t); try { localStorage.setItem("hz-admin-theme", t); } catch {} };
  const initials = brand.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "CH";

  async function handleSignOut() {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
    router.push("/admin/login");
  }

  return (
    <div className="hzadmin" data-theme={theme}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      {/* Mobile bar */}
      <div className="cr-mobilebar">
        <div className="brand" style={{ padding: 0, border: 0 }}>
          {brand.logo ? <img className="mk" src={brand.logo} alt="" /> : <span className="mk">{initials}</span>}
          <b style={{ fontSize: 14 }}>{brand.name}</b>
        </div>
        <button className="cr-burger" aria-label="Menu" aria-expanded={navOpen} onClick={() => setNavOpen((v) => !v)}>
          <span /><span /><span />
        </button>
      </div>
      {navOpen && <div className="cr-backdrop" onClick={() => setNavOpen(false)} />}

      <div className="shell">
        <aside className={navOpen ? "open" : undefined}>
          <div className="brand">
            {brand.logo ? <img className="mk" src={brand.logo} alt="" /> : <span className="mk">{initials}</span>}
            <b>{brand.name}<em>Control Room</em></b>
          </div>
          <div className="navgrp">
            <nav>
              {nav.map((item) => {
                const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href} className={active ? "on" : undefined}>
                    {ICONS[item.href] ?? ICO(<circle cx="10" cy="10" r="6" />)}
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="cr-foot">
            <div className="themeSw">
              <button className={theme === "light" ? "on" : undefined} onClick={() => applyTheme("light")}>Light</button>
              <button className={theme === "dark" ? "on" : undefined} onClick={() => applyTheme("dark")}>Dark</button>
            </div>
            <Link className="btn btn-ghost btn-sm" href="/" style={{ justifyContent: "center" }}>View public site</Link>
            {firebaseConfigured && <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>Sign out</button>}
          </div>
        </aside>

        <main>
          <div className="inner" style={{ padding: "24px 30px 70px" }}>
            {!firebaseConfigured && (
              <div className="notice" style={{ marginBottom: 20 }}>
                <strong>Demo mode.</strong> Connect Firebase to turn on real sign-in and saving.
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
