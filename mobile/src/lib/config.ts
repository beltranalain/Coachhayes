// All values come from .env (EXPO_PUBLIC_*). Copy .env.example to .env and fill in your backend. Point these at the SAME backend as your web app so the app and site stay in sync.
//
// Public, client-safe configuration. These are the SAME backend endpoints the
// website (Next.js on Vercel) uses, so the mobile app is just another client of
// that shared backend — accounts, chat, tips and schedule all stay in sync.
//
// Nothing secret lives here: the Firebase web config, the Stripe *publishable*
// key and the Cloudflare Stream customer/live-input codes are all safe to ship.

export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "";
export const CHAT_WS_URL = process.env.EXPO_PUBLIC_CHAT_WS_URL ?? "";

export const CF_STREAM_CUSTOMER_CODE =
  process.env.EXPO_PUBLIC_CF_STREAM_CUSTOMER_CODE ?? "";
export const CF_STREAM_LIVE_INPUT_UID =
  process.env.EXPO_PUBLIC_CF_STREAM_LIVE_INPUT_UID ?? "";

export const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

export const FIREBASE_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "",
};

// The live HLS manifest for the Cloudflare Stream live input. When the input is
// receiving a broadcast, this plays the low-latency HLS stream.
export const HLS_URL = `https://customer-${CF_STREAM_CUSTOMER_CODE}.cloudflarestream.com/${CF_STREAM_LIVE_INPUT_UID}/manifest/video.m3u8`;

// The Cloudflare Stream IFRAME embed for the live input. This is what the
// website plays when live — the iframe handles low-latency playback natively,
// which is more reliable than raw HLS in a mobile native player. Rendered in a
// WebView on the app. autoplay + muted so it starts without a user gesture.
export const STREAM_IFRAME_URL = `https://customer-${CF_STREAM_CUSTOMER_CODE}.cloudflarestream.com/${CF_STREAM_LIVE_INPUT_UID}/iframe?autoplay=true&muted=true`;

// Google OAuth client IDs from Firebase/Google console; required for Google
// sign-in in the dev build. Leave empty to disable Google sign-in (the button
// then shows a friendly Alert instead of attempting the OAuth flow).
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
export const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "";

// The single shared chat room the website's LiveChat also joins.
export const CHAT_ROOM = "live";
export const CHAT_ROOM_WS = `${CHAT_WS_URL}/room/${CHAT_ROOM}/ws`;
