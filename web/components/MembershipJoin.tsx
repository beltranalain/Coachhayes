"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { firebaseConfigured, getFirebaseAuth, getIdToken } from "@/lib/firebase";
import MembershipCheckout from "./MembershipCheckout";

// Paid-tier "Join" button. Signed-out users are sent to sign in; signed-in users
// get an on-site Stripe Payment Element (no hosted-checkout redirect).
export default function MembershipJoin({
  tier,
  tierName,
  price,
  cta,
  highlight,
  enabled = true,
}: {
  tier: string;
  tierName: string;
  price: string;
  cta: string;
  highlight?: boolean;
  enabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function join() {
    setErr("");
    const auth = firebaseConfigured ? getFirebaseAuth() : null;
    if (!auth?.currentUser) { router.push("/account?next=/membership"); return; }
    setBusy(true);
    try {
      const token = await getIdToken();
      const r = await fetch("/api/membership/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ tier }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.clientSecret) setClientSecret(d.clientSecret);
      else setErr(d.error || "Could not start checkout.");
    } catch { setErr("Could not start checkout."); } finally { setBusy(false); }
  }

  if (done) {
    return <span className="pill dark" aria-disabled style={{ cursor: "default" }}>You&apos;re in — welcome!</span>;
  }

  // Memberships not connected yet (no Stripe key / price): clean "coming soon"
  // instead of letting a click hit an error.
  if (!enabled) {
    return (
      <div>
        <span className={`pill${highlight ? "" : " dark"}`} aria-disabled style={{ cursor: "default", opacity: 0.65 }}>{cta}</span>
        <p className="feeline" style={{ fontSize: 12.5, marginTop: 8, color: "var(--sub)" }}>Joining opens soon.</p>
      </div>
    );
  }

  return (
    <>
      <button type="button" className={`pill${highlight ? "" : " dark"}`} onClick={join} disabled={busy}>
        {busy ? "Starting…" : cta}
      </button>
      {err && <p className="form-error" style={{ fontSize: 12.5, marginTop: 8 }}>{err}</p>}
      {clientSecret && (
        <MembershipCheckout
          clientSecret={clientSecret}
          tierName={tierName}
          price={price}
          onClose={() => setClientSecret(null)}
          onSuccess={() => { setClientSecret(null); setDone(true); router.refresh(); }}
        />
      )}
    </>
  );
}
