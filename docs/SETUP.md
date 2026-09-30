# Setup

You bring your own accounts; the platform wires into them. Plan ~30–60 minutes for a first setup. You can run in **demo mode** (no keys) immediately to explore.

## 1. Services to create
| Service | Used for | You need |
|---|---|---|
| **Firebase** | Auth + Firestore + Storage | Web app config (apiKey, authDomain, projectId, …) and an Admin service account (client email + private key). Enable Google + Email sign-in. |
| **Cloudflare Stream** | Live video + VOD + simulcast | Account ID, a Stream API token, a Live Input UID, and your Stream customer code. |
| **Cloudflare Realtime** (Serverless SFU) | Browser guest studio | App ID + App token. |
| **Cloudflare Worker** | Live chat + tip relay | Deploy `web/worker/` with `wrangler deploy`; note the `wss://…workers.dev` URL. Set a `CHAT_ADMIN_SECRET`. |
| **Stripe** | Viewer tips | Secret key, publishable key, and a webhook signing secret (endpoint → `/api/tips/webhook`, event `checkout.session.completed` + `payment_intent.succeeded`). Test/sandbox keys work for demos. |
| **YouTube Data API** | Channel stats + archive | An API key. Put your channel IDs in `web/lib/brand.ts`. |

## 2. Website (`web/`)
```
cd web
npm install
cp .env.local.example .env.local   # fill in the values from step 1
npm run dev
```
- Edit **`lib/brand.ts`** for name, tagline, domain, accent, your shows, and YouTube channels.
- Everything else (logo, colors, schedule, page copy, tips) is editable at **`/admin`** once Firebase is connected — it saves to Firestore and updates the public site live.
- Deploy to **Vercel**: connect the repo, add the same env vars.
- Deploy the chat/tips worker: `cd worker && wrangler deploy` (see `web/worker/README.md`).

## 3. Mobile app (`mobile/`)
```
cd mobile
npm install
cp .env.example .env
# set EXPO_PUBLIC_API_BASE to your deployed web URL, plus the same
# Firebase / Cloudflare Stream / chat WS / Stripe publishable values
npx expo start
```
- Set the app identity in **`app.json`** (`name`, `scheme`, `ios.bundleIdentifier`, `android.package`).
- Native features (Stripe tips, Google sign-in) require a **dev build**: `eas build --profile development --platform android` (or ios), then `npx expo start --dev-client`. Email/password sign-in, live video, chat, and browsing work in Expo Go.
- Ship: `eas build --profile production` → App Store / Play Store.

## 4. Make an admin
Add your admin email(s) to the allowlist in `web/lib/admin.ts`, then sign in at `/admin`.

## Notes
- The mobile app and website share one backend — point them at the same Firebase/Cloudflare/Stripe so data stays in sync.
- Keep real keys out of git: `.env.local` (web) and `.env` (mobile) are gitignored; only the `*.example` files are committed.
