import "server-only";

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;

export const stripeConfigured = Boolean(key);
export const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
// Memberships use a separate Stripe webhook endpoint (subscription events); use a
// dedicated signing secret, falling back to the main one if a single endpoint is used.
export const stripeMembershipWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET_MEMBERSHIP || stripeWebhookSecret;
// Recurring Price IDs per membership tier (created in the Stripe dashboard).
export const MEMBERSHIP_PRICES: Record<string, string | undefined> = {
  timmy: process.env.STRIPE_PRICE_TIMMY,
  coordinator: process.env.STRIPE_PRICE_COORDINATOR,
};

let client: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!key) return null;
  if (!client) client = new Stripe(key);
  return client;
}
