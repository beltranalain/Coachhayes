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
  { href: "/community", label: "Community" },
  { href: "/rankings", label: "Rankings" },
  { href: "/fantasy", label: "Fantasy" },
  { href: "/shop", label: "Shop" },
  { href: "/membership", label: "Membership" },
];

export default function SiteNav({ brandName, live, logo }: { brandName: string; live: boolean; logo?: string }) {
  const path = usePathname();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!firebaseConfigured) { setReady(true); return; }
    const auth = getFirebaseAuth();
    if (!auth) { setReady(true); return; }
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setReady(true); });
    return () => unsub();
  }, []);

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
        </div>
      </div>
    </nav>
  );
}
