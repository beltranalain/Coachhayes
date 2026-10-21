# Client Handoff / Launch Checklist

Everything needed to move this project onto the **client's own accounts** before
going live. Each key goes in **Vercel → Project → Settings → Environment
Variables** (web) and in **mobile/.env** (app) unless noted. Items marked
**MUST** are required for the core experience; the rest unlock extra features.

---

## 0. Before anything — the YouTube quota form (do this early)
- **MUST (before heavy use):** request a **YouTube Data API quota increase** so his
  long/busy shows never hit the free 10,000/day ceiling.
- Form: **"YouTube API Services - Audit and Quota Extension Form"**
  (search that name, or Google Cloud Console → APIs & Services → YouTube Data API
  v3 → Quotas → "Apply for higher quota").
- What to write (2–3 sentences): *"We run a creator website + mobile app that
  displays the channel owner's live broadcasts and live chat to their audience.
  We poll liveBroadcasts/liveChatMessages during shows (a few hours, a few times a
  week). Requesting a higher daily quota to support live detection + chat during
  broadcasts."*
- They usually grant a large increase within a few days. **Submit on the client's
  Google Cloud project** (the one that owns their `YOUTUBE_API_KEY`).

---

## 1. Firebase — accounts + database (MUST)
Create/transfer a Firebase project on the client's account, then set:
- **Web (public):** `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
  `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`,
  `NEXT_PUBLIC_FIREBASE_DATABASE_URL`
- **Admin / server (secret):** `FIREBASE_ADMIN_PROJECT_ID`,
  `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` (service-account JSON)
- **Mobile (.env):** the `EXPO_PUBLIC_FIREBASE_*` mirror of the web config.
- Enable **Email/Password + Google** sign-in; add the client's domain to Firebase
  Auth → authorized domains.

## 2. YouTube — live + chat + membership (MUST for live)
- `YOUTUBE_API_KEY` — Data API key on the client's Google Cloud project (powers
  live detect, chat mirror, past episodes). **See the quota form in section 0.**
- Channel is already wired to Coach's real channel ID in `lib/brand.ts` — confirm
  it's his.
- **YouTube membership linking (optional):** `YOUTUBE_OAUTH_CLIENT_ID`,
  `YOUTUBE_OAUTH_CLIENT_SECRET`, `NEXT_PUBLIC_YOUTUBE_OAUTH_CLIENT_ID`.
- **Mobile Google sign-in:** `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`,
  `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`.

## 3. AI — evaluations (voice + written) (MUST for evaluations)
- `GROQ_API_KEY` — powers both voice transcription and the written evaluations.
- Optional overrides: `GROQ_MODEL`, `GROQ_TRANSCRIBE_MODEL`, `AI_EVAL_PROVIDER`.
- Optional alternatives: `OPENAI_API_KEY` (+ `OPENAI_MODEL`, `OPENAI_TRANSCRIBE_MODEL`),
  `DEEPSEEK_API_KEY` (+ `DEEPSEEK_MODEL`), `ANTHROPIC_API_KEY`.

## 4. Cloudflare Stream — phone/studio broadcast + owned player (optional)
Only needed if he broadcasts from the phone/studio (not just YouTube).
- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN`,
  `CLOUDFLARE_STREAM_LIVE_INPUT_UID`
- Public: `NEXT_PUBLIC_CF_STREAM_CUSTOMER_CODE`, `NEXT_PUBLIC_CF_STREAM_LIVE_INPUT_UID`
  (+ the `EXPO_PUBLIC_CF_STREAM_*` mirror on mobile)
- **Guest green room (optional):** `CLOUDFLARE_REALTIME_APP_ID`,
  `CLOUDFLARE_REALTIME_APP_TOKEN`

## 5. Chat — realtime worker (MUST for live chat)
- `NEXT_PUBLIC_CHAT_WS_URL` — the Cloudflare Worker / Durable Object chat endpoint
  (+ the `EXPO_PUBLIC_CHAT_WS_URL` mirror on mobile).
- `CHAT_ADMIN_SECRET` — for moderation.

## 6. Simulcast relay — fan out to YouTube/Facebook (optional)
- `RELAY_URL`, `RELAY_SECRET` — only if simulcasting the phone/studio broadcast out.

## 7. Stripe — tips + memberships (optional, for payments)
- `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (+ `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`)
- `STRIPE_PRICE_TIMMY`, `STRIPE_PRICE_COORDINATOR` (membership price IDs)
- `STRIPE_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET_MEMBERSHIP` (set up the webhooks)

## 8. Email — contact + notifications (optional)
- `RESEND_API_KEY`, `RESEND_FROM`, `CONTACT_TO_EMAIL`

## 9. Site + admin config (MUST)
- `NEXT_PUBLIC_SITE_URL` — the client's final domain.
- `NEXT_PUBLIC_ADMIN_EMAILS` (+ `EXPO_PUBLIC_ADMIN_EMAILS`) — super-admin emails.
- Point `web/lib/brand.ts` (studio name, domain, emails, channel) at the client.

## 10. Mobile app (for the app in the stores / dev build)
- `EXPO_PUBLIC_API_BASE` — the client's web domain (the app is a client of it).
- Set the `EXPO_PUBLIC_*` mirror of Firebase / Stripe / Cloudflare / Google above.
- **Go Live camera needs a dev build** (`eas build --profile development`); Expo Go
  can't broadcast. Store builds: `eas build --profile production` + store accounts.

## 11. Deployment
- **Web:** Vercel project on the client's account; set all server env vars above;
  connect the domain + DNS.
- **Never commit** `.env.local` / `.env` (they're gitignored).

---

### Quick "minimum to go live with the YouTube experience"
Firebase (1) · YouTube API key + quota form (0, 2) · Chat worker (5) · Site config
(9) · Vercel deploy (11). Everything else is additive.
