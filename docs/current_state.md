# RenGör — Current State
_Last updated: 2026-06-05 (arbetspass-system)_

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.7 / App Router, TypeScript, `src/` dir |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database / Auth | Supabase (Postgres + Auth) |
| Image storage | Supabase Storage |
| Client cache | TanStack Query (installed, not yet wired to routes) |
| GHL integration | HighLevel API v2 |
| SMS | GHL Conversations API (provider field ready for 46elks/Twilio swap) |
| Font | DM Sans + DM Mono (Plus Jakarta Sans planned) |

---

## File structure — key files

```
src/
  proxy.ts                        # Next.js 16 auth proxy (currently passthrough)
  lib/
    supabase/
      client.ts                   # typed browser client
      server.ts                   # typed server client (Server Components / reads)
      server-raw.ts               # untyped server client (mutation API routes)
      service.ts                  # service-role client (bypasses RLS — webhooks only)
      middleware.ts               # updateSession helper (used by proxy.ts when auth is on)
    gohighlevel/
      client.ts                   # GHL API v2 wrappers (calendar, contacts, conversations)
      webhooks.ts                 # typed payload parsers for appointment + contact events
  app/
    (auth)/login/                 # Swedish login form
    (dashboard)/
      layout.tsx                  # reads real profile when session exists; dev stub otherwise
      dashboard/                  # stats + recent bookings (hardcoded 0-state)
      calendar/                   # full calendar page — fetches real data from Supabase
      bookings/                   # table view (hardcoded empty)
      jobs/                       # kanban board (hardcoded empty)
      workers/                    # table (hardcoded empty)
      settings/                   # placeholder
    api/
      bookings/                   # GET/POST list+create; GET/PATCH/DELETE single
      jobs/[id]/images/           # POST upload before/after image to Storage
      sms/send/                   # POST send SMS via GHL, write sms_log
      webhooks/ghl/               # POST receive GHL appointment/contact webhooks
  components/
    calendar/
      calendar-view.tsx           # toolbar, filters, status legend, view switcher
      day-view.tsx                # 24h grid, lane-based overlap layout, live time line
      week-view.tsx               # 7-col grid, same layout engine, per-column time line
      month-view.tsx              # compact monthly grid, click to drill to day
      booking-detail-panel.tsx    # slide-in detail panel, links to /bookings/[id]
      calendar-utils.ts           # layout math: computeBookingLayouts, time helpers
    layout/
      sidebar.tsx
      top-bar.tsx                 # shows user avatar initials, calls signOut() on logout
      providers.tsx
    auth/login-form.tsx
    booking/bookings-table.tsx
    jobs/jobs-board.tsx
    workers/workers-table.tsx
  types/
    index.ts                      # Booking, CleaningJob, SmsLog, ActivityLog, etc.
    database.ts                   # Supabase Database type stub
supabase/
  schema.sql                      # full initial schema (run once on a fresh DB)
  migrations/
    001_additive.sql              # additive migration for existing DBs (idempotent)
```

---

## Database schema

| Table | Purpose |
|---|---|
| `profiles` | Workers/admins (extends `auth.users` via trigger), roles: admin/manager/worker |
| `customers` | Customer records, linked to GHL contact ID |
| `cars` | Cars per customer (make, model, reg plate, VIN, color) |
| `bookings` | Core booking — customer, car, worker, status, GHL appointment ID, calendar_color, two SMS flags |
| `cleaning_jobs` | Job execution — worker, status, started/completed timestamps, notes |
| `job_images` | Before/after images with storage path, uploader, type |
| `sms_logs` | SMS audit trail — type (confirmation/ready_for_pickup/manual), provider, delivery timestamp |
| `activity_log` | Audit trail — who did what, actor_id enforced to match auth.uid() |
| `highlevel_sync_logs` | Webhook + sync audit, unique index on (highlevel_id) for idempotency |

RLS on all tables. Auto-trigger creates `profiles` row on signup.

**New columns added via `001_additive.sql`** (use this for existing DBs):
- `bookings.calendar_color` — hex color override for calendar display
- `bookings.sms_ready_for_pickup_sent` — second SMS flag for "car is ready" flow
- `sms_logs.sms_type`, `sms_logs.provider`, `sms_logs.provider_message_id`, `sms_logs.delivery_callback_at`
- SMS unique partial index prevents duplicate auto-sends (blocks pending + sent, not just sent)
- `images_insert_auth` policy dropped; replaced with `images_insert_own_job` (workers can only upload to their own job)
- `activity_log_insert` enforces `auth.uid() = actor_id` (entries cannot be forged)

---

## Auth

- Supabase Auth, three roles: `admin` / `manager` / `worker`
- **Currently bypassed** — `src/proxy.ts` returns `NextResponse.next()` unconditionally
- Dashboard layout falls back to a `DEV_PROFILE` stub when no session exists
- Calendar page falls back to service-role client in `development` only (gated on `NODE_ENV`)
- **To enable auth**: replace `proxy.ts` body with `return updateSession(request)`, remove `DEV_PROFILE` fallback from `layout.tsx`

Logout calls `supabase.auth.signOut()` before redirecting (was missing before).

---

## Calendar — the main feature

Full Google Calendar-like experience, Swedish UI, three views:

**Dag (Day):** 24h vertical time grid, booking blocks proportional to duration, lane-based overlap layout (concurrent bookings render side-by-side, not on top of each other), live current-time line updating every 60s, SMS dot, click → detail panel.

**Vecka (Week):** 7-column grid with week number, same lane layout per column, current-time line on today only.

**Månad (Month):** compact monthly grid, up to 3 events per cell, click day → drills to dag view.

**Toolbar:** Idag button, prev/next navigation, status filter, worker filter, status legend with per-status counts.

**Booking detail panel:** slides in on click, shows service/time/address, customer name+phone, car make/model/plate/color, assigned worker, notes, SMS status. "Öppna bokning" links to `/bookings/[id]`.

**Data:** fetched server-side from Supabase at page load. Bookings and active workers.

---

## GHL webhook (`/api/webhooks/ghl`)

- **Signature:** Ed25519 via `X-GHL-Signature`. Reads `GHL_WEBHOOK_PUBLIC_KEY` — must be the raw 32-byte Ed25519 public key, base64-encoded (NOT DER/SPKI). Missing key rejects all requests in production; skipped only in `NODE_ENV=development`.
- **Idempotency key:** `${type}:${entityId}:${contentHash}` — content hash covers the mutable fields (status, startTime, endTime for appointments; name/email/phone for contacts). Identical retries deduplicate; genuine updates with different content get a new key and are processed.
- **Race-safe flow:** row is inserted as `success=false` before processing (outside the unique index). On success it is flipped to `success=true` (entering the index). A crash before the flip leaves a retryable failed row. Two concurrent requests for the same delivery both process (business ops are idempotent) and whichever commits first wins.
- **Unique index:** partial on `action = 'webhook_received' AND success = true` — failed rows are excluded so retries are never permanently blocked.
- **Client:** uses service-role client to bypass RLS (safe because request is verified first).
- **Payload shape:** appointment fields are nested under `appointment{}`. Uses `apt.appointmentStatus` not `apt.status`.

---

## API routes

| Route | Methods | Notes |
|---|---|---|
| `/api/bookings` | GET, POST | Filters: status, worker_id, from, to |
| `/api/bookings/[id]` | GET, PATCH, DELETE | Single booking CRUD |
| `/api/jobs/[id]/images` | POST | Upload to Supabase Storage |
| `/api/sms/send` | POST | Manual SMS via GHL; writes sms_log |
| `/api/webhooks/ghl` | POST | GHL appointment/contact sync |

---

## Arbetspass-system (2026-06-05)

Anställda kan lägga in pass, Göran godkänner dem.

**Ny migration:** `supabase/migrations/002_shifts.sql` — kör i Supabase SQL editor efter 001.

**Nya filer:**
- `src/types/index.ts` — `Shift`, `ShiftStatus` tillagda
- `src/app/api/shifts/route.ts` — GET (filtrera på worker, status, datum) + POST (skapa pass)
- `src/app/api/shifts/approve/route.ts` — POST godkänn/avvisa (kräver admin/manager-roll)
- `src/components/shifts/create-shift-modal.tsx` — modal för att lägga in pass, skickas med status=pending
- `src/components/shifts/pending-shifts-banner.tsx` — banner på dashboard, Göran godkänner direkt
- `src/components/shifts/pending-shifts-panel.tsx` — återanvändbar panel (admin ser alla, worker ser sina)
- `src/app/(dashboard)/my-shifts/page.tsx` — "Mina pass" — sök, filtrera status, se kopplade bokningar + kommentarer

**Flöde:**
1. Anställd klickar "Lägg in pass" (sidomeny: Mina pass) → fyller i starttid, sluttid, ev. kommentar
2. Pass skapas med status=pending och syns direkt i "Mina pass"
3. Göran ser gul banner på dashboard → godkänner eller avvisar med ett klick
4. Kommentarer och önskemål på bokningar visas tydligt (blå badge) under kopplade pass

## Skapa bokning-flöde (2026-06-05)

Göran och tekniker kan nu skapa bokningar direkt i kalendern:

- **Klick på tom tid** i dag- eller veckovyn öppnar modal med tiden förifylld
- **"Ny bokning"-knapp** i toolbar öppnar samma modal med nuvarande tid
- **Modalen** (`create-booking-modal.tsx`) samlar: kund (namn, telefon, email), bil (märke, modell, regnr, färg), tjänst, längd, tekniker, pris, anteckningar
- **API** (`/api/bookings/create`) skapar kund (återanvänder vid samma telefonnummer) + bil + bokning i sekvens
- **SMS-bekräftelse** skickas automatiskt via GHL efter skapande; fel i SMS stoppar inte bokningen
- Dubbelbokningar tillåtna — ingen blockering i API:t
- Kalendern uppdateras via `window.location.reload()` efter skapande

## What is NOT built yet

| Feature | Priority |
|---|---|
| Booking detail page (`/bookings/[id]`) | High — "Öppna bokning" links here but page is 404 |
| Auto-SMS on booking create (confirmation) | High — GHL-integration klar men kräver highlevel_contact_id på kunden |
| Auto-SMS on job complete (ready for pickup) | High |
| 46elks SMS provider — decision pending | Medium |
| Worker views (`/my-cars`, `/my-cars/today`) | High |
| `/customers` and `/cars` pages | Medium |
| Activity log UI | Medium |
| Image thumbnail gallery on booking detail | Medium |
| TanStack Query wired (installed but unused) | Medium |
| `/settings/integrations/highlevel` page | Medium |
| Supabase Auth fully enabled (proxy.ts is passthrough) | **Before any real use** |
| Real data on bookings/jobs/workers pages (only calendar is live) | High |
| Drag-and-drop booking movement on calendar | Low |
| Plus Jakarta Sans font (planned) | Low |
| GHL_WEBHOOK_PUBLIC_KEY set to GHL's raw Ed25519 public key (base64) | Before webhooks go live |

---

## To get the app running locally

```bash
# 1. Install dependencies
npm install

# 2. Fill in credentials
# Edit .env.local — Supabase URL/keys are already set, add GHL keys

# 3. Run schema on a fresh Supabase DB
# → paste supabase/schema.sql into Supabase SQL editor

# OR for an existing DB, run the migration:
# → paste supabase/migrations/001_additive.sql

# 4. Create storage buckets in Supabase dashboard
# → car-before-images
# → car-after-images

# 5. Start dev server
npm run dev
# → http://localhost:3000 (redirects to /dashboard, auth bypassed, calendar shows real data)
```

**Build:** `npm run build` — passes, 0 errors  
**Lint:** `npm run lint` — passes, 0 errors, 0 warnings

---

## Repo

[github.com/HaiDaPlug/kalender-system](https://github.com/HaiDaPlug/kalender-system)
