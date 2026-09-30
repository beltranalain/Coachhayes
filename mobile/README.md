# Your Studio - mobile app

The iOS / Android client for your live-streaming platform. It is a **client of
the same backend** as your website (Next.js on Vercel) - there is no separate
server. Accounts, live chat, tips and the broadcast schedule all sync with the
site because they use the same Firebase project, the same Cloudflare chat
worker, the same Stripe account and the same Vercel API routes.

Built with Expo (SDK 57) + expo-router + TypeScript. Targets a **custom
development build** (EAS dev client) so native modules (Stripe, video) work.

## Configuration

All backend values come from environment variables (Expo public env vars,
prefixed `EXPO_PUBLIC_`). Copy `.env.example` to `.env` and fill in your own
backend:

```
cp .env.example .env
```

Point every value at the **same backend as your web app** so the app and site
stay in sync. `src/lib/config.ts` reads these vars with safe empty-string
fallbacks - it contains no hard-coded keys.

App identity (name, slug, scheme, bundle identifier / package) lives in
`app.json`. Replace the `Your Studio` / `com.yourstudio.app` placeholders with
your own, and add your EAS `projectId` / `owner` when you link the app to your
Expo account.

The header logo and site name are fetched at runtime from your web app's
`/api/site-config`, so once `EXPO_PUBLIC_API_BASE` points at your deployment the
app picks up your branding automatically. The placeholder app icon / splash in
`assets/images/` is a neutral amber-on-dark mark - replace it with your own art.

## Tabs

- **Live** - polls `/api/stream/status`; plays the Cloudflare HLS stream with
  expo-video when live, or shows the next scheduled show with a live countdown
  (falling back to OFF AIR). Live chat over the shared WebSocket worker with
  amber tip pills, a message composer, and a "Send a tip" flow.
- **Shows** - upcoming broadcasts + the five series, from `/api/site-config`.
- **Schedule** - future broadcasts from `/api/site-config` with live countdowns.
- **Archive** - past episodes from `/api/youtube?type=uploads`.

## What is wired to the live backend

| Feature        | Endpoint / service                                                        |
| -------------- | ------------------------------------------------------------------------- |
| Live status    | `GET {API_BASE}/api/stream/status`                                        |
| HLS playback   | `https://customer-<code>.cloudflarestream.com/<uid>/manifest/video.m3u8`  |
| Live chat      | `wss://.../room/live/ws` (Cloudflare Durable Object; same room as site)   |
| Schedule/shows | `GET {API_BASE}/api/site-config`                                          |
| Archive        | `GET {API_BASE}/api/youtube?type=uploads`                                 |
| Auth           | Firebase Auth (same project as the website)                               |
| Tips           | `POST {API_BASE}/api/tips/checkout` -> Stripe PaymentSheet (same webhook) |

All public config lives in `src/lib/config.ts` (sourced from `.env`). Native
`fetch` is not subject to CORS, so the Vercel routes are called directly.

## Project layout

```
src/
  app/
    _layout.tsx          Root: fonts, Stripe + Auth providers, splash
    signin.tsx           Email/password sign-in modal (Firebase)
    (tabs)/
      _layout.tsx        Tab bar + branded header
      index.tsx          Live (player + chat + tips)
      shows.tsx          Shows
      schedule.tsx       Schedule
      archive.tsx        Archive
  components/
    ui.tsx               ArtWell, pills, cards, buttons, eyebrows
    ScreenHeader.tsx     Branded app bar
    TabIcon.tsx          Tab glyphs
    TipSheet.tsx         Tip amount bottom sheet
  lib/
    config.ts            Public backend config from .env (API, WS, Stripe, Firebase, HLS)
    theme.ts             Colors, radii, fonts, art-well palettes
    firebase.ts          Firebase JS SDK + AsyncStorage auth persistence
    auth.tsx             Auth context/provider
    api.ts               Typed client for the website's API routes
    useChat.ts           Chat WebSocket hook (worker protocol)
    tips.ts              Stripe PaymentSheet tip flow
    series.ts            The five programs (mirrors the site)
```

## Install

```
npm install
```

## Run the dev client

Stripe and native video require a custom dev build - they do **not** run in
Expo Go. Build the dev client once with EAS, install it on your device /
simulator, then start Metro pointed at it.

```
npm install -g eas-cli        # if not already installed
eas login                     # your Expo account
eas build --profile development --platform ios      # or: android
# install the resulting build on the device/simulator, then:
npx expo start --dev-client
```

For a local Android dev build without EAS cloud you can instead run
`npx expo run:android` (needs Android Studio + JDK).

## Notes

- No emojis anywhere (brand rule).
- Fonts: Anton (display) + Inter (body) via `@expo-google-fonts`.
- All backend keys come from `.env` - never commit real keys. `.env.example`
  documents every required variable.
