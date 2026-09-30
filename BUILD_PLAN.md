# Coach Hayes Football — Build Plan

Derived from `BUILD_BRIEF.md`, the three approved templates in `/templates`, and the
existing base platform already present in `web/` and `mobile/`.

> **Prime directive:** This is a *second deployment* of an existing product. Reuse the
> existing base architecture in `web/` + `mobile/`. Do not redesign it and do not invent a
> new one. Reskin to the approved template design, strip every hardcoded value, and
> extend with the domains the brief adds. Ship one phase at a time.

---

## 1. Current state (what already exists in the base)

The base codebase is dropped in and working. Inventory:

**Streaming spine (Phase 1 — mostly present):**
- Browser studio: `components/GoLiveStudio.tsx`, `ControlRoom.tsx`, `app/admin/studio`, `app/admin/go-live`
- WHIP / Realtime / SFU: `lib/realtime*.ts`, `app/api/realtime`, guest join at `app/join/[room]`
- Simulcast API: `app/api/simulcast/{start,stop,status,warm,destinations}` + `lib/simulcast.ts`, `lib/relay.ts`
- Relay container: `web/relay/` (MediaMTX + ffmpeg + Fly.io)
- Chat + signalling worker: `web/worker/` (Durable Objects)
- Stream/VOD/webhook: `app/api/stream/*`, `lib/stream.ts`
- On-air graphics: `app/overlay`, `components/OnAirControl.tsx`, `LivePinnedOverlay.tsx`
- Public live page + player: `app/(site)/live`, `components/LivePlayer.tsx`, `LiveChat.tsx`

**Admin (matches most of template's 16 pages):**
- `app/admin/{analytics,branding,content,costs,go-live,help,login,on-air,schedule,settings,studio,team,tips,users,videos}`
- Runtime branding/content CMS → Firestore (`lib/siteConfig.ts`, `api/site-config`)

**Payments:** Stripe **one-time tips only** — `app/api/tips/{checkout,webhook}`, `lib/stripe.ts`, `components/TipModal.tsx`.

**Public site:** `app/(site)/{page,live,shows,library,about,contact}`.

**Mobile (Expo):** tabs (index/shows/schedule/archive), admin screens, studio, join, tips, chat — `mobile/src/`.

### What is MISSING vs. the brief
| Domain | Status |
|---|---|
| **Membership / subscriptions** | ❌ Only one-time tips exist. No recurring Stripe, no tiers, no gating. |
| **Discord role sync** | ❌ Nothing. |
| **Community feed / rooms / moderation** | ❌ Nothing (`posts`, `rooms` collections don't exist). |
| **Rankings: players / 5-chip grading / submissions** | ❌ Nothing. |
| **Merch / print-on-demand** | ❌ No Printful/Printify, no products/orders. |
| **Fantasy: levels / entrants / invites** | ❌ Nothing. |
| **Per-show destination routing** | ⚠️ Destinations exist but are account-level; brief requires **per-show**. |
| **Hayes design system** | ❌ Base is generic amber; templates are the approved design. |
| **Minors removal-request flow** | ❌ Nothing. |
| **WordPress 301 migration map** | ❌ Nothing. |

---

## 2. Design system reconciliation (the reskin)

The templates define a **dual-theme** token set that differs meaningfully from the base's
single-accent amber. This must become the single source of truth.

Tokens from `templates/hayes-site-demo.html` (`:root` / `[data-theme="dark"]`):
- **Light:** app `#FFFFFF`, ink `#1D1D1F`, accent `#0B6BFF` (blue), fonts Inter Tight / Inter.
- **Dark:** app `#000`, ink `#F5F5F7`, accent `#C8A96B` (gold), font Plus Jakarta Sans.
- Shared: `--green #34C759`, `--live #E8342A`, `--amber`, radii, spacing, hairlines.
- Membership badges are first-class: `.badge.timmy` (amber), `.badge.coord` (accent),
  `.badge.mod`, `.badge.coach` — the tier names **timmy / coordinator** are baked into the design.

**Rule:** extract all three templates' tokens into one stylesheet, drive both themes off
CSS variables, and delete the generic amber. `lib/brand.ts` becomes Hayes (name, domain,
shows = his five weekly shows, YouTube channels). No inline `style=`, no `data-ph` left.

---

## 3. Phased plan

Ordering follows the brief exactly. **Ship each phase before starting the next.**
Every phase must meet the global Definition of Done (§4).

### Phase 0 — Foundation  🟡 IN PROGRESS
*Goal: design system + data layer, nothing user-facing.*

**Done so far (testable locally):** base runs in demo mode; 3 approved templates served at
`/templates/*.html`; `lib/brand.ts` rebranded; Hayes tokens extracted to
`web/app/gallery/hayes.css` (scoped `.hz`); component gallery at `/gallery` renders core
elements in both themes from data; Firestore schema in `web/lib/schema.ts` + `firestore.rules`.
**Remaining:** expand the gallery to *every* template element (feed post, poll, rankings
chips, fantasy/shop, admin controls); wire Firebase auth + roles; produce the `data-ph` strip-list.


1. Extract the full token set from all three templates into one global stylesheet;
   wire light/dark off CSS variables. Keep both themes.
2. Build a **component library** from the templates (nav, cards, pills, badges, tiles,
   sheets, tables, chips, stage/player, chat). Prop-driven, no hardcoded content.
3. Rebrand `lib/brand.ts` → Coach Hayes Football (shows, channels, domain, copy from templates).
4. Firestore: define the collections from the brief's data model (§ brief). Set security
   rules (public read where indexed; tier/role-gated writes; server Admin SDK for privileged).
5. Auth + **roles** (`users.roles[]`): admin allowlist already in `lib/admin.ts`; extend to
   member tiers + mod/coach roles used by badges.
6. Audit templates for every `data-ph` and hardcoded value; produce a tracked strip-list.

**Done when:** a component gallery renders every element from all three templates, in both
themes, driven entirely by props. No `data-ph`, no hardcoded sample data in components.

---

### Phase 1 — Broadcast (core product; must be right first)
*Goal: he goes live from the browser → his site + YouTube at good quality, auto-recorded,
health panel true.*

Mostly present in the base — this phase is **verify, harden, and adapt to per-show routing**,
not build-from-scratch. Enforce the five hard rules:

1. **Two Cloudflare inputs** — WHIP input A (studio) + RTMPS input B (site player + VOD).
   Relay always pushes the RTMPS copy even with zero external destinations. Verify
   `lib/relay.ts` / `relay/` do this.
2. **Never `-c copy` to RTMP** — re-encode CBR, closed 2s GOP: explicit `-g`/`-keyint_min`,
   `-sc_threshold 0`, `nal-hrd=cbr:force-cfr=1`, then ffmpeg `tee` with `onfail=ignore`.
   Verify relay ffmpeg args.
3. **Going live is two calls** — after WHIP publish, call simulcast start with retry
   (Cloudflare lags the WHIP connect). Verify in `GoLiveStudio` / `api/simulcast/start`.
4. **Cap the stage at 6** — guests beyond it wait backstage, media not pulled. Verify studio.
5. **Destination health while live** — poll relay status every 5s, surface per-destination
   state. Verify `api/simulcast/status` + `SimulcastManager.tsx` / health panel.
6. **Per-show routing (NEW):** move `destinations` from account-level to `destinations{showId}`.
   A Miami show must never simulcast to a Colorado audience. Update schema, admin destination
   UI, and simulcast start to resolve destinations by the broadcast's `showId`.
7. **Off-air state (NEW):** templates only show on-air; build loading/empty/off-air for the
   public live page (he's off-air most of the time — most visitors land here).

**Done when:** live from a browser appears on site + YouTube at good quality, recording
files itself to the archive, health panel reads true, destinations are correct per show.

---

### Phase 2 — Membership
*Goal: subscribe on the site → Discord role appears within seconds.*

New build (base has only one-time tips).

1. **Stripe subscriptions** on his tiers (`timmy` / `coordinator`) — extend `lib/stripe.ts`
   with recurring prices, customer portal, `checkout.session.completed` +
   `customer.subscription.*` webhooks → write `memberships{tier,stripeSubId,status}`.
2. **Content gating** by tier — server-side guards; gated film served from **Cloudflare
   Stream signed URLs** (never YouTube — see §5).
3. **Discord role sync both ways** — new integration (bot token/OAuth): subscribe → grant
   role; cancel → revoke; and reflect Discord state back. `memberships.discordSynced`.
4. **YouTube member link** — existing YouTube members link their account and keep perks.

**⚠️ Blocked on client answers:** tier prices (templates assume $4.99/$9.99, unconfirmed),
Stripe-fee handling, whether Discord is permanent or retired after a season.

**Done when:** someone subscribes on the site and their Discord role appears within seconds.

---

### Phase 3 — Community
*Goal: public post fetchable by Googlebot; gated post is not.*

New build. Collections: `posts`, `rooms`.

1. Feed + rooms + roles + moderation (timeout/ban/remove — reuse chat moderation patterns).
2. **Public rooms server-rendered and indexable**; gated rooms `noindex`, tier-gated by `minTier`.
3. Mobile-first (feed was designed mobile-first in the app template).

**Done when:** a public post is fetchable by Googlebot and a gated one is not.

---

### Phase 4 — Rankings
*Goal: each player has a server-rendered page with correct metadata.*

New build. Collections: `players`, `grades`, `submissions`.

1. Player pages (server-rendered, correct metadata/slug).
2. **Five-chip grading tool** (power/speed/motor/technique/iq) — **confirm chip names with
   client** before shipping (read from broadcast graphics).
3. Submissions queue (film submissions, priority, status).
4. **Minors protection (day one):** removal-request flow + admin queue. Expose only school,
   position, class year — never contact details, home address, anything more.

**Done when:** each player has a server-rendered page with correct metadata.

---

### Phase 5 — Merch
*Goal: checkout on his domain with member pricing; fulfilment webhooks.*

New build. Collections: `products`, `orders`. New vendor: **Printful or Printify** (ask which).

1. POD product sync (colourways, print provider IDs).
2. Stripe checkout **on his domain** (merchant of record = client), member pricing
   (discount assumed 10% — **confirm**).
3. Fulfilment webhooks → `orders.fulfilmentId/status`.

**Done when:** member sees member price, checkout completes on-domain, fulfilment webhook
updates the order.

---

### Phase 6 — Fantasy  ⚠️ READ LEGAL NOTE FIRST
*Goal: entrant + payment-status tracking and automated Fantrax invites.*

New build. Collections: `leagueLevels`, `entrants`.

1. Level signup, entrant tracking, payment **status** field, automated Fantrax invites.
2. **The platform does NOT process entry fees.** He keeps ~10%, which makes him a regulated
   contest operator. **Do not build league-entry checkout** without written sign-off from
   the client's lawyer *and* his payment processor.

**Done when:** entrants and payment status are tracked and invites send — with **no** entry-fee
checkout unless legal sign-off is on file.

---

### Phase 7 — Apps
*Goal: the nine app screens shipped to both stores under his own accounts.*

Extend existing Expo app in `mobile/`.

1. Reskin `mobile/` to the app template (`hayes-app-demo.html`, 9 screens, drawer nav, sheets).
2. Wire to the same backend (Firebase/Cloudflare/Stripe) — live player, merged chat, tips,
   shows/schedule/archive, plus the new domains as applicable.
3. Push notifications (go-live alerts).
4. Store submission under **his own** Apple + Google developer accounts.

---

## 4. Definition of Done (every phase)

- No hardcoded content; no `data-ph` attributes remain.
- Renders correctly in **light and dark**.
- Works on a phone (community feed + live page are mobile-first).
- Server-rendered with correct metadata on anything public.
- Loading, empty, and **off-air** states exist (off-air is the common case).
- No secret in client code — stream keys, Stripe keys, Discord tokens are server-side only.

---

## 5. Cross-cutting constraints (apply throughout)

- **Members-only video ≠ YouTube.** Public breakdowns embed YouTube; gated film = Cloudflare
  Stream signed URLs, or the paywall is decorative.
- **Migration is parallel-run, not a switch.** ~1,200 Discord members, existing YouTube
  memberships, Spring store, WordPress with SEO equity. Run both through a season.
- **Don't break SEO.** IA moves show-first → team/player-first (deliberate), but map **every**
  existing WordPress URL to a 301.
- **No new vendors without asking.** Every vendor becomes something the client must maintain.
- **Per-show routing is the differentiator** — destinations belong to shows, not the account.

---

## 6. Open questions — ASK before building (do not assume)

1. Membership prices (templates assume $4.99 / $9.99 — unconfirmed).
2. The five chip names (confirm against broadcast graphics).
3. Stripe fee: pass to buyer? itemised or priced-in?
4. Merch member discount (assumed 10%).
5. Fantasy: do entry fees ever run through the platform? (default: **no**, per legal note).
6. Discord: permanent, or retired after a season?
7. Printful vs. Printify for POD.

These compound across phases — a wrong assumption in Phase 0/2 breaks everything downstream.

---

## 7. Suggested immediate next step

Per the brief's start prompt: **do Phase 0 only first.** Deliver (a) the extracted design
token stylesheet + component gallery in both themes, and (b) the Firestore schema, for
review — *before* building any pages. Get answers to the §6 questions that affect Phase 0/2
(prices, chip names, Discord longevity) in parallel.
