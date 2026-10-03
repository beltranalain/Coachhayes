import { NextResponse } from "next/server";
import { verifyUser } from "@/lib/requireUser";
import { getStripe, stripeConfigured, MEMBERSHIP_PRICES } from "@/lib/stripe";
import { getAdminDb } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

// POST { tier: "timmy" | "coordinator" } -> a PaymentIntent client secret for an
// INCOMPLETE subscription. The card is collected on-site (Stripe Payment Element),
// no hosted-checkout redirect. The webhook activates the membership once paid.
export async function POST(request: Request) {
  if (!stripeConfigured) return NextResponse.json({ error: "Memberships aren't set up yet." }, { status: 400 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Memberships aren't set up yet." }, { status: 400 });

  const u = await verifyUser(request);
  if (!u) return NextResponse.json({ error: "Sign in to join." }, { status: 401 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const tier = String(body.tier || "");
  if (tier !== "timmy" && tier !== "coordinator") return NextResponse.json({ error: "Unknown tier." }, { status: 400 });
  const priceId = MEMBERSHIP_PRICES[tier];
  if (!priceId) return NextResponse.json({ error: `This tier isn't connected yet (set STRIPE_PRICE_${tier.toUpperCase()}).` }, { status: 400 });

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "No database." }, { status: 500 });

  try {
    const ref = db.collection("memberships").doc(u.uid);
    const existing = (await ref.get()).data() || {};
    // Already an active member: don't create a second subscription.
    if (existing.status === "active" || existing.status === "trialing") {
      return NextResponse.json({ error: "You're already a member — manage your plan from your account.", already: true }, { status: 409 });
    }

    // Reuse or create this member's Stripe customer.
    let customerId: string = existing.stripeCustomerId || "";
    if (!customerId) {
      const customer = await stripe.customers.create({ email: u.email || undefined, name: u.name || undefined, metadata: { uid: u.uid } });
      customerId = customer.id;
      await ref.set({ stripeCustomerId: customerId }, { merge: true });
    }

    const sub = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      // Covers both current + newer Stripe API shapes for the first-invoice secret.
      expand: ["latest_invoice.payment_intent", "latest_invoice.confirmation_secret"],
      metadata: { uid: u.uid, tier },
    });

    const invoice: any = sub.latest_invoice;
    const clientSecret: string | undefined = invoice?.payment_intent?.client_secret || invoice?.confirmation_secret?.client_secret;
    if (!clientSecret) return NextResponse.json({ error: "Could not start checkout." }, { status: 502 });
    return NextResponse.json({ clientSecret, subscriptionId: sub.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not start checkout." }, { status: 502 });
  }
}
