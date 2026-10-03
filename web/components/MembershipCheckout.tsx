"use client";

import { useState } from "react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { getStripePromise } from "@/lib/stripeClient";

// On-brand dark appearance so the Stripe form matches the site (same as TipModal).
const appearance = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#F5A524",
    colorBackground: "#141110",
    colorText: "#F3EFE7",
    colorTextSecondary: "#BFC4C0",
    colorDanger: "#E8402A",
    fontFamily: "Inter, system-ui, sans-serif",
    borderRadius: "10px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": { border: "1px solid rgba(243,239,231,.14)", backgroundColor: "#0A0908" },
    ".Input:focus": { border: "1px solid #F5A524", boxShadow: "none" },
    ".Tab": { border: "1px solid rgba(243,239,231,.14)", backgroundColor: "#0A0908" },
    ".Tab--selected": { border: "1px solid #F5A524" },
    ".Label": { color: "#BFC4C0" },
  },
};

function PayForm({ tierName, price, onSuccess, onClose }: { tierName: string; price: string; onSuccess: () => void; onClose: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true); setErr("");
    const { error } = await stripe.confirmPayment({
      elements,
      // Cards stay on-page; only methods that must redirect will.
      confirmParams: { return_url: `${window.location.origin}/membership?joined=1` },
      redirect: "if_required",
    });
    if (error) { setErr(error.message || "Payment failed. Try again."); setBusy(false); }
    else onSuccess();
  }

  return (
    <form onSubmit={submit} className="tipm-form">
      <PaymentElement options={{ layout: "tabs" }} />
      {err && <p className="form-error" style={{ fontSize: 13 }}>{err}</p>}
      <div className="tipm-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={!stripe || busy}>
          {busy ? "Processing..." : `Join — ${price}`}
        </button>
      </div>
      <p className="tipm-foot">Secure recurring billing · Powered by <strong>Stripe</strong>. Cancel anytime.</p>
    </form>
  );
}

export default function MembershipCheckout({
  clientSecret,
  tierName,
  price,
  onSuccess,
  onClose,
}: {
  clientSecret: string;
  tierName: string;
  price: string;
  onSuccess: () => void;
  onClose: () => void;
}) {
  return (
    <div className="tipm-overlay" onClick={onClose}>
      <div className="tipm-card" onClick={(e) => e.stopPropagation()}>
        <div className="tipm-head">
          <b>Join {tierName}</b>
          <button type="button" aria-label="Close" onClick={onClose} className="tipm-x">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l10 10M13 3L3 13" /></svg>
          </button>
        </div>
        {process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? (
          <Elements stripe={getStripePromise()} options={{ clientSecret, appearance }}>
            <PayForm tierName={tierName} price={price} onSuccess={onSuccess} onClose={onClose} />
          </Elements>
        ) : (
          <div className="tipm-form">
            <p className="form-error" style={{ fontSize: 13 }}>Card payments aren&apos;t fully configured yet. (Missing Stripe publishable key.)</p>
            <div className="tipm-actions"><button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Close</button></div>
          </div>
        )}
      </div>
    </div>
  );
}
