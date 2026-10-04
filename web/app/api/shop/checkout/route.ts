import { NextResponse } from "next/server";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { getAdminDb, adminConfigured } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

// POST { productId, size, qty, email, name, address } -> a PaymentIntent client
// secret. The card is collected on-site (Payment Element), no hosted redirect.
// The price is read from Firestore server-side (never trusted from the client).
export async function POST(request: Request) {
  if (!stripeConfigured) return NextResponse.json({ error: "The shop isn't set up yet." }, { status: 400 });
  const stripe = getStripe();
  if (!stripe || !adminConfigured) return NextResponse.json({ error: "The shop isn't set up yet." }, { status: 400 });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "No database." }, { status: 500 });

  let b: any;
  try { b = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const productId = String(b.productId || "");
  const size = String(b.size || "").slice(0, 12);
  const qty = Math.max(1, Math.min(10, Math.round(Number(b.qty) || 1)));
  const email = String(b.email || "").slice(0, 120);
  const name = String(b.name || "").slice(0, 80);
  const address = String(b.address || "").slice(0, 300);
  if (!productId) return NextResponse.json({ error: "Pick a product." }, { status: 400 });
  if (!email || !email.includes("@")) return NextResponse.json({ error: "A valid email is required." }, { status: 400 });

  try {
    const snap = await db.collection("shopProducts").doc(productId).get();
    const p = snap.data();
    if (!snap.exists || !p || p.visible === false) return NextResponse.json({ error: "That item is unavailable." }, { status: 404 });
    const unit = Math.round(Number(p.priceCents) || 0);
    if (unit <= 0) return NextResponse.json({ error: "That item isn't for sale." }, { status: 400 });
    const amount = unit * qty;

    const intent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      receipt_email: email,
      automatic_payment_methods: { enabled: true },
      description: `${p.title}${size ? ` (${size})` : ""} x${qty}`,
      // `kind: "shop"` lets the webhook record the order (and ignore tips).
      metadata: { kind: "shop", productId, title: String(p.title || "").slice(0, 120), size, qty: String(qty), email, name, address, amount: String(amount) },
    });
    return NextResponse.json({ clientSecret: intent.client_secret });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not start checkout." }, { status: 502 });
  }
}
