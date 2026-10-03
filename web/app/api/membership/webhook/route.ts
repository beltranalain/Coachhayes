import { NextResponse } from "next/server";
import { getStripe, stripeConfigured, stripeMembershipWebhookSecret, MEMBERSHIP_PRICES } from "@/lib/stripe";
import { getAdminDb } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

// Stripe -> membership state. Point a webhook endpoint at this URL with the events
// customer.subscription.created / updated / deleted. Writes memberships/{uid}.
const PRICE_TO_TIER: Record<string, string> = {};
for (const [tier, id] of Object.entries(MEMBERSHIP_PRICES)) if (id) PRICE_TO_TIER[id] = tier;

// Map Stripe's subscription status to our stored MembershipStatus.
function toStatus(s: string): "active" | "trialing" | "past_due" | "canceled" {
  if (s === "active" || s === "trialing" || s === "past_due" || s === "canceled") return s;
  if (s === "unpaid" || s === "incomplete_expired") return "canceled";
  return "past_due"; // incomplete / paused etc. -> not unlocked
}

export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripeConfigured || !stripe || !stripeMembershipWebhookSecret) {
    return NextResponse.json({ error: "Not configured." }, { status: 400 });
  }

  const sig = request.headers.get("stripe-signature") || "";
  const raw = await request.text();
  let event: any;
  try { event = stripe.webhooks.constructEvent(raw, sig, stripeMembershipWebhookSecret); } catch { return NextResponse.json({ error: "Bad signature." }, { status: 400 }); }

  const db = getAdminDb();
  if (!db) return NextResponse.json({ received: true });

  try {
    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      // Resolve the member. We stamp uid on both the subscription and the customer.
      let uid: string = sub.metadata?.uid || "";
      if (!uid && sub.customer) {
        try { const c: any = await stripe.customers.retrieve(sub.customer); uid = c?.metadata?.uid || ""; } catch {}
      }
      if (uid) {
        const priceId = sub.items?.data?.[0]?.price?.id || "";
        const tier = PRICE_TO_TIER[priceId] || null;
        const status = event.type === "customer.subscription.deleted" ? "canceled" : toStatus(sub.status);
        await db.collection("memberships").doc(uid).set({
          tier: status === "canceled" ? null : tier,
          status,
          stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id || "",
          stripeSubscriptionId: sub.id,
          updatedAt: Date.now(),
        }, { merge: true });
      }
    }
  } catch { /* non-fatal */ }
  return NextResponse.json({ received: true });
}
