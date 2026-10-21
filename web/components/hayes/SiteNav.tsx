"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "./ThemeRoot";
import { firebaseConfigured, getFirebaseAuth } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/live", label: "Live" },
  { href: "/community", label: "Locker Room" },
  { href: "/rankings", label: "Rankings" },
  { href: "/blog", label: "Blog" },
  // Hidden for now (pages kept — just not in the nav). Re-add to show again.
  // { href: "/fantasy", label: "Fantasy" },
  // { href: "/shop", label: "Shop" },
  { href: "/membership", label: "Membership" },
];

export default function SiteNav({ brandName, live, logo }: { brandName: string; live: boolean; logo?: string }) {
  const path = usePathname();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!firebaseConfigured) { setReady(true); return; }
    const auth = getFirebaseAuth();
    if (!auth) { setReady(true); return; }
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setReady(true); });
    return () => unsub();
  }, []);

  // Close the mobile menu whenever the route changes.
  useEffect(() => { setMenuOpen(false); }, [path]);

  const firstName = user ? (user.displayName?.split(" ")[0] || user.email?.split("@")[0] || "Account") : "";
  const initial = (firstName || "?").charAt(0).toUpperCase();

  return (
    <nav className="topnav">
      <div className="nv">
        <Link className="brand" href="/">
          {logo ? <img className="brand-logo" src={logo} alt="" /> : <span className="mark sm" />}
          {brandName}
        </Link>
        <div className="links">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={path === l.href ? "on" : undefined}>
              {l.label}
            </Link>
          ))}
        </div>
        <div className="right">
          <div className="themeSw">
            <button className={theme === "light" ? "on" : undefined} onClick={() => setTheme("light")}>
              Light
            </button>
            <button className={theme === "dark" ? "on" : undefined} onClick={() => setTheme("dark")}>
              Dark
            </button>
          </div>
          {live && (
            <span className="onair">
              <i />
              On air
            </span>
          )}
          {ready && user ? (
            <Link className="navacct" href="/account" title="Your account">
              <span className="navacct-av">{initial}</span>
              <span className="navacct-name">{firstName}</span>
            </Link>
          ) : (
            <>
              <Link className="navsignin" href="/account">Sign in</Link>
              <Link className="pill sm dark" href="/account">Join free</Link>
            </>
          )}
          <button
            className="navToggle"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className={`navToggle-i${menuOpen ? " open" : ""}`}><i /><i /><i /></span>
          </button>
        </div>
      </div>

      {/* Mobile menu — shown when the hamburger is tapped (links are hidden on
          small screens). */}
      {menuOpen && (
        <div className="navMenu">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={path === l.href ? "on" : undefined} onClick={() => setMenuOpen(false)}>
              {l.label}
            </Link>
          ))}
          <div className="navMenu-sep" />
          <div className="navMenu-row">
            <span className="navMenu-lbl">Theme</span>
            <div className="themeSw">
              <button className={theme === "light" ? "on" : undefined} onClick={() => setTheme("light")}>Light</button>
              <button className={theme === "dark" ? "on" : undefined} onClick={() => setTheme("dark")}>Dark</button>
            </div>
          </div>
          {ready && user ? (
            <Link className="navMenu-acct" href="/account" onClick={() => setMenuOpen(false)}>
              <span className="navacct-av">{initial}</span>{firstName} · Your account
            </Link>
          ) : (
            <div className="navMenu-auth">
              <Link className="pill sm soft" href="/account" onClick={() => setMenuOpen(false)}>Sign in</Link>
              <Link className="pill sm" href="/account" onClick={() => setMenuOpen(false)}>Join free</Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
