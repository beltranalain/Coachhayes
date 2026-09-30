# Features

## Broadcast
- **Go Live from the browser** — camera + mic, no OBS. Composited on a canvas and pushed to Cloudflare Stream via WHIP.
- **Simulcast** — your own site player + YouTube (and other RTMP destinations) at the same time.
- **Remote guests** — guests join by link over Cloudflare Realtime (WebRTC); host admits from a green room; grid/spotlight layouts.
- **Screen share** and **local recording** of the program.
- **OBS "pro mode"** — optional RTMPS/stream-key path for creators who prefer OBS.

## On-air graphics (burned into the broadcast)
- Lower-third **banners** and **pinned viewer comments** (draggable).
- **Branded scene** — background behind the host with green-screen (chroma) or **AI virtual background** (no green screen), plus a frame overlay and logo.
- **Rotating lower-third ticker** (news-style scroll).
- **Tip alerts** pop on the broadcast when a viewer tips.

## Audience
- **Merged live chat** — Site + YouTube in one feed, with real accounts (Google or email).
- **Moderation** — timeout / ban / remove.
- **Viewer tips** via Stripe (on-site modal), shown live in chat and recorded for the creator.
- **Go-live alerts** and a schedule with live countdowns.

## Site + content
- Marquee home hero, show pages, **VOD archive**, and a public **schedule**.
- **Admin dashboard** — overview with charts (users, views, revenue), branding, content, schedule, videos, users, tips, costs, analytics, settings. Everything brandable at runtime (saved to Firestore).

## Mobile app (iOS + Android)
- Live tab with the same player, merged chat, and tips.
- Shows / Schedule / Archive tabs.
- Portrait and landscape layouts; sign-in shared with the website.

## You own it
- Your Firebase, your Cloudflare, your Stripe, your YouTube. No per-seat SaaS fees; the platform and the audience are yours.

## No-code admin control (added)
- **Branding** — logo, favicon, accent/background/live colors, **text color**, **heading & body fonts** (curated Google Fonts) and **upload your own font**.
- **Content CMS** — edit the About text and every page's headings/intro (Shows, Library, About); add/edit/remove **shows/series** with per-series **thumbnail upload** and show/hide; manage **YouTube channels** (add/remove — videos sync into the Library).
- **Everything saves to Firestore and applies site-wide instantly.**

## Studio production (added)
- **Rundown** (per-topic images, countdowns, overtime), **media playback**, **scene quick-switch + hotkeys**, **cut/fade transitions**, **multi-camera** switching, **instant replay**, **vertical recording**, **mic enhancement**, **soundboard**, and an **intro-video bumper** (upload to Cloudflare Stream).
- **Merged live chat** across Site + **YouTube** + **Twitch** with source **logos**; host can post to chat and pin comments (with the source logo burned in). Public/Unlisted YouTube supported.
- **Guest studio** — host previews a guest's camera before admitting; guest virtual backgrounds are composited into the program; refresh-safe.

## Mobile-ready admin (added)
- The admin dashboard collapses to a drawer nav with responsive tables on phones/tablets.
