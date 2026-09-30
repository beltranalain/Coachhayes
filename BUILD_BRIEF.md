# Coach Hayes Football — build brief

Hand this to Claude Code along with the three template files. Read it fully
before writing code.

---

## Start here (paste this as your first prompt)

> Read BUILD_BRIEF.md. Three HTML files in /templates are the approved visual
> design, signed off by the client. They are static mockups with hardcoded
> sample data.
>
> Your job is to build the real product with that exact design. Extract the
> design system first (tokens, components, layout), then build the app against a
> real database. Do not redesign anything. Do not carry a single hardcoded value
> into production code.
>
> Start with Phase 0 only. Show me the design token extraction and the schema
> before you build any pages.

---

## What this is

Coach Hayes Football is a college football media business run by one person. He
produces five live shows a week, grades high school players on film, runs a paid
fantasy league, sells merch, and has a Discord community. Today all of that is
scattered across YouTube, WordPress, Discord, Fantrax, Spring and CashApp.

We are replacing it with one platform he owns.

This is a **second deployment of an existing product.** A working version runs at
github.com/beltranalain/Southcoast for a different client. Reuse that
architecture. Do not invent a new one.

---

## The three templates

In `/templates`. These are the **design source of truth** and nothing about
their look should change.

| File | What it is |
| --- | --- |
| `hayes-site-demo.html` | Public site. Home, Live, Community, Rankings, Fantasy, Shop, Membership |
| `hayes-app-demo.html` | iOS/Android app. Nine screens, drawer nav, sheets |
| `hayes-admin-demo.html` | Admin. Sixteen pages, light and dark |

They are mockups. Every number, name and row in them is fake. **Treat them as
pixel-accurate design references, not as code to copy forward.**

### What to take from them

- The full token set: colours, type scale, spacing, radii, the light/dark theme
  variables. Both themes must survive.
- Component structure and class names where they are sensible.
- Layout, breakpoints and responsive behaviour.
- Copy. The writing has been through several client rounds. Keep it.

### What to strip

- Every hardcoded value. Names, counts, prices, scores, chat messages, rankings,
  order rows, KPI figures. All of it comes from the database.
- Anything marked `data-ph`. That attribute flags a value we invented and the
  client has not confirmed. Search for it; nothing with that attribute ships
  without being replaced by real data or a real client answer.
- Inline `style=` attributes. Move them into the stylesheet.
- The demo routers. Both demos fake navigation with `display:none` and a hash
  listener. Replace with real routing.
- Every fake interaction. Toggles that only flip a class, buttons that fire a
  toast, the tip sheet that appends a div. Those become real mutations.

---

## Stack

Match Southcoast. It works and he already pays for it.

- **Next.js (App Router)** on Vercel
- **Firebase** — Auth and Firestore
- **Cloudflare Stream** — two live inputs, see the hard rules below
- **Cloudflare Realtime (SFU)** — guest video
- **Cloudflare Workers + Durable Objects** — chat and studio signalling
- **Relay container on Fly.io** — MediaMTX plus ffmpeg, simulcast out
- **Stripe** — memberships, tips, merch. Client is merchant of record
- **Printful or Printify** — print on demand, fulfilment webhooks
- **Expo (React Native)** — the app, both stores, published under the client's
  own developer accounts

Do not add a vendor without asking. Every one becomes part of the product he
owns and has to maintain.

---

## Hard rules, learned the expensive way

These are not preferences. Each one cost real debugging on the first build.

**1. There are two Cloudflare live inputs, not one.**
The browser studio ingests over WHIP. A WHIP input produces no HLS and no VOD
recording, and Cloudflare will not forward it to Live Outputs. So the relay
always pushes an RTMPS copy into a second input, which feeds the public player
and the archive. This runs even with zero external destinations.

```
studio --WHIP--> input A --WHEP--> relay --RTMP--> YouTube / Facebook
                                         --RTMPS-> input B --> site player + VOD
```

**2. Never `-c copy` to RTMP.**
YouTube needs CBR with a 2-second closed GOP to build its quality ladder. WebRTC
emits keyframes on demand. Passing it through makes YouTube serve a low
rendition while the site looks fine. Re-encode once with explicit
`-g`/`-keyint_min`, `-sc_threshold 0` and `nal-hrd=cbr:force-cfr=1`, then fan out
with ffmpeg `tee` and `onfail=ignore`.

**3. Going live is two calls, not one.**
Publishing WHIP does not start the simulcast. The studio must call the simulcast
start endpoint after publishing, with a retry, because Cloudflare lags behind the
WHIP connect. On the first build this was missing and YouTube silently never
received anything.

**4. Cap the stage.**
The host's browser composites every guest on stage, so it is a hardware limit.
Default six. Guests beyond it wait backstage with their media never pulled.

**5. Show destination health while live.**
The host must be able to see that YouTube is actually receiving. Poll relay
status every 5s and surface per-destination state. Do not let a dead stream key
fail silently.

---

## Data model

Firestore. Collections, not an exhaustive schema — infer fields from the
templates.

```
users          auth, display name, handle, avatar, roles[]
memberships    tier (timmy | coordinator), stripeSubId, status, discordSynced
shows          name, cadence, team, channel, graphicsPreset
broadcasts     showId, title, scheduledAt, status, inputs, recordingId, chapters[]
destinations   showId, platform, url, keyRef, enabled     // per-show routing
posts          authorId, body, mediaRef, room, visibility, reactions
rooms          name, public (drives indexing), minTier
players        name, position, school, classYear, slug
grades         playerId, chips{power,speed,motor,technique,iq}, notes, videoId, published
submissions    playerName, film, submitterId, status, priority
leagueLevels   entry, prize, seats, filled
entrants       userId, levelId, email, paymentStatus, inviteSent
products       name, price, memberPrice, colourways[], printProviderId
orders         userId, items[], status, fulfilmentId
tips           userId, amount, method, broadcastId, message
```

**Per-show routing is the differentiator.** A Miami show must never land on a
Colorado audience. Destinations belong to shows, not to the account.

---

## Phases

Ship each one. Do not build them in parallel.

### Phase 0 — foundation
Extract design tokens into one stylesheet. Build the component library from the
templates. Set up Firebase, schema, auth, roles. Nothing user-facing.
**Done when:** a component gallery renders every element from all three
templates in both themes, driven by props.

### Phase 1 — broadcast
This is the core product and it must be right before anything else.
Studio, both Cloudflare inputs, relay, per-show routing, merged chat, archive,
public live page.
**Done when:** he goes live from a browser, it appears on his site and YouTube
at good quality, the recording files itself, and the health panel reads true.

### Phase 2 — membership
Stripe subscriptions on his tiers, gated content, Discord role sync both ways.
Existing YouTube members link their account and keep their perks.
**Done when:** someone subscribes on the site and their Discord role appears
within seconds.

### Phase 3 — community
Feed, rooms, roles, moderation. Public rooms server-rendered and indexable.
Gated rooms `noindex`.
**Done when:** a public post is fetchable by Googlebot and a gated one is not.

### Phase 4 — rankings
Player pages, the five-chip grading tool, submissions queue.
**Done when:** each player has a server-rendered page with correct metadata.

### Phase 5 — merch
Print-on-demand, Stripe checkout on his domain, member pricing, fulfilment
webhooks.

### Phase 6 — fantasy
Level signup, entrant tracking, payment status, automated Fantrax invites.
**Read the legal note below before writing any of it.**

### Phase 7 — apps
Expo build of the nine screens. Push notifications. Store submission under his
own Apple and Google accounts.

---

## Things that will bite you

**Fantasy entry fees.** He runs three paid levels and keeps roughly 10%. That
makes him a contest operator, which is regulated state by state, and most payment
processors restrict it. **The platform tracks entrants and payment status and
sends invites. It does not process entry fees.** Do not build a checkout for
league entry without written sign-off from the client's lawyer and his processor.

**Minors.** The rankings grade high school players. Build a removal-request flow
and an admin queue for it from day one. Do not expose contact details, home
addresses or anything beyond school, position and class year.

**Members-only video cannot live on YouTube.** Public breakdowns embed from
YouTube. Gated film is served from Cloudflare Stream with signed URLs, or the
paywall is decorative.

**Migration is not a switch.** He has roughly 1,200 Discord members, existing
YouTube memberships, a Spring store and a WordPress site with search equity.
Run both in parallel through a season. Map every existing WordPress URL to a 301.
Nothing switches off on day one.

**Don't break his SEO.** The site reorganises from show-first to team-and-player
first. That is deliberate, but every existing URL needs a redirect.

---

## Definition of done, every phase

- No hardcoded content. No `data-ph` attributes left.
- Renders correctly in light and dark.
- Works on a phone. The community feed and live page were designed mobile-first.
- Server-rendered with correct metadata on anything public.
- Loading, empty and error states exist. **Especially the off-air state** — he
  streams five nights a week, so most visitors arrive when nothing is live, and
  the templates only show the on-air case. Design it to match.
- No secret in client code. Stream keys, Stripe keys and Discord tokens are
  server-side only.

---

## Ask before you assume

Do not invent answers to these.

- Membership prices. Templates assume $4.99 and $9.99; unconfirmed.
- The five chip names. Read from broadcast graphics; confirm with the client.
- Whether to pass the Stripe fee to the buyer, and whether it is itemised or
  priced in.
- The merch discount, currently assumed at 10%.
- Fantasy: whether entry fees ever run through the platform.
- Whether Discord stays permanently or is retired after a season.

When something is ambiguous, stop and ask. A wrong assumption compounds across
every phase that builds on it.
