"use client";

import { useState } from "react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { getStripePromise } from "@/lib/stripeClient";

const appearance = {
  theme: "night" as const,
  variables: { colorPrimary: "#F5A524", colorBackground: "#141110", colorText: "#F3EFE7", colorTextSecondary: "#BFC4C0", colorDanger: "#E8402A", fontFamily: "Inter, system-ui, sans-serif", borderRadius: "10px", spacingUnit: "4px" },
  rules: { ".Input": { border: "1px solid rgba(243,239,231,.14)", backgroundColor: "#0A0908" }, ".Input:focus": { border: "1px solid #F5A524", boxShadow: "none" }, ".Tab": { border: "1px solid rgba(243,239,231,.14)", backgroundColor: "#0A0908" }, ".Tab--selected": { border: "1px solid #F5A524" }, ".Label": { color: "#BFC4C0" } },
};

const inp: React.CSSProperties = { width: "100%", background: "#0A0908", border: "1px solid rgba(243,239,231,.14)", color: "#F3EFE7", borderRadius: 10, padding: "9px 12px", font: "inherit", fontSize: 14 };
const lbl: React.CSSProperties = { display: "block", fontSize: 12.5, color: "#BFC4C0", margin: "10px 0 5px" };

type Product = { id: string; title: string; priceCents: number; sizes: string[]; image: string };

function PayForm({ total, onSuccess, onClose }: { total: string; onSuccess: () => void; onClose: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true); setErr("");
    const { error } = await stripe.confirmPayment({ elements, confirmParams: { return_url: `${window.location.origin}/shop?ordered=1` }, redirect: "if_required" });
    if (error) { setErr(error.message || "Payment failed. Try again."); setBusy(false); } else onSuccess();
  }
  return (
    <form onSubmit={submit} className="tipm-form">
      <PaymentElement options={{ layout: "tabs" }} />
      {err && <p className="form-error" style={{ fontSize: 13 }}>{err}</p>}
      <div className="tipm-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={!stripe || busy}>{busy ? "Processing..." : `Pay ${total}`}</button>
      </div>
      <p className="tipm-foot">Powered by <strong>Stripe</strong></p>
    </form>
  );
}

export default function ShopCheckout({ product, onClose }: { product: Product; onClose: () => void }) {
  const [size, setSize] = useState(product.sizes[0] || "");
  const [qty, setQty] = useState(1);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const total = `$${((product.priceCents * qty) / 100).toFixed(2)}`;

  async function go() {
    setErr("");
    if (product.sizes.length && !size) { setErr("Choose a size."); return; }
    if (!email.includes("@")) { setErr("Enter a valid email for your receipt."); return; }
    if (!address.trim()) { setErr("Add a shipping address."); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/shop/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: product.id, size, qty, email, name, address }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.clientSecret) setClientSecret(d.clientSecret);
      else setErr(d.error || "Could not start checkout.");
    } catch { setErr("Could not start checkout."); } finally { setBusy(false); }
  }

  return (
    <div className="tipm-overlay" onClick={onClose}>
      <div className="tipm-card" onClick={(e) => e.stopPropagation()}>
        <div className="tipm-head">
          <b>{done ? "Thank you!" : `Buy — ${product.title}`}</b>
          <button type="button" aria-label="Close" onClick={onClose} className="tipm-x"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l10 10M13 3L3 13" /></svg></button>
        </div>
        {done ? (
          <div className="tipm-form">
            <p style={{ fontSize: 14 }}>Your order is in — a receipt is on the way to your email, and we&apos;ll ship it out.</p>
            <div className="tipm-actions"><button type="button" className="btn btn-primary btn-sm" onClick={onClose}>Done</button></div>
          </div>
        ) : clientSecret ? (
          process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? (
            <Elements stripe={getStripePromise()} options={{ clientSecret, appearance }}>
              <PayForm total={total} onSuccess={() => setDone(true)} onClose={onClose} />
            </Elements>
          ) : (
            <div className="tipm-form"><p className="form-error" style={{ fontSize: 13 }}>Card payments aren&apos;t configured yet.</p><div className="tipm-actions"><button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Close</button></div></div>
          )
        ) : (
          <div className="tipm-form">
            {product.sizes.length > 0 && (
              <>
                <label style={lbl}>Size</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {product.sizes.map((s) => (
                    <button key={s} type="button" onClick={() => setSize(s)} style={{ ...inp, width: "auto", padding: "7px 14px", cursor: "pointer", borderColor: size === s ? "#F5A524" : "rgba(243,239,231,.14)", color: size === s ? "#F5A524" : "#F3EFE7" }}>{s}</button>
                  ))}
                </div>
              </>
            )}
            <label style={lbl}>Quantity</label>
            <input type="number" min={1} max={10} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} style={{ ...inp, width: 90 }} />
            <label style={lbl}>Email (for your receipt)</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={inp} />
            <label style={lbl}>Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" style={inp} />
            <label style={lbl}>Shipping address</label>
            <textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city, state, ZIP" style={{ ...inp, resize: "vertical" }} />
            {err && <p className="form-error" style={{ fontSize: 13, marginTop: 8 }}>{err}</p>}
            <div className="tipm-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={go} disabled={busy}>{busy ? "…" : `Continue — ${total}`}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
