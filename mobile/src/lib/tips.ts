// Tipping via Stripe PaymentSheet. This reuses the website's /api/tips/checkout
// route (creates a PaymentIntent with metadata.kind="tip") and the SAME Stripe
// account + webhook, so a paid tip shows up in the live chat and /admin/tips
// automatically — no separate mobile payment path.

import { startTipCheckout } from "./api";
import { IS_EXPO_GO } from "./env";

export type TipResult =
  | { status: "paid" }
  | { status: "canceled" }
  | { status: "error"; message: string }
  | { status: "unavailable"; message: string };

export async function sendTip(input: {
  amount: number;
  message: string;
  name: string;
  uid: string;
}): Promise<TipResult> {
  // Stripe's PaymentSheet is a native module that isn't bundled in Expo Go.
  // Fail gracefully there instead of crashing on a native call.
  if (IS_EXPO_GO) {
    return {
      status: "unavailable",
      message:
        "Tips need the full app build (not available in Expo Go). Try it in the dev build.",
    };
  }

  // Lazily require Stripe only outside Expo Go so Metro/Expo Go never evaluates it.
  const { initPaymentSheet, presentPaymentSheet } =
    require("@stripe/stripe-react-native") as typeof import("@stripe/stripe-react-native");

  const { clientSecret, error } = await startTipCheckout(input);
  if (error) return { status: "error", message: error };
  if (!clientSecret) return { status: "error", message: "Could not start the tip." };

  const init = await initPaymentSheet({
    paymentIntentClientSecret: clientSecret,
    merchantDisplayName: "Your Studio",
    allowsDelayedPaymentMethods: false,
  });
  if (init.error) return { status: "error", message: init.error.message };

  const { error: presentError } = await presentPaymentSheet();
  if (presentError) {
    // Stripe reports a user cancel as code "Canceled".
    if (presentError.code === "Canceled") return { status: "canceled" };
    return { status: "error", message: presentError.message };
  }
  return { status: "paid" };
}
