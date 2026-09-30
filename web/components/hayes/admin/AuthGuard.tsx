"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { firebaseConfigured, getFirebaseAuth, getIdToken } from "@/lib/firebase";
import { isEnvOwner } from "@/lib/admin";
import { onAuthStateChanged, type User } from "firebase/auth";

// Gate for the Hayes /manage admin. Mirrors the legacy admin gate: env-owner
// fast path, otherwise verified server-side via /api/admin/whoami. Non-admins
// are bounced to the existing sign-in page.
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "ok" | "denied">(firebaseConfigured ? "loading" : "ok");

  useEffect(() => {
    if (!firebaseConfigured) return;
    const auth = getFirebaseAuth();
    if (!auth) { setState("ok"); return; }
    const unsub = onAuthStateChanged(auth, async (u: User | null) => {
      if (!u) {
        router.replace("/admin/login?next=/manage/go-live");
        return;
      }
      try {
        const token = await getIdToken();
        const res = await fetch("/api/admin/whoami", { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" });
        if (res.ok) {
          const d = await res.json();
          setState(d?.role && d.role !== "denied" ? "ok" : "denied");
        } else {
          setState(isEnvOwner(u.email) ? "ok" : "denied");
        }
      } catch {
        setState(isEnvOwner(u.email) ? "ok" : "denied");
      }
    });
    return () => unsub();
  }, [router]);

  if (state === "loading") {
    return (
      <div className="hzadmin" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <p style={{ color: "var(--sub)" }}>Loading Control Room…</p>
      </div>
    );
  }
  if (state === "denied") {
    return (
      <div className="hzadmin" style={{ display: "grid", placeItems: "center", minHeight: "100vh", textAlign: "center", padding: 24 }}>
        <div>
          <h2 style={{ marginBottom: 8 }}>Not an admin</h2>
          <p style={{ color: "var(--sub)" }}>This account isn’t on the team. Ask the owner to add your email.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
