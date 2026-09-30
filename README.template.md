# Creator Live Platform — white-label template

A complete, self-hostable **live-streaming platform for creators**: a branded website that goes live in the browser (no OBS), simulcasts to YouTube, has merged live chat and viewer tips — plus a matching **iOS/Android app**. Everything is driven by your own accounts, so you own the platform and the audience.

This repository is a **white-label template**. It ships de-branded (a neutral "Your Studio" sample brand) and is made your own by editing one file per app and plugging in your own service keys. The website and the app talk to the **same backend**, so they stay in sync automatically.

```
New Company/
  web/         Next.js website + creator studio + admin dashboard (deploy to Vercel)
  mobile/      Expo (React Native) app for iOS + Android (build with EAS)
  showcase/    Clickable iPhone mockup + demo assets
  docs/        SETUP.md, FEATURES.md, LICENSE
```

## What it does
See **[docs/FEATURES.md](docs/FEATURES.md)** for the full list. In short: browser-based Go Live studio, YouTube (+RTMP) simulcast, remote guests, on-air graphics (lower-thirds, branded scene, AI/green-screen background, rotating ticker), merged Site + YouTube live chat with moderation, Stripe viewer tips, schedule with countdowns, VOD archive, a full admin dashboard, and a native mobile app.

## Architecture (one backend, two clients)
Both the website and the app are clients of the same services:

- **Firebase** — Auth (viewers + admin), Firestore (branding/content/schedule/tips), Storage
- **Cloudflare Stream** — live ingest + HLS playback + VOD, simulcast to YouTube
- **Cloudflare Realtime** — browser guest studio (WebRTC)
- **Cloudflare Worker (Durable Object)** — live chat + tip relay (WebSocket)
- **Stripe** — viewer tips (PaymentIntent + webhook)
- **YouTube Data API** — channel stats + archive

The mobile app points at your deployed website's API + the same Firebase/Cloudflare/Stripe, so a tip or chat message from the app shows up on the site and vice-versa.

## Quick start
This folder is a container with two apps — there's nothing to run at the root except the convenience scripts below. Install deps first (they aren't included).

From the **root** (`New Company/`):
```
npm run install:all   # installs web + mobile deps
npm run web           # start the website (http://localhost:3000)
npm run mobile:go     # start the app in Expo Go
```

Or per app:
1. **Web:** `cd web` → `npm install` → copy `.env.local.example` to `.env.local` and fill in your keys → `npm run dev`. See **[docs/SETUP.md](docs/SETUP.md)**.
2. **Mobile:** `cd mobile` → `npm install` → copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_BASE` to your deployed web URL (+ the same Firebase/Cloudflare/Stripe public values) → `npx expo start`.
3. Run with no keys to see **demo mode** (generic sample data, graceful empty states).

## Make it your brand
- **Website identity:** edit **`web/lib/brand.ts`** — studio name, tagline, domain, accent color, your shows, and your YouTube channels. Everything else (logo, colors, schedule, page copy) is editable at runtime from the **admin dashboard** (`/admin`), which saves to Firestore.
- **App identity:** edit **`mobile/app.json`** (name, `scheme`, `ios.bundleIdentifier`, `android.package`) and set the `EXPO_PUBLIC_*` values in `mobile/.env`. The app pulls its logo/name from your website's branding at runtime.

## Deploy
- **web/** → Vercel (connect the repo, add the env vars).
- **worker/** (inside web/) → Cloudflare (`wrangler deploy`) for chat/tips.
- **mobile/** → EAS Build → App Store / Play Store (`eas build`).

## License
Provided under the terms in **[docs/LICENSE](docs/LICENSE)** — a single-deployment license. Do not redistribute or resell the source. (Template license; have your own counsel review before commercial use.)
