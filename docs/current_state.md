# KOM-fort Bilvård — Portal: Current State
_Last updated: 2026-09-16 (robustness pass: shared auth helper, API hardening, real dashboard data, design system)_

---

## About the project

Internal all-in-one system for KOM-fort Bilvård. The calendar is the core — everything flows from it.
Built specifically for Goran's and the workers' daily workflow, not a generic calendar tool.

- **Repo:** [github.com/HaiDaPlug/kalender-system](https://github.com/HaiDaPlug/kalender-system)
- **Dev server:** `npm run dev` → http://localhost:3000

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.7 / App Router, TypeScript, `src/` structure |
| Styling | Tailwind CSS v4 + shadcn/ui, black-and-gold dark theme (`#121110` base, `#F5C842` accent) + shared component classes in `globals.css` (see "Design system" below) |
| Database / Auth | Supabase (Postgres + Auth) — Hai's project: `vsnbaylcgcksabwradgu` |
| Image storage | Supabase Storage (buckets: `car-before-images`, `car-after-images`) |
| GHL integration | HighLevel API v2 |
| SMS | 46elks (confirmation on booking approval) |
| Font | DM Sans + DM Mono |
| Animations | Framer Motion (installed, used for modal/panel transitions) |
| Notifications | Sonner (toast) — mounted once in `providers.tsx`, bottom-right |

---

## File structure — key files

```
src/
  proxy.ts                             # Auth proxy — ACTIVE, calls updateSession on every request except static assets
  types/index.ts                       # All types: Booking, Shift, CleaningJob, ImageRecord, etc.
  lib/
    auth/session.ts                    # ✅ getSession() / requireApiUser(roles) — the ONE way server code resolves the caller (user + profile + role + is_active)
    api.ts                             # ✅ Route-handler helpers: jsonError, readJsonObject (safe body parse), pickAllowed (allow-list), validators
    status.ts                          # ✅ Single source of status labels + colors (booking / job / shift) used by every badge, legend and filter
    time.ts                            # ✅ Europe/Stockholm helpers: businessDayRange() for "today" queries on a UTC server
    hooks/use-local-flag.ts            # ✅ localStorage boolean via useSyncExternalStore (sidebar collapsed state)
    supabase/
      client.ts                        # Browser client (typed)
      server.ts                        # Server client for reads
      server-raw.ts                    # Untyped client (no longer used by routes; kept for ad-hoc scripts)
      service.ts                       # Service-role, bypasses RLS — typed; reads SUPABASE_SECRET_KEY (falls back to SUPABASE_SERVICE_ROLE_KEY)
      middleware.ts                    # updateSession — redirects unauthenticated pages to /login, 401 JSON on /api/*, exempts /api/webhooks/*
    sms/
      46elks.ts                        # Send via 46elks; exports normalisePhone (E.164)
      confirmation.ts                  # ✅ sendConfirmationSms — the shared template → sms_log → 46elks → flag flow used by create + approve
      sms-parts.ts                     # GSM-7 / Unicode part counter (client-safe)
    email/resend.ts                    # Resend emails — HTML-escaped, 10s timeout, never throws
    gohighlevel/
      client.ts                        # GHL API v2: calendar, contacts, SMS
      webhooks.ts                      # Payload parsers for appointment + contact
  app/
    (auth)/login/                      # Login page (Swedish UI)
    (dashboard)/
      layout.tsx                       # getSession(): unauthenticated → /login; deactivated or profile-less → <AccountBlocked> screen (no redirect loop)
      dashboard/page.tsx               # ✅ Overview with REAL data: greeting, 4 stat cards, pending banners, today's schedule, recently added
      calendar/page.tsx                # Calendar — fetches data from Supabase
      bookings/page.tsx                # Bookings list — not linked in sidebar (calendar covers this)
      bookings/[id]/page.tsx           # ✅ Booking detail page with full editing + job photo section
      customers/[id]/page.tsx          # ✅ Customer history: visits, cars, SMS, notes
      my-shifts/page.tsx               # ✅ Server shell — resolves the real session user and renders components/shifts/my-shifts-view.tsx (DEV_USER stub is gone)
      jobs/page.tsx                    # ✅ Kanban board — fetches live data from /api/jobs
      admin/job-reviews/page.tsx       # ✅ Admin before/after photo review page (Goran only)
      admin/sms-templates/page.tsx     # ✅ Admin SMS template editor — variable chips, GSM-7 part counter
      workers/page.tsx                 # ✅ Staff management — list all employees, change roles, activate/deactivate, add new (own row locked)
      bookings/page.tsx                # Flat newest-first list of the last 200 bookings (not in sidebar)
      settings/page.tsx                # Placeholder — not linked in sidebar
    api/                               # Every route starts with requireApiUser(roles?) from lib/auth/session.ts — no dev bypasses remain
      bookings/route.ts                # GET list (validated filters); POST low-level insert (admin/manager, allow-listed)
      bookings/create/route.ts         # ✅ POST customer+car+booking+SMS — normalises phone, reuses customer by phone and car by plate
      bookings/[id]/route.ts           # GET; PATCH (admin, allow-listed + validated); DELETE (admin, service client, detaches sms_logs, 404 if nothing deleted)
      shifts/route.ts                  # ✅ GET filter shifts; POST — worker is the session user (reviewers may pass workerId), ≤24h
      shifts/approve/route.ts          # ✅ POST approve/reject — reviewer = session user (body reviewerId ignored), only pending shifts
      customers/[id]/route.ts          # ✅ GET full customer profile; PATCH (admin/manager, allow-listed: notes, name, email, phone, address)
      sms/send/route.ts                # POST manual SMS via 46elks (admin/manager) — logged as 'manual', does NOT set sms_confirmation_sent
      webhooks/ghl/route.ts            # POST GHL appointment/contact sync
      jobs/route.ts                    # ✅ GET list (?booking_id=); POST create job — worker = caller for staff, returns existing job (200) instead of 500
      jobs/[id]/route.ts               # ✅ GET; PATCH — workers only their own job, cannot set completed / admin_notes
      jobs/[id]/images/route.ts        # ✅ POST upload — image/* only, ≤15 MB, caller must own the job or be a reviewer
      workers/route.ts                 # ✅ GET employees (RLS-scoped); POST invite (admin) — validates email, rejects duplicates
      workers/[id]/route.ts            # ✅ PATCH role/is_active (admin) — cannot edit yourself, cannot remove the last active admin
  components/
    ui/
      modal.tsx                        # ✅ Reusable Modal + SidePanel with smooth CSS transitions
      lightbox.tsx                     # ✅ Fullscreen image lightbox with arrow + keyboard navigation
      status-badge.tsx                 # ✅ <StatusBadge status kind="booking|job|shift" size> — pill with glowing dot, reads lib/status.ts
      page-header.tsx                  # ✅ <PageHeader title subtitle actions leading> — one heading pattern for every page
      button.tsx                       # shadcn Button, now a thin wrapper over the .btn classes (unused by the app today)
    auth/account-blocked.tsx           # ✅ Full-screen "deactivated / no profile" screen with a real sign-out button
    dashboard/today-schedule.tsx       # ✅ Today's bookings list (time, customer, car, worker, status) → /bookings/[id]
    shifts/my-shifts-view.tsx          # ✅ Client half of /my-shifts (search, filter, list, linked bookings)
    calendar/
      calendar-view.tsx                # Full-bleed toolbar (nav, title, view dropdown, status/worker filters, "Ny bokning" at far right) + status legend footer below the grid
      day-view.tsx                     # 24h grid, 15-min snap slot clicks, live time line
      week-view.tsx                    # 7-col grid, 15-min snap per column, compact day headers (day name above date circle, V{week} in the left spacer)
      month-view.tsx                   # Month view, click → day view
      booking-detail-panel.tsx         # Slide-in panel from right on booking click
      calendar-utils.ts                # Layout math, time helpers, HOUR_PX / TIME_COL_PX constants
      create-booking-modal.tsx         # ✅ Modal: customer, car, service, status, worker, price
    shifts/
      create-shift-modal.tsx           # ✅ Modal for worker to submit a shift (no workerId sent — server uses the session)
      pending-shifts-banner.tsx        # ✅ Amber banner on dashboard — approve/reject directly (pending-shifts-panel.tsx was unused and is removed)
    jobs/
      jobs-board.tsx                   # ✅ Kanban board component (4 columns by status) — cards link to /bookings/[id]
      job-photos.tsx                   # ✅ Before/after photo upload component for workers
    layout/
      sidebar.tsx                      # Side menu: Översikt, Kalender, Mina pass, Jobb, Granskning*, SMS-mallar**, Personal* (*admin/manager, **admin only). Collapsible (icon rail, persisted in localStorage). No wordmark/logo. Bottom-up: notifications bell → account section (avatar/name/role, click opens popup with known-accounts switcher + "Logga ut", wired to Supabase sign-out).
      top-bar.tsx                      # Top bar with page title + date only — no avatar/notifications/logout (moved into sidebar account section)
      providers.tsx
    auth/login-form.tsx                 # Reads ?email= to prefill (used by account switcher); remembers account (email/name/role) to localStorage on successful login
  lib/
    utils/known-accounts.ts             # ✅ localStorage-backed list of previously logged-in accounts (max 6) — read/written by sidebar switcher + login-form
    booking/bookings-table.tsx
    dashboard/dashboard-stats.tsx
    dashboard/recent-bookings.tsx
supabase/
  schema.sql                           # Full schema — run once on a fresh DB
  migrations/
    001_additive.sql                   # Additive: calendar_color, SMS columns, RLS fixes
    002_shifts.sql                     # ✅ Shifts table with RLS
    003_cleaning_jobs.sql              # ✅ cleaning_jobs + job_images tables with RLS
    007_booking_worker_submit.sql      # ✅ created_by on bookings + worker INSERT policy (pending only)
```

---

## Database

| Table | Purpose |
|---|---|
| `profiles` | Employees, roles: admin (Administratör) / manager (Admin) / worker (Personal) |
| `customers` | Customer registry linked to GHL |
| `cars` | Cars per customer (make, model, plate, color) |
| `bookings` | Core booking — customer, car, worker, status, SMS flags |
| `shifts` | Work shifts — worker_id, starts_at, ends_at, status (pending/approved/rejected) |
| `cleaning_jobs` | Job execution — one per booking, tracks status + timestamps |
| `job_images` | Before/after photos — job_id, storage_path, public_url, type (before/after), uploaded_by |
| `sms_logs` | SMS log with type, provider, delivery time. Status: pending/sent/delivered/failed/unknown |
| `sms_templates` | Global SMS message templates — one active row enforced by partial unique index |
| `activity_log` | Audit trail |
| `highlevel_sync_logs` | Webhook log with idempotency |

**Migrations to run in order:**
1. `schema.sql` (fresh DB) or skip if tables already exist
2. `001_additive.sql`
3. `002_shifts.sql`
4. `003_cleaning_jobs.sql`
5. `004_admin_manage_profiles.sql` — admins can update/insert any profile row
6. `005_bookings_admin_only.sql` — booking insert/update restricted to admin only (was admin+manager)
7. `006_fix_profiles_policy_recursion.sql` — fixes RLS infinite recursion on profiles via security-definer helper
8. `007_booking_worker_submit.sql` — adds `created_by`, opens booking INSERT to workers (pending status only)
9. `008_sms_templates.sql` — creates `sms_templates` table, adds `unknown` to `sms_logs` status constraint, seeds default confirmation template
10. `009_fix_handle_new_user_search_path.sql` — captures the `search_path = public` fix that was applied live on 2026-07-11 (plus `on conflict do nothing` so a pre-existing profile row never breaks signup)
11. `010_bookings_delete_and_sms_log_fk.sql` — **⚠️ NOT YET APPLIED TO THE LIVE DB (written 2026-09-16, run it in the SQL editor).** Adds the missing admin DELETE policy on `bookings`, changes `sms_logs.booking_id` to `on delete set null`, lets admin/manager insert `cleaning_jobs` for any worker, and adds `updated_at` triggers on bookings/customers/profiles. The API was written to work correctly even before this is applied (DELETE uses the service client and detaches SMS logs itself), so nothing is broken in the meantime — the migration makes the DB match the intent.

**Storage buckets (create manually in Supabase dashboard, set to public):**
- `car-before-images`
- `car-after-images`

---

## Auth

- Supabase Auth, three roles: `admin` (Administratör) / `manager` (Admin) / `worker` (Personal)
- **Enabled as of 2026-07-15.** `proxy.ts` calls `updateSession(request)` on every request except `_next/static`, `_next/image`, `favicon.ico`, and static image extensions.
- `updateSession` (`src/lib/supabase/middleware.ts`):
  - Unauthenticated + page route (not `/`, `/login`, `/register`, `/api/webhooks/*`) → 307 redirect to `/login`
  - Unauthenticated + `/api/*` route (excluding `/api/webhooks/*`) → `401 {"error":"unauthenticated"}` JSON, not a redirect (API callers shouldn't get an HTML page back)
  - `/api/webhooks/*` is always exempt — GHL calls this with no Supabase session at all; it authenticates via its own Ed25519 signature check instead (see GHL webhook section below)
  - Authenticated user hitting `/login` or `/register` → redirected to `/dashboard`, **except** `/login?email=...` (the sidebar account switcher's link) — that's let through so a signed-in user can actually reach the login form to sign in as a different account (see 2026-07-28 changelog)
- **`src/lib/auth/session.ts` is the single entry point for "who is calling" on the server (2026-09-16).** `getSession()` returns `{ user, profile, supabase }` or a typed failure (`unauthenticated` 401 / `no_profile` 403 / `inactive` 403). `requireApiUser(roles?)` wraps it for route handlers and returns a ready JSON error response. Every API route and every server page uses it — there are no more per-route copies of the `auth.getUser()` + `profiles` lookup, and **all `NODE_ENV === 'development'` bypass branches are gone.**
- **Deactivated employees are now actually locked out.** `profiles.is_active = false` was previously only a label on `/workers`; nothing enforced it. `getSession()` treats an inactive profile as a 403, so every API call fails and the dashboard layout renders `<AccountBlocked reason="inactive">` (a full-screen explanation with a real sign-out button) instead of the app.
- **The `/login` ⇄ `/dashboard` loop for a user with no profile row is closed** the same way: the layout renders `<AccountBlocked reason="no_profile">` instead of redirecting to `/login`.
- **Login flow:** `login-form.tsx` shows a brief "Loggar in…" spinner (~600ms) before navigating to `/dashboard`.
- **Role enforcement on the API (all server-side, independent of RLS):** admin-only → booking PATCH/DELETE, worker role/active changes, SMS-template PATCH, employee invites. Admin + manager → approve/reject bookings and shifts, customer PATCH, manual SMS, creating jobs/shifts on someone else's behalf. Workers → their own jobs/shifts only, cannot approve their own job (`status=completed`) or write `admin_notes`, cannot start a job on a booking assigned to someone else.
- **Request bodies are never spread into updates anymore.** `PATCH /api/bookings/[id]` and `PATCH /api/customers/[id]` used `{ ...body }`, so any column (`created_by`, `sms_confirmation_sent`, `highlevel_appointment_id`, …) could be written. Both now allow-list columns (`pickAllowed`) and validate types. Malformed JSON returns 400 instead of an unhandled 500 (`readJsonObject`).

---

## Calendar — the core

Three views: **Day / Week / Month**

- Hover over empty time → 30-min highlight block appears, snapped to **15-min grid**, time label centered in the block
- Bookings that run past midnight (e.g. a 3-hour session starting 23:00) visually spill into the next day's column instead of being cut off at the day boundary — continuation segment shown with a dashed edge and a `↳` prefix
- Click → opens "New booking" modal with time prefilled (15-min precision: :00 / :15 / :30 / :45)
- Click on existing booking → detail panel slides in from right
- "New booking" button in toolbar → same modal
- Double bookings allowed — no blocking in API
- Live time line updates every 60 seconds, auto-scrolls to current time on load
- Status filter + worker filter in toolbar
- After a booking is created, `router.refresh()` re-fetches server data without losing view/filter/scroll state (previously used `window.location.reload()`)

---

## Calendar — technical notes

- **`HOUR_PX = 60`** and **`TIME_COL_PX = 80`** in `calendar-utils.ts` — hour row height and hour-label column width. Hour labels are sized with an inline `style={{ height: HOUR_PX }}` (not a Tailwind `h-*` class) so they can never drift out of sync with the constant. All pixel calculations use these constants — never hardcode.
- **Slot click fix:** `getSlotFromEvent` uses `scrollRef.current.getBoundingClientRect()` (the scroll container), not the inner column div — prevents double-counting scroll offset.
- **15-min snap:** `Math.floor(y / (HOUR_PX / 4)) * 15` — one slot = `HOUR_PX / 4` pixels.
- **Hover block:** always 30 min tall (`HOUR_PX / 2`), top transitions at 80ms for a gliding feel.
- Auto-scrolls to current time on load (day + week views).
- Time line in week view spans all 7 columns as a single absolute element.
- **Overnight spillover:** `getBookingSegmentForDay`/`getDaySegments` in `calendar-utils.ts` clip each booking to a given day's `[00:00, 24:00)` window and flag `continuesFromPrev`/`continuesToNext`. `computeBookingLayouts` operates on these segments (not raw bookings), so a booking is rendered once per day it touches — the tail end appears at the top of the next day's column instead of overflowing past the bottom of the day it started in. `getBookingsForDay` (plain same-day filter) is kept as-is for `month-view.tsx`, which doesn't need segment geometry.
- Supabase key is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (not `ANON_KEY`).

---

## Popup transitions (`src/components/ui/modal.tsx`)

Two exported components — pure CSS transitions, no spring physics:

- **`<Modal>`** — centered dialog. Backdrop fades in (180ms), card lifts 6px + fades (180ms ease). Exit reverses cleanly. `useDelayedUnmount` keeps the element in the DOM until the exit transition finishes before React unmounts it.
- **`<SidePanel>`** — slides in from the right with `cubic-bezier(0.4,0,0.2,1)` (220ms), exits the same direction (200ms). Backdrop fades independently.
- Both close on `Escape` key and backdrop click.
- Used by: `CreateBookingModal`, `CreateShiftModal`, `BookingDetailPanel`.
- All three accept an `open` boolean and stay mounted so exit animations play.

---

## Booking flow (create)

1. Click time in calendar → modal opens with time prefilled (15-min precision)
2. Fill in: customer (name + phone required), car (make + model required), service, duration, status, worker, price, notes
3. `POST /api/bookings/create` — creates customer (reuses if phone number exists) + car + booking
4. SMS confirmation sent via 46elks (requires active template in `sms_templates`; skipped for worker-submitted pending bookings)
5. Calendar reloads

---

## Booking detail page (`/bookings/[id]`)

Edit directly on the page — no hidden forms:
- **Status** — click the right status badge
- **Time, duration, service, worker, price** — editable fields
- **Customer notes + internal notes** — clearly separated
- **History link** → jumps to customer's full history
- **Job documentation section** — visible when a worker is assigned (see Job photo flow below)
- **Delete** with confirmation dialog

---

## Job photo flow

Workers document their work directly from the booking detail page (`/bookings/[id]`).

**Worker flow:**
1. Open a booking that is assigned to them
2. Scroll to "Jobbdokumentation" section → `JobPhotos` component renders
3. Tap "Ta bild" (before) → phone camera opens, photo uploads to `car-before-images` bucket
4. Complete the job → tap "Ta bild" (after) → uploads to `car-after-images` bucket
5. Multiple photos can be added per phase
6. Status auto-updates: `not_started` → `in_progress` (on first before-photo) → `needs_review` (on first after-photo)

**Goran's review flow (`/admin/job-reviews`):**
1. Sidebar shows "Granskning" link (only for admin/manager)
2. Badge shows how many jobs are waiting
3. Filter: *Waiting / All / Done*
4. Jobs are grouped by date (Today / Yesterday / older dates) and sorted newest first
5. Each job card expands to show before and after photos side by side
6. Click any photo → opens fullscreen lightbox with arrow navigation (keyboard arrows + Escape supported)
7. Before approving, Goran can optionally write a comment to the worker
8. Click "Godkänn jobbet" → status changes to `completed`, comment saved as `admin_notes`
9. Worker sees Goran's comment on their booking page once the job is approved

**Technical notes:**
- `cleaning_jobs` has a `unique(booking_id)` constraint — one job per booking
- Job is created lazily: first photo upload triggers `POST /api/jobs` if no job exists yet
- Images are stored at `{jobId}/{timestamp}.{ext}` inside the bucket
- `GET /api/jobs?booking_id=` is used by `JobPhotos` to check if a job already exists
- `admin_notes` field on `cleaning_jobs` stores Goran's feedback comment
- Lightbox component lives at `src/components/ui/lightbox.tsx` — reused in both worker and admin views

---

## Customer history (`/customers/[id]`)

- Stats: visit count, completed count, car count, total spent
- All cars the customer has brought in with plates
- Most recent visit
- Customer notes (saved instantly)
- **Booking history** — clickable list, each row → booking page
- **SMS tab** — all SMS with type, timestamp, message text

---

## Shift system

**Flow:**
1. Worker goes to "My shifts" → "Add shift" → fills in start/end time + optional note
2. Shift created with `status=pending`
3. Goran sees yellow banner on dashboard → approves ✓ or rejects ✗ with one click
4. Worker sees their shifts with search + status filter
5. Each shift shows linked bookings (bookings whose time falls within the shift)

**Banner visibility:** Only rendered for `admin` and `manager` roles — workers never see it. `reviewerId` is passed from `DashboardPage` only when a real authenticated user exists, so the dev stub is not sent to the approval API. Error handling shows an inline red message if fetching, approving, or rejecting shifts fails, with a dismiss button.

---

## GHL webhook (`/api/webhooks/ghl`)

- Ed25519 signature via `X-GHL-Signature` (`GHL_WEBHOOK_PUBLIC_KEY` = raw 32-byte base64)
- Missing key rejects in production; skipped only in `NODE_ENV=development`
- Idempotency key: `${type}:${entityId}:${contentHash}` — real updates not dropped, identical retries deduplicated
- Race-safe: row inserted as `success=false` before processing, flipped to `true` after — retries never permanently blocked
- Unique index partial on `success=true` only

---

## API routes

| Route | Methods | Notes |
|---|---|---|
| `/api/bookings` | GET, POST | Filters: status, worker_id, from, to |
| `/api/bookings/create` | POST | Customer+car+booking+SMS atomically. Admin/manager bookings that default to `confirmed` revert to `pending` if the SMS send fails, instead of staying falsely confirmed |
| `/api/bookings/[id]` | GET, PATCH, DELETE | Single booking |
| `/api/shifts` | GET, POST | Filters: worker_id, status, from, to |
| `/api/shifts/approve` | POST | Approve/reject (admin/manager) |
| `/api/customers/[id]` | GET, PATCH | Customer profile + history |
| `/api/sms/send` | POST | Manual SMS via 46elks (admin/manager only) |
| `/api/webhooks/ghl` | POST | GHL sync |
| `/api/jobs` | GET, POST | List jobs (`?booking_id=` filter), create job |
| `/api/jobs/[id]` | GET, PATCH | Single job — status, notes, timestamps |
| `/api/jobs/[id]/images` | POST | Upload image to Supabase Storage |
| `/api/workers` | GET, POST | GET: `?all=true` includes inactive; POST: invite new employee via Supabase Auth |
| `/api/workers/[id]` | PATCH | Update role or `is_active` — admin only, uses service client |
| `/api/me` | GET | Current user's profile (id, role, full_name); dev-stub-when-no-session branch is now dead code (see Auth section) |
| `/api/bookings/approve` | POST | Admin/manager approves or rejects a pending booking — triggers email to worker + SMS to customer. On approve, reverts status back to `pending` if the SMS send fails (see 2026-07-28 changelog) |
| `/api/sms-templates` | GET, PATCH | GET: active template (auth required); PATCH: update body (admin only) |

---

## What's not built yet / next steps

| Feature | Priority |
|---|---|
| **Run migration `010_bookings_delete_and_sms_log_fk.sql` on the live DB** (and `009` if a fresh DB is ever set up) | **Next session** |
| Storage bucket RLS policies | **Before production** |
| Confirm the new booking/approve/shift flows in the browser as admin, manager and worker (this pass was verified by typecheck, lint, build and curl only — no authenticated browser session was available) | **Next session** |
| Auto-SMS when car is ready | High |
| Calendar loads every booking ever (no date window) — fine at today's volume, bound it to a rolling window when the table grows | Medium |
| Drag-and-drop in calendar | Low |
| Customer list (`/customers`) | Low |
| Activity log UI (table exists, nothing writes to it yet) | Low |
| GHL_WEBHOOK_PUBLIC_KEY configured | Before webhooks go live |
| ~~Auth enabled~~ · ~~dead dev bypasses~~ · ~~dashboard real data~~ · ~~my-shifts DEV_USER~~ · ~~staff page~~ · ~~auto-SMS on create~~ | Done |

---

## Getting started locally

```bash
npm install
# Create .env.local with Supabase keys (see .env.local.example)
# Run schema.sql + migrations 001–003 in Supabase SQL editor
# Create storage buckets: car-before-images, car-after-images (public)
npm run dev
# → http://localhost:3000
```

**Build:** `npm run build` — passes, 0 errors  
**Lint:** `npm run lint` — passes, 0 errors, 0 warnings

**Local gotchas (2026-09-16):**
- Port 3000 on this machine is usually a *different* project (`crm-khyte`, "Khyte CRM"). Start this app with `npx next dev -p 3005` (or any free port) before curl-testing, or every route will 307 to that other app's login.
- If `next build` fails with `Declaration or statement expected` inside `.next/dev/types/routes.d.ts` / `validator.ts`, those generated files are corrupted (an interrupted write duplicated their tails). Delete them — the dev server regenerates them on start — then build again.
- `npx supabase db query --linked` returns 403 for this account ("does not have the necessary privileges"), so RLS policies can't be inspected from the CLI here; use the Supabase dashboard SQL editor.

---

## Design system (`src/app/globals.css`)

Plain CSS component classes on top of the Tailwind tokens, so any element can opt in with one class and every button/field/card in the app looks the same. Prefer these over hand-rolled Tailwind strings.

| Class | Use |
|---|---|
| `.btn` + `.btn-primary` / `.btn-secondary` / `.btn-ghost` / `.btn-danger` / `.btn-success` | Buttons and button-styled links. Primary is the gold gradient with inner highlight and gold glow on hover. Sizes: `.btn-xs` `.btn-sm` (default) `.btn-lg`; `.btn-icon` for square icon buttons; `.btn-block` full width. |
| `.field` (+ `.field-sm`) | Inputs, selects (custom chevron, dark options) and textareas. Gold focus ring. `.field-icon` wraps an svg + field for a leading icon. |
| `.card` (+ `.card-tinted` with `--tint`) | Surface with border + faint top highlight. Tinted variant fades a status color in from the top (pending banners, approve box, kanban columns). |
| `.badge` + `.badge-status` (`--badge-color`) / `.badge-outline` / `.badge-solid`, `.badge-sm` | Pills. `<StatusBadge>` renders `.badge-status` from `lib/status.ts` so labels/colors never drift. |
| `.segmented` (`<button data-active>`) | Filter tabs (job reviews, customer tabs). |
| `.menu` / `.menu-item` | Dropdowns and popovers (role dropdown, account switcher) — shadow calibrated for the near-black palette. |
| `.avatar` (`-sm` / `-lg`) | Initial-letter avatars. |
| `.empty` / `.empty-title` / `.empty-text` | Empty states with an icon. |
| `.nav-item` (`data-active`, `data-collapsed`) | Sidebar links. |
| `.page-title` / `.page-subtitle` | Used by `<PageHeader>`. |
| `.plate` | Registration numbers (mono, tracked, uppercase). |
| `.brand-mark` (`-lg`), `.auth-backdrop`, `.main-surface` | Gold "K" mark, login-screen atmosphere, faint gold wash behind the workspace. |

Tokens: `--border-strong` (inputs, menus), `--primary-hover`, `--shadow-card` / `--shadow-pop` / `--shadow-modal`. Status colors were raised in saturation on 2026-09-16 (`--status-confirmed: #5EAAF5`, `--status-completed: #4ED18C`, `--status-cancelled: #F26B6B`, `--status-pending: #F2B248`, `--status-in-progress: #B28EF7`). `--radius` is `0.5rem`. Reduced-motion is respected globally.

---

## Changelog

### 2026-09-16 (Merged with the mobile adaptation from `origin/master`; modal blur fix)
- **Rebased onto `e9557c7 feat: mobilanpassa kalendersystemet`** (erikryden12, 2026-08-31), which landed while this pass was in progress. Every file it touched had been rewritten here, so the rebase took the rewritten versions and its behaviour was **re-implemented on top**, file by file:
  - Viewport meta (`width=device-width, initialScale 1`, theme color) in `app/layout.tsx`; `allowedDevOrigins` in `next.config.ts` for testing from a phone on the same wifi.
  - Base font 18px → 15px under 768px; **never** `overflow-x: hidden` on html/body (breaks horizontal scroll on iOS/Android). Main padding `p-2 md:p-6`; the calendar bleeds with `-m-2 md:-m-6`.
  - Sidebar becomes a slide-in drawer under 768px (hamburger fixed in the top-left corner, backdrop, Escape, body scroll lock, closes on navigation). The desktop icon rail (`collapsed`) is unchanged and never applies to the drawer (`compact = collapsed && !isNarrow`). Top bar leaves `pl-14` for the hamburger on phones.
  - Week view on phones: 48px hour column, `minmax(88px, 1fr)` day columns → the week scrolls sideways (Sat/Sun no longer clipped), day headers scroll in sync (`headerScrollRef`), hour column and `V{week}` cell are `sticky left-0`, auto-scroll to today's column, overlay `‹ ›` arrows that page two days when there is more to scroll, hover slot hidden. Day view: 48px hour column, hover hidden.
  - Tap vs. swipe: `onPointerDown` records the start; a click that moved more than `TAP_TOLERANCE_PX` (10px) is ignored, so scrolling never opens the booking modal.
  - Month view on phones: one-letter weekday headers and colored dots (max 6, then `+N`) instead of chips; tapping the day opens the day view.
  - Modal `p-2 sm:p-4`, `max-h-[92dvh]`; side panel `w-[85%] max-w-sm` on phones; "Ny bokning" is icon-only under `sm`.
  - `useIsNarrow()` (`lib/hooks/use-media-query.ts`) replaces the original `matchMedia` + `setState`-in-effect with `useSyncExternalStore`.
- **Modal / lightbox blur covered only the content area.** The page-enter keyframe ended on `transform: translateY(0)` with `fill-mode: both`, which made the content wrapper the containing block for every `position: fixed` descendant, so the backdrop stopped at the sidebar and top bar. `Modal` and `Lightbox` now render through a portal on `<body>` (z-100) and the keyframe ends on `transform: none`.

### 2026-09-16 (Calendar toolbar layout + iPhone SMS preview)
- **Calendar toolbar rearranged per user request:** the top bar is now only `‹ ›` + title (with a muted hint: week number and date range in week view, full date in day view) on the left and **"Ny bokning" pinned top right**. The view switcher (Dag/Vecka/Månad) and the "Ansvarig" dropdown moved to the **bottom bar**, left side. The separate status dropdown is gone — the status legend chips on the right of the bottom bar are the status filter (they already were), with a new **"Alla"** chip to reset. Chip counts are computed within the current worker filter so they always add up to "Alla".
- **SMS-mallar shows the message on an iPhone.** New `components/ui/iphone.tsx` (adapted from Magic UI's `<Iphone />`: accepts `children` inside the screen, dark titanium frame instead of `dark:` variants) and `components/sms/sms-phone-preview.tsx` — an **iOS Messages light-mode** screen (white screen so it reads against the black UI): status bar beside the Dynamic Island, contact header with the real sender id, and **exactly one received message** (the template being edited) under an "SMS · Idag HH:MM" divider. The phone sits in a card with a gold glow behind it and is **cropped with a fade at the bottom** so there is no empty screen below the message. `GET /api/sms-templates` also returns `sender` (`FORTYSIX_ELKS_FROM`, default `KOMFORT`). The card is sticky on wide screens.
- **Everything on the screen is real time.** The status-bar clock and the "Idag HH:MM" divider show the current Stockholm time (`lib/hooks/use-live-minute.ts`, `useSyncExternalStore`, re-renders once a minute, blank until hydrated). The sample booking is *tomorrow at 10:00*, and `{date}` / `{time}` are formatted by the **same functions the real send uses** — extracted from `46elks.ts` into the client-safe `lib/sms/format.ts` (`formatSmsDate`, `formatSmsTime`, `interpolateTemplate`) so the preview cannot drift from what the customer receives.
- Two earlier versions were rejected: (1) dark screen + Apple system font stack — on Windows that stack fell back to a font rendered in small caps, and one bubble on a black screen in a black card was mostly void; (2) a mock thread with a previous message and a green reply — user wants one SMS only. The phone uses the app font (`font-sans`). The card's "Så ser det ut för kunden" header row was also removed on request — the card starts directly with the phone; only the sample-values caption remains below it.
- Verification: `tsc`, `eslint`, `next build` clean; not viewed in a browser by the assistant.

### 2026-09-16 (Performance pass + calendar polish + /workers dropdown clipping)
**Bug fix**
- **`/workers` role dropdown was clipped** by the list card's `overflow-hidden` for the bottom rows. The menu is now rendered in a portal on `<body>`, positioned from the button's screen rect, and flips upward when there is no room below. Closes on scroll, resize, Escape and outside click.

**Performance (why the app felt slow)**
- **One auth round trip per page instead of three.** `getSession()` is wrapped in React's `cache()`, so the dashboard layout and the page share a single `auth.getUser()` + `profiles` query per request. The proxy no longer repeats the network auth check for `/api/*` — every route handler already does it via `requireApiUser()` (and refreshes tokens there). The proxy only fast-fails API requests that carry no `sb-*-auth-token` cookie at all (no network), and still fully verifies page requests. Net: pages 3→2 auth calls, API calls 2→1.
- **Global transitions removed.** `* { transition-property: … }` made every element (including the ~400 grid-line `<div>`s in the week view) a transition target. Transitions are now scoped to interactive elements and the design-system classes.
- **Calendar grid is CSS, not DOM.** Hour/half-hour lines and the new off-hours shading are `repeating-linear-gradient`s on each column (`.cal-column`, driven by `--hour-px` / `--work-start` / `--work-end` set from `calendar-utils.ts` constants). The week view dropped ~340 elements; the day view ~48.
- **Hover no longer re-renders the world.** Lane layouts are memoized per day (`useMemo`), hover state bails out when the slot hasn't changed, and booking blocks use a `box-shadow` hover instead of `filter: brightness` (which forced GPU layers). Month view groups bookings by day once instead of filtering the whole list per cell (42×).
- **Calendar payload trimmed**: the page now selects only the columns it renders (customer name/phone, car make/model/plate/color, worker name, job status) instead of `*` on four joined tables.
- **`loading.tsx`** for the dashboard route group: navigation shows a shimmer skeleton immediately instead of a frozen screen while the server works.
- Removed `backdrop-blur` from the top bar; job photo grids are `loading="lazy" decoding="async"`; page-enter animation shortened to 160ms.
- **Note for judging speed:** `npm run dev` compiles routes on demand and is always slower than production. Judge with `npm run build && npm start`.

**Calendar polish (day/week/month)**
- Off-hours (before 07:00, after 19:00 — `WORK_START_HOUR` / `WORK_END_HOUR`) are shaded so the working day stands out; weekends get a faint tint; today's column keeps a gold wash (visible in working hours).
- Booking blocks are now opaque (status color mixed with the card surface) with a bright title (`--foreground`), the time in the status color and muted meta lines — readable on any status color, and overlapping lanes/shading no longer bleed through. Hover lifts with a shadow.
- "Now" line has a glowing dot and a gold time chip (`14:32`) in the hour column, updated every minute.
- Week header shows a per-day booking count; day header shows count + total hours; weekend headers are muted.
- Month view: per-day count, chips with time in status color and name in foreground, today's cell tinted, weekends tinted, `+N till` overflow.
- Keyboard: `←` / `→` move a day/week/month, `T` jumps to today (ignored while typing or when a dialog is open). Nav buttons carry the shortcut in their tooltip.
- Slot clicks are clamped to the day (no 24:00 slot).

**Verification:** `tsc --noEmit` clean, `eslint src` clean, `next build` passes. Curl against the running dev server: pages 307 → `/login`, `/api/*` 401 JSON without a cookie (proxy) and with a bogus cookie (route handler), webhook 400 on invalid JSON (auth-exempt). Not verified in a signed-in browser — no credentials in the session.

### 2026-09-16 (Robustness + UI pass — shared auth, API hardening, real dashboard, design system)
**Logic / infrastructure**
- **New `src/lib/auth/session.ts`** (`getSession`, `requireApiUser`, `REVIEWER_ROLES`, `isReviewer`) replaces the copy-pasted `auth.getUser()` + `profiles` lookup in 15 route handlers and 5 server pages. It also enforces `is_active` (deactivated staff were never actually blocked before) and rejects auth users with no profile row. **All six `NODE_ENV === 'development'` bypass branches are removed.**
- **New `src/lib/api.ts`**: `readJsonObject` (bad JSON → 400 instead of a 500), `pickAllowed` (allow-listed patches), small validators.
- **`/my-shifts` was broken in production**: it still used a hardcoded `DEV_USER` UUID, so it listed nothing and creating a shift failed RLS for every real user. Now a server page resolves the session and renders `components/shifts/my-shifts-view.tsx`; the modal no longer sends a `workerId` — the server uses the session.
- **`POST /api/shifts/approve` trusted `reviewerId` from the request body.** The reviewer is now always the signed-in user; only `pending` shifts can be approved/rejected (409 otherwise) and the update is guarded with `.eq('status','pending')` against double-clicks.
- **`PATCH /api/bookings/[id]` and `PATCH /api/customers/[id]` spread the raw body into the update** — any column was writable. Both are allow-listed and validated; booking PATCH/DELETE are admin-only on the server (matching RLS and the UI).
- **`DELETE /api/bookings/[id]` reported success when nothing was deleted.** There is no delete policy on `bookings` in any migration, so a session-scoped delete affected 0 rows and the UI still said "Bokningen togs bort". It now verifies the row exists, detaches `sms_logs` (which reference bookings with no cascade and made deletes fail once an SMS had been sent), deletes with the service client after the admin check, and returns 404/409 if nothing was removed. Migration `010` adds the policy + `on delete set null` for the long term.
- **Jobs:** `POST /api/jobs` returns the existing job (200) instead of a 500 on the `unique(booking_id)` constraint; workers become the job's worker themselves (and an unassigned booking is assigned to them on first photo); a worker cannot start a job on a booking assigned to someone else. `PATCH /api/jobs/[id]` no longer lets a worker set `status=completed` or `admin_notes` (that bypassed review). Image upload validates `image/*`, ≤15 MB, ownership, and removes the storage object if the DB insert fails.
- **Bookings create:** phone numbers are normalised to E.164 before the customer lookup, so "070-123 45 67" and "+46701234567" are one customer; a car is reused when the customer already has one with the same plate (every booking used to insert a new car row). Status/duration/date/price are validated. The SMS flow is extracted to **`src/lib/sms/confirmation.ts`** and shared with approve (the create copy previously lacked the duplicate/stale-pending handling).
- **Approve:** rejects non-pending bookings (409); the "approved" email to the worker is now sent only after the SMS outcome is known, so a booking that reverted to pending no longer emails "Din bokning har godkänts".
- **Workers:** `PATCH /api/workers/[id]` refuses to edit your own account and refuses to demote/deactivate the last active administrator; `POST` validates the email and rejects duplicates with 409. `/workers` locks your own row.
- **Manual SMS** (`/api/sms/send`) no longer flips `bookings.sms_confirmation_sent` — a manual message isn't the confirmation.
- **Email (`resend.ts`)**: try/catch + 10s timeout (a network error used to be an unhandled rejection from a fire-and-forget call) and HTML-escaping of customer names/plates/reasons. Dates rendered in Europe/Stockholm.
- **Service client** is now typed with `Database` and reads `SUPABASE_SECRET_KEY` (falls back to `SUPABASE_SERVICE_ROLE_KEY`) with a clear error if neither is set.
- **Dashboard shows real data**: today's bookings (Europe/Stockholm day bounds via `lib/time.ts`), pending count, active jobs, completed today, recently added bookings with "inlagd av". Previously hardcoded zeros and an empty list.
- **Migrations `009` and `010` added** — see the Database section; **`010` still needs to be run on the live DB.**
- Lint: the two pre-existing `react-hooks/set-state-in-effect` errors in `sidebar.tsx` are fixed properly (`useSyncExternalStore` for the collapsed flag and the known-accounts list).

**UI / UX**
- **Design system in `globals.css`** (see the section above): `.btn*`, `.field`, `.card`, `.badge`, `.segmented`, `.menu`, `.avatar`, `.empty`, `.nav-item`. Every button, input, select, textarea, card and badge in the app was swept onto these. The gold primary button has a real gradient, inner highlight and glow; secondary buttons are raised; selects get a custom chevron; inputs get an inset shadow and a gold focus ring.
- **Stronger colors**: status tokens raised in saturation, borders lifted (`#33302C` / `--border-strong #433F39`), foreground brightened, `--radius` 6→8px. Scrollbar recolored from the old bluish grey to warm neutrals. Text selection is gold.
- **Shared status module** (`lib/status.ts` + `<StatusBadge>`): labels were inconsistent across files ("Väntande" vs "Väntar", "Pågående" vs "Pågår"); one source now.
- **Sidebar**: gold "K" brand mark + "KOM-fort / Bilvård" wordmark in the previously empty header (the sidebar and browser title said "RenGör", a stale name); nav split into main + "Administration"; 16px icons; the non-functional notification bell is removed; account popup uses `.menu`.
- **Top bar** titles cover every route (Mina pass, Granskning, SMS-mallar, Kund, Bokning were showing "Portal").
- **Login**: brand mark, card, gold primary button, subtle gold radial glow + grain backdrop.
- **Dashboard**: greeting header with a "Ny bokning" shortcut (`/calendar?new=1` opens the create modal directly), 4 clickable stat cards, "Dagens schema" list + "Senast inlagda" side by side on wide screens.
- **Calendar**: toolbar on `.btn`/`.field`; booking blocks have a hairline border + rounded corners; today's date circle glows; legend chips are proper buttons with an active state.
- **Create-booking modal**: proper labels for every field (was placeholder-only), 2-column layout, footer note explains whether an SMS will go out for the chosen status, clearer success/failure toasts.
- **Booking detail page**: title is the customer, subtitle car + plate + service, `<StatusBadge>` on the right; status is chosen with badge pills; non-admins see read-only rows instead of greyed-out inputs; "Osparade ändringar" + Save disabled until dirty; the Save/Delete bar floats at the bottom while scrolling; approval box is a tinted card.
- **Customer page**: header actions (call / email), 4 stat cards, cars + notes side by side, segmented tabs, SMS rows show sent/failed/unknown badges and error text; notes are editable only for admin/manager (the API rejects workers anyway).
- **Workers page**: role badges with glowing dots, `.menu` dropdown, add-employee form as a card, active/inactive summary in the subtitle.
- **Job reviews**: segmented filter in the header, `<StatusBadge kind="job">`, "Öppna bokning" link on each pending card, dedicated empty state.
- **SMS template page**: live preview of the rendered message as an SMS bubble with sample values, "Ångra" button, warning for unused variables, save disabled until dirty.
- **My shifts**: subtitle with total pass / approved hours / pending count, shifts sorted newest first, linked bookings are links, status via `<StatusBadge kind="shift">`.
- **Jobs board**: tinted columns per status from `JOB_STATUS`, plates in `.plate`.
- **Banners**: tinted cards, green/red icon buttons, booking rows link to the booking and show who submitted it.
- Metadata title is now "KOM-fort Bilvård — Portal" with a `%s · KOM-fort Bilvård` template.

**Verification:** `tsc --noEmit` clean, `eslint src` clean (0 errors), `next build` passes after deleting the corrupted generated `.next/dev/types` files (see "Local gotchas"). Curl smoke tests against a fresh dev server on port 3005: `/login` 200, protected pages 307 → `/login`, all `/api/*` 401 JSON, spoofed-reviewer `POST /api/shifts/approve` 401, unauthenticated DELETE 401, `/api/webhooks/ghl` bypasses the session gate and reaches the handler (400 on invalid JSON, no DB write). **Not verified:** any authenticated browser flow — no credentials were available in this session.
**Removed:** `components/shifts/pending-shifts-panel.tsx` (unused), the `DEV_USER` stub, all `isDev` branches.

### 2026-07-28 (Staff page role-dropdown overlap fix)
- **`/workers`'s role dropdown looked like it was rendering duplicate/overlapping content.** `RoleDropdown` (`(dashboard)/workers/page.tsx`) opened its menu with `bg-card border border-border` and a plain `shadow-lg` — but `bg-card` (`#191817`) sits almost on top of the surrounding row/table background in this near-black palette, and Tailwind's default `shadow-lg` is calibrated for light UIs, so it barely registers here. The open menu had no real visual boundary from the row content behind/below it, so it read as a badge bleeding through another badge rather than a floating menu.
- **Fix:** switched the menu to `bg-popover` with a more visible `border-border/80`, raised its stacking (`z-50`, backdrop `z-40`, up from `z-20`/`z-10` — matches the sidebar account popup's z-index so it always wins against sibling row content), and added an explicit multi-layer `box-shadow` strong enough to read on a near-black surface (Tailwind's default shadow utilities were the underlying reason this pattern is easy to get wrong elsewhere too — worth keeping in mind for future dropdowns/popovers on this palette).
- **Verification:** `tsc --noEmit` clean (two unrelated pre-existing errors in generated `.next/dev/types/*` files, confirmed present on `master` before this change too — a stale dev-server type-generation artifact, not a regression). `eslint` clean on the touched file.

### 2026-07-28 (Dashboard main content scroll fix)
- **`/bookings/[id]` was unreachable below the fold — content was clipped, not scrollable.** `(dashboard)/layout.tsx`'s `<main>` used `overflow-hidden` so the calendar and my-shifts pages (which manage their own internal `overflow-y-auto` scroll regions sized to fit exactly within `flex-1 min-h-0`) never overflow it — but plain content pages like the booking detail form, which just grow taller than the viewport, had no way to scroll to their lower sections (notes, save/delete buttons).
- **Fix:** changed `<main>`'s `overflow-hidden` to `overflow-y-auto` in `src/app/(dashboard)/layout.tsx`. Calendar/my-shifts are unaffected since their content already fits exactly within the available height and manages its own inner scroll; pages that overflow now scroll at the `<main>` level instead of being clipped.

### 2026-07-28 (SMS-failure booking revert, account-switcher login fix, login screen polish — booking flow QA'd end-to-end)
- **Root problem this session started from:** a bad `FORTYSIX_ELKS_FROM` value (fixed 2026-07-23) had exposed a deeper bug — when the confirmation SMS failed to send for any reason, the booking still ended up `confirmed` anyway. The status flip to `confirmed` in both `approve/route.ts` and `create/route.ts` happened *before* the SMS attempt, unconditionally, so a failed send was invisible in the booking's actual state (only a toast, gone as soon as it was dismissed).
- **Fix — SMS failure now reverts the booking to `pending` instead of leaving it falsely confirmed:** `POST /api/bookings/approve` and `POST /api/bookings/create` both check `smsSent` after the send attempt; if it's `false` (any cause — no active template, missing customer phone, `sms_log` insert failure, duplicate-send guard, or the 46elks call itself failing), the booking is updated back to `status: 'pending'` and the API response's `status` field reflects the reverted value. Reused the existing `pending` status rather than adding a new one — it's already deletable by admin regardless of status, and already surfaces in the pending-bookings banner, so a failed booking is now visibly "waiting" instead of silently wrong.
- **Toasts corrected to match:** `create-booking-modal.tsx`, `pending-bookings-banner.tsx`, and `bookings/[id]/page.tsx` previously always showed "Bokningen godkändes" (approved) on any non-error HTTP response, even when the booking had just been reverted to pending. All three now check the returned `status` and, when reverted, show "SMS kunde inte skickas — bokningen väntar fortfarande på godkännande" instead of falsely claiming success.
- **Account switcher was dead on arrival — found and fixed:** `updateSession` (`src/lib/supabase/middleware.ts`) unconditionally redirected any signed-in user away from `/login` back to `/dashboard`, so the sidebar account switcher's `/login?email=...` link (added 2026-07-26) never actually rendered — it just bounced straight back. Fixed with a narrow carve-out: `/login` is allowed to render for a signed-in session only when the request has `?email=` (i.e. arrived via the switcher); a direct visit to `/login` while already authenticated still redirects to `/dashboard` as before.
- **Login screen duplicate-text bug fixed:** `(auth)/login/page.tsx` rendered a static "Logga in på arbetsportalen" subtitle as a sibling of `LoginForm`, which *also* rendered its own near-identical "Loggar in på arbetsportalen…" line during the post-submit transition — two stacked, almost-identical Swedish sentences that read as a bug. Moved the title into `LoginForm` itself (which already owns the idle/entering state switch), so there's exactly one header at a time. The loading-transition spinner was also upgraded from a flat single-ring `animate-spin` to a two-layer ring (static faint track + gold arc with a tapered trailing edge), with more generous spacing (`py-20`/`gap-6`) so the transition reads as designed rather than default.
- **QA'd live end-to-end on the deployed site, two real config bugs found and fixed along the way (not code bugs):** first, `FORTYSIX_ELKS_FROM` on Vercel still had an invalid character (same class of issue as the 2026-07-23 local fix, hadn't been mirrored to the Vercel env yet) — corrected. Second, after that fix, sends failed with `46elks 401: API access requires Basic HTTP authentication` — traced to `FORTYSIX_ELKS_API_PASSWORD` never having been set on Vercel at all (only `FORTYSIX_ELKS_API_USERNAME` was), so the Basic Auth header was malformed. Both are 46elks dashboard values (API username/password issued as a matched pair), now set correctly on Vercel. **Confirmed by the user: the full booking → approve → SMS confirmation flow now works end-to-end in production.**
- **Verification:** `tsc --noEmit` and `eslint` clean on every touched file each pass. The SMS-revert fix was verified against a real production failure (the 401 above) — confirmed the booking correctly landed back in "Väntar" instead of "Bekräftad" — not just reasoned about from code.

### 2026-07-26 (Account switcher + booking creator visibility)
- **Account switcher added to sidebar's account popup** (`sidebar.tsx`): below the avatar/name/role button, the "Logga ut" popup now also lists previously logged-in accounts (remembered locally, not a real multi-session token cache). New `src/lib/utils/known-accounts.ts` reads/writes a capped list (6 max) of `{email, fullName, role}` to `localStorage`. `login-form.tsx` calls `rememberAccount(...)` after a successful sign-in (fetches the profile row for name/role); `sidebar.tsx` also calls it on mount so switching in from a fresh session still records the account.
- **Switching mechanism is re-auth, not true multi-session:** clicking another account in the list signs out of the current Supabase session and redirects to `/login?email=<that account>` with the email pre-filled — the user still has to enter that account's password. Chosen over keeping multiple live session tokens in `localStorage` (rejected as a bigger security surface for little gain, given this app's single-session cookie-based Supabase auth). The current account is marked with a dot and is not clickable; non-current accounts have a hover "✕" to forget them (`forgetAccount`).
- **`/login` needed a `Suspense` boundary** (`(auth)/login/page.tsx`) — `login-form.tsx` now calls `useSearchParams()` to read `?email=`, which the Next.js App Router requires to be wrapped in `<Suspense>` or the page fails to prerender.
- **Booking "logged in by" now visible** — `bookings.created_by` (added back in migration `007_booking_worker_submit.sql`) was tracked in the DB but never joined or displayed anywhere. Added `creator?: Profile` to the `Booking` type; `/api/bookings`, `/api/bookings/[id]` now select `creator:profiles!bookings_created_by_fkey(*)` alongside the existing `assigned_worker` join. Both routes previously selected `assigned_worker:profiles(*)` with an unqualified join — harmless while only one `profiles` FK was selected, but adding a second (`creator`) makes the join ambiguous without an explicit FK name, so `assigned_worker` was also switched to the explicit `profiles!bookings_assigned_worker_id_fkey(*)` form. FK names are Postgres's default unnamed-constraint convention (`<table>_<column>_fkey`) — `bookings_created_by_fkey` was already proven correct (used by `approve/route.ts` beforehand); `bookings_assigned_worker_id_fkey` follows the same convention but wasn't independently verified against the live DB schema.
- **Displayed in both booking views:** `booking-detail-panel.tsx` (calendar slide-in) and `bookings/[id]/page.tsx` (full detail page) each gained an "Inloggad av {name}" row, shown only when `booking.creator` is present (i.e. always for worker-submitted bookings; absent for older/admin-direct bookings created before `created_by` existed or where it's null). Not added to `bookings-table.tsx` — that list view uses a fixed 6-column grid; adding a 7th column was judged out of scope for this pass.
- **Correction to prior assumption:** earlier in this session the assistant assumed the Supabase project was paused for cost savings (per stale memory) — user corrected this: the project is active, just was "weirdly linked" locally. Memory updated.
- **Verification:** `tsc --noEmit` and `eslint` clean on all touched files. Not verified against the live DB (would confirm the `bookings_assigned_worker_id_fkey` constraint name resolves) — worth a smoke test of `GET /api/bookings/[id]` next session.

### 2026-07-21 (Global toast notifications via Sonner)
- **Goal:** booking-creation errors were only shown as an inline red box that could be easy to miss; user asked for "loud" errors, then to extend that to a single global notification system for all success/error feedback (approvals, saves, uploads, etc.) app-wide.
- **`sonner` installed** (no `next-themes` — this app has no active theme toggle, `.dark` class is unused dead CSS scaffolding, so the default light-styled toast is correct). `<Toaster richColors closeButton duration={8000} />` mounted once in `src/components/layout/providers.tsx`. Position started `top-right`, moved to **`bottom-right`** per user request same session.
- **12 client components converted** from ad-hoc inline error banners (and, in several places, fully silent failures) to `toast.success(...)` / `toast.error(...)`: `create-booking-modal.tsx`, `create-shift-modal.tsx`, `pending-shifts-banner.tsx`, `pending-bookings-banner.tsx`, `job-photos.tsx`, `login-form.tsx`, `admin/sms-templates/page.tsx`, `bookings/[id]/page.tsx`, `workers/page.tsx` (incl. `WorkerRow` role/active toggle and `AddWorkerForm`), `admin/job-reviews/page.tsx`, `customers/[id]/page.tsx`, `jobs/page.tsx`.
- **Error toasts always carry the real server message** in the `description` field (Supabase's actual `error.message`, or the API's JSON `{error}` body, falling back to `${status} ${statusText}` — never a bare generic string), so failures are diagnosable from the toast alone.
- **Silent-failure bugs fixed as a side effect of this pass:** `bookings/[id]/page.tsx`'s `handleDelete` previously didn't check `res.ok` at all — a failed delete would still navigate back to `/calendar` with no error shown, leaving the booking undeleted with no explanation. `workers/page.tsx`'s `handleRoleChange`/`handleToggleActive` and `admin/job-reviews/page.tsx`'s `fetchJobs` / `jobs/page.tsx`'s `fetchJobs` previously had no `else` branch on fetch failure — errors (and successes) were both invisible. All now report through toast.
- **Kept, not replaced:** inline field-level validation (login form's wrong-password message, create-shift-modal's "end time must be after start time", add-worker's "name and email required") — these stay next to the input since that's the more useful location; a toast was layered on top for the server-error cases only. Page-level `error` state that drives a persistent empty/not-found view (e.g. `bookings/[id]` "booking not found", `workers/page.tsx`'s list-load failure) was also left as page state, not converted to a toast, since it's not a transient event.
- **Verification:** `tsc --noEmit`, `eslint` (all 14 touched files), and `next build` all clean.

### 2026-07-15 (Overnight-spanning bookings + hover-slot time centering)
- **Problem:** a booking starting late (e.g. 23:00) with a multi-hour duration only rendered in the day it started — the block just extended past the bottom of that day's column instead of appearing at the top of the next day, since `getBookingsForDay` filtered bookings by same-day `scheduled_at` and `computeBookingLayouts` sized the block purely from `duration_minutes` with no day-boundary awareness.
- **Fix:** `calendar-utils.ts` gained `getBookingSegmentForDay`/`getDaySegments`, which clip a booking to the `[00:00, 24:00)` window of a given day and return `continuesFromPrev`/`continuesToNext` flags. `computeBookingLayouts` now takes these segments instead of raw bookings. `week-view.tsx` and `day-view.tsx` were updated to call `getDaySegments` and to style the cut edge of a spanning booking (dashed border, no rounding on that side, `↳` prefix on the continuation piece) so a long overnight session now visibly continues into the next day's column. `getBookingsForDay` (unchanged, same-day filter) stays in use by `month-view.tsx`, which only needs a same-day list, not segment geometry.
- **Hover-slot time label centered:** in both views, the 30-min hover/click highlight block previously pinned its time label (e.g. "23:15") to the top-left corner. Now centered both axes via an `absolute inset-0 flex items-center justify-center` wrapper.
- **Verification:** `tsc --noEmit` clean. Core segment-clipping logic verified with a standalone script importing the real `getDaySegments`/`computeBookingLayouts` exports against a synthetic 23:00 + 180min booking — confirmed correct `startMin`/`endMin`/`continuesFromPrev`/`continuesToNext` on both the start day and the spillover day. **Not done:** no authenticated browser screenshot of the actual calendar page — blocked on not having login credentials for the running dev server (redirects to `/login`); the CSS centering change and the day-boundary math were not visually confirmed in-browser, only via the script above and code review.

### 2026-07-15 (Colour system: tokenized status colors, black-and-gold theme rework)
- **Goal:** the sidebar's black-and-gold look was originally scoped to just the sidebar/top-bar (see 2026-07-12 entry below); the rest of the app (cards, badges, status colors) had drifted into a separate 5-color rainbow (blue/purple/green/red/amber) plus a neutral-gray main background that didn't match the sidebar's warm black. This pass unified everything under one token system in `globals.css`.
- **Step 1 — tokenized, no visual change yet:** every hardcoded hex color for booking/job/shift statuses and worker roles, scattered across ~15 files (`recent-bookings.tsx`, `bookings-table.tsx`, `dashboard-stats.tsx`, `customers/[id]/page.tsx`, `admin/job-reviews/page.tsx`, `workers/page.tsx`, `jobs-board.tsx`, `calendar-utils.ts`, `booking-detail-panel.tsx`, `bookings/[id]/page.tsx`, plus banners/panels/modals in `pending-bookings-banner.tsx`, `pending-shifts-banner.tsx`, `pending-shifts-panel.tsx`, `my-shifts/page.tsx`, `job-photos.tsx`, `create-booking-modal.tsx`, `create-shift-modal.tsx`, `sms-templates/page.tsx`) was replaced with references to new CSS custom properties: `--status-pending/confirmed/in-progress/completed/cancelled/not-started` and `--role-admin/manager/worker`, exposed via `@theme inline` as real Tailwind classes (`bg-status-pending`, `text-role-admin`, etc — they didn't exist as usable classes before, only as unwired `:root` vars). Calendar views (`week-view.tsx`, `day-view.tsx`, `month-view.tsx`) consume the same tokens via `var(--status-*)` + `color-mix()` in inline styles, since those colors are computed per-booking and can't be static Tailwind classes.
- **Step 2 — actual palette redesign, per user request ("apply the navbar's colors globally, I want the black and I want the nice gold"):** `:root` in `globals.css` reworked so background/card/popover/secondary/muted/accent/input all share the sidebar's warm-black family instead of the previous neutral gray-black (`#131316`) vs. warm-black sidebar (`#17140F`) mismatch. Settled on `#131211` (background) / `#191817` (card, popover) / `#201F1D` (secondary, muted, accent, input) — deliberately restrained, barely-warm near-black (after user feedback the first pass, `#17140F`-based, was "too gold-tinted") so gold stays the only color doing visual work. `--primary` (`#F5C842`) unchanged as the single accent.
- **Step 3 — status color ramp, iterated twice on user feedback:** first attempt collapsed all 5 statuses into a gold-only tonal ramp (gray → amber → gold → pale gold) for "restraint" — user rejected this as illegible ("not even distinguishable... put the colors we had originally like green, red, blue but make them nicer to the eyes"). Reverted to the familiar amber/blue/purple/green/red family, desaturated and value-tuned for dark-mode eye comfort rather than the original saturated hues: `--status-pending: #D9A648` (amber), `--status-confirmed: #6FA3D6` (blue), `--status-in-progress: #A886E0` (purple), `--status-completed: #6FBE87` (green), `--status-cancelled: #DB6D6D` (red), `--status-not-started: #8F8A80` (neutral gray). `--role-admin` = gold (primary), `--role-manager` = `--status-confirmed`, `--role-worker` = `--status-not-started`.
- **Verification:** `tsc --noEmit` and `npm run build` clean after each step. No visual regression testing beyond the user's own screenshot feedback loop (no dev-server screenshot capture was done by the assistant — user tested live against their own running dev server on port 3001).
- **Not done / worth flagging:** the exact hex values above are a first pass at "nicer to the eyes" — not validated against WCAG contrast ratios for text-on-background use of the status colors (e.g. `text-status-confirmed` directly on `--background`). Worth a contrast audit before this is considered final.

### 2026-07-15 (Auth enabled, webhook fix, login polish)
- **`proxy.ts` activated.** It was a scaffolded no-op (`return NextResponse.next()`) with a comment saying "replace with `updateSession` when ready" — swapped in the real call to `updateSession` from `src/lib/supabase/middleware.ts`. Confirmed live: unauthenticated `/dashboard` now 307s to `/login`.
- **Removed all `DEV_PROFILE`/dev-bypass fallbacks that were scaffolded specifically for this moment** (comments in the code literally said "remove once auth is enabled in proxy.ts"): `layout.tsx`, `dashboard/page.tsx` no longer fall back to a fake admin profile — both now redirect to `/login` if there's no session or no matching `profiles` row. `calendar/page.tsx` no longer falls back to the service-role client in dev when unauthenticated.
- **Critical bug found via audit and fixed same session: activating the proxy silently broke the GHL webhook.** The existing matcher in `proxy.ts` already covered `/api/*` (pre-dated this session), but had no effect while `proxy()` was a no-op. Wiring in `updateSession` made it live — and `updateSession`'s public-route allowlist only covered `/`, `/login`, `/register`, so GHL's unauthenticated, signature-verified webhook POST to `/api/webhooks/ghl` started getting redirected to `/login` instead of reaching the handler (confirmed via curl: 307 before the fix). Fixed by exempting `/api/webhooks/*` from the auth gate in `updateSession` — its own Ed25519 signature check is the real gate for that route. Also changed the behavior for other unauthenticated `/api/*` calls from a 307 HTML redirect to a `401 {"error":"unauthenticated"}` JSON response, since a `fetch()` caller can't usefully follow a redirect to a login page.
- **Login flow changed from instant redirect to a brief transition.** `login-form.tsx` previously did `router.push('/dashboard')` immediately on successful sign-in. It now shows a short "Loggar in på arbetsportalen…" spinner (~700ms, reuses the existing `animate-fade-in`/`animate-spin` utilities) before navigating.
- **"RenGör" wordmark removed from the login page** (`(auth)/login/page.tsx`) — just the accent-bar + text block above the subtitle; the `<title>` tag (site-wide metadata, "RenGör — Biltvätt Portal") was left alone since changing it would affect the whole app's browser tab title, not just this page.
- **Verification done:** `tsc --noEmit` and `eslint` clean throughout. Live curl checks against the running dev server for: unauthenticated `/dashboard` (307 → `/login`), unauthenticated protected API (401 JSON), unauthenticated GHL webhook (200, reaches handler), `/login` renders. User separately confirmed the full browser walkthrough (login → dashboard → logout → re-login) works.
- **Not done, flagged for later:** the dead `NODE_ENV === 'development'` bypass branches left over in `api/me`, `api/bookings/create`, `api/bookings/approve`, `api/sms-templates`, `api/workers`, `api/workers/[id]` (see Auth section) — now unreachable for unauthenticated callers but not cleaned up. The possible `/login` ⇄ `/dashboard` redirect loop for an authenticated user with no profile row (see Auth section) — not reproduced, not hardened.

### 2026-07-12 (Booking creation testing, auth bootstrap, button styling)
- **Live SMS test blocked by prod auth gap, not SMS itself:** attempted to test the create-booking → 46elks SMS flow on the deployed site (`kalender-system.vercel.app`). Got 401 Unauthorized because `proxy.ts` is still a passthrough stub — it never calls `updateSession`, so no real session cookie is ever validated/refreshed at the edge, and `/api/bookings/create` correctly rejects the unauthenticated request in production (the `isDev` bypass only applies locally). This is the same known gap already tracked as "Auth enabled (proxy.ts is passthrough) — Before production"; testing was blocked because there was no way to actually log in yet (see next item).
- **Root cause found and fixed: `handle_new_user()` trigger was broken for every real caller.** Trying to create the first user (via Supabase dashboard "Add user", and independently via the GoTrue admin API) returned a 500 "Database error creating new user" every time. Root cause: the trigger's `insert into profiles (...)` uses an unqualified table name and relied on the calling session's `search_path`. Ad-hoc SQL sessions default to `search_path` including `public`, so the trigger looked fine when tested that way — but GoTrue's actual DB role, `supabase_auth_admin`, has `search_path=auth` only (confirmed via `pg_roles.rolconfig`), so `profiles` never resolved and every insert into `auth.users` failed with `relation "profiles" does not exist (SQLSTATE 42P01)` (confirmed via the project's Auth logs, queried through the Management API's `analytics/endpoints/logs.all`). This means **no account had ever been successfully created in this project** — not the dashboard, not the in-app `POST /api/workers` invite flow — until this was fixed. Fix applied live: `alter function handle_new_user() set search_path = public;`. Not yet captured as a tracked migration file (see Database section — should become `009_fix_handle_new_user_search_path.sql`).
- **First real account created:** `goran.ismailovic07@gmail.com`, role `admin`, created directly via the GoTrue admin API with `email_confirm: true` (bypasses the "no SMTP configured" issue below entirely — no confirmation email needed). This unblocks logging in on the deployed site and using the in-app "Lägg till anställd" flow on `/workers` for all future worker/manager accounts.
- **No SMTP configured:** `smtp_host`/`smtp_user`/`smtp_pass`/`smtp_admin_email` are all null in the Auth config (checked via Management API `config/auth`). Any flow that requires Supabase to send an email (dashboard "Add user" without `email_confirm: true`, `POST /api/workers`'s `inviteUserByEmail`) will hit Supabase's default mailer, which has strict rate limits — not yet an issue in practice, but worth setting up real SMTP (e.g. Resend, already used elsewhere in this app) before onboarding real employees, so invite emails reliably land.
- **Role/account bootstrapping documented:** confirmed there is no self-serve `/register` route (`src/app/(auth)/register/` exists but is empty — dead route). The only way to create the *first* admin account is directly via Supabase (dashboard or Admin API) since `POST /api/workers` itself requires an existing admin caller. All subsequent accounts should go through `/workers` → "Lägg till anställd" as normal.
- **"Skapa bokning" button restyled:** the create-booking-modal submit button now uses a `.btn-sheen` utility (new, in `globals.css`) — a translucent white→black sheen blended with SVG film-grain noise via `::after` (`mix-blend-mode: overlay`, 22% opacity), layered over the existing flat `bg-primary` (`#F5C842`) fill. Adapted from a reference button design (forest-green base + sheen/grain, no hover color change) — recreated with this app's own yellow instead of copying the reference palette. Scoped as an opt-in class, not applied to buttons globally.
- **Still open:** actual end-to-end SMS delivery (booking → 46elks → phone) has still not been confirmed — testing was interrupted by the auth/account bootstrap issues above, not by an SMS-specific failure. Next session should log in as the new admin account and retry the original test.

### 2026-07-12 (Calendar visual polish)
- **Full-bleed layout:** the calendar no longer sits in a rounded, bordered "card" floating inside the dashboard's padded content area. `calendar/page.tsx` bleeds out of the shell's `p-6` with `-m-6`, and `calendar-view.tsx`'s outer wrapper dropped `rounded border bg-card` for a flush `bg-background` panel that touches the top bar, sidebar, and viewport edges directly.
- **Status legend moved:** the Väntande/Bekräftad/Pågående/Klar/Avbokad legend now renders as a footer bar below the calendar grid (`border-t`) instead of above it.
- **Grid density (Google Calendar–style):** `HOUR_PX` went 72 → 96 → 60 across a few iterations (96 read as bloated, showed too few hours at once); settled at 60 for a dense, more-hours-visible-at-once feel. Hour/half-hour grid lines lightened (`border-border/40` and `/15`) and day-column dividers softened (`/60`) to match Google Calendar's quieter grid.
- **Time column widened:** `TIME_COL_PX` introduced (48 → 64 → 80px) so hour labels (`04:00` etc.) have breathing room; shared by both week and day views plus the current-time-line's left offset.
- **Day header redesign:** weekday name now sits above the date number (was inline) in a taller header row; date circle enlarged (`h-10 w-10`) with a bigger font. Font sizes were tuned via explicit `calc(0.65rem + Npx)` overrides layered on top of the shared `.label-caps` class (weekday +2px, date number +7px total, hour-axis labels +3px) so the three elements can scale independently of each other and of unrelated `.label-caps` usages elsewhere (status legend, month view).
- **`V{week}` relocated:** removed from the toolbar title (`Vecka 28 · Juli 2026` → just `Juli 2026`) and now renders in the grid's top-left spacer cell, above the hour-label column — mirrors Google Calendar's week-number placement.
- **Toolbar rework:** "Idag" button removed entirely (along with the now-unused `goToday` handler and `CalendarDays` import). Dag/Vecka/Månad is now a `<select>` dropdown positioned right after the title instead of a 3-button segmented control. "Ny bokning" moved to be the last (rightmost) element in the toolbar, after the status/worker filters.
- **Note:** the sidebar/top-bar changes below (collapsible rail, avatar/logout moved into sidebar, dark theme softening) were done in a separate terminal working the backend/auth side in parallel — unrelated to the calendar work above.

### 2026-07-12 (Sidebar/top bar rework + dark theme polish)
- **Collapsible sidebar:** `sidebar.tsx` now toggles between full width (`w-56`) and an icon-only rail (`w-16`) via a toggle button above the account section. State persisted in `localStorage` (`sidebar-collapsed`). Nav item labels, wordmark, and account text hide when collapsed; `title` attributes added for accessibility.
- **Sidebar wordmark/logo removed** — the "RenGör" text + accent bar block at the top of the sidebar is gone (temporary). The `h-14` header strip stays as an empty spacer so the sidebar still lines up with the top bar.
- **Top bar simplified:** avatar and sign-out button removed from `top-bar.tsx` (redundant with the sidebar's account section) — now just page title + date. No longer takes a `profile` prop.
- **Sign-out moved into the sidebar account section:** clicking the avatar/name block at the bottom of the sidebar opens a small popup with "Logga ut" (closes on outside click or Escape). Popup is anchored above-right of the account button when expanded, and flies out to the right of the rail when collapsed (avoids clipping against the narrow 64px rail); `z-50` added so it always paints above sibling content.
- **Notifications relocated:** the bell icon moved out of the top bar into its own row in the sidebar, directly above the account section.
- **Dark theme palette softened:** `globals.css` `:root` tokens reworked — background lightened from near-pure-black (`#0A0A0B`) to `#131316`, foreground dimmed slightly (`#F0EDE8` → `#E8E4DC`, contrast ~17:1 → ~14.6:1) to reduce eye strain/halation. Card/popover elevation fixed (previously darker than background, now correctly lighter). Secondary/muted/accent/input/border rebalanced to match.
- **Sidebar given a distinct warm gold-tinted dark tone** (`--sidebar: #17140F`, `--sidebar-accent: #241F17`, `--sidebar-border: #332C1F`) — same hue family as the `#F5C842` brand yellow but near-black in lightness, so the sidebar reads as its own zone instead of blending into the neutral-gray main content background. **Superseded 2026-07-15** — the rest of the app was later unified to match the sidebar's tone instead of staying visually separate; see the 2026-07-15 colour system changelog entry above.

### 2026-06-09
- **Job photo flow:** `JobPhotos` component on `/bookings/[id]` — workers upload before/after photos, status auto-updates (`not_started` → `in_progress` → `needs_review`). Lightbox for fullscreen image viewing with keyboard navigation.
- **Admin job review page** (`/admin/job-reviews`): before/after photos side by side, date grouping (Today/Yesterday/older), approve with optional comment. Only visible to admin/manager.
- **Pending shifts banner:** now only rendered for admin/manager roles. Error handling added for failed fetch and approve/reject actions.
- **Calendar refetch fix:** `window.location.reload()` replaced with `router.refresh()` — filter state and scroll position preserved after creating a booking.
- **Workers assignment dropdown fixed:** `/bookings/[id]` now fetches all active employees via `GET /api/workers` — Goran can assign any employee including himself. Label changed from "Tekniker" to "Ansvarig".
- **New API route:** `GET /api/workers` — returns all active profiles (worker + manager + admin), sorted by name.
- **Calendar worker filter:** now includes admins so bookings assigned to Goran appear correctly.
- **Hardcoded "Goran" strings removed** from `job-photos.tsx` and `create-shift-modal.tsx` — replaced with role-neutral text.
- **Lint fixes:** `useEffect` async calls wrapped with `void`, `<img>` elements in lightbox and job-reviews suppressed with eslint comments (external Supabase URLs, dimensions unknown).
- **Job review bug fixes:** `handleMarkDone` now checks `res.ok` before updating UI; local state updated from full API response (includes `admin_notes` and `completed_at`).
- **Staff management page** (`/workers`): rebuilt from scratch — `GET /api/workers?all=true`, inline role dropdown, activate/deactivate toggle, add employee form. Admin's own row is locked from editing.
- **Add employee via Supabase Auth invite** (`POST /api/workers`): uses `supabase.auth.admin.inviteUserByEmail` to create auth user first (avoids FK violation from inserting profiles with random UUID), then upserts the profile row with name/role/phone. Employee receives a signup email.
- **Booking edit restricted to admin only:** `canEdit = myRole === 'admin'` (managers are read-only). DB RLS updated via `005_bookings_admin_only.sql` to match. Stale "admin and manager" comments in booking page removed.
- **`PATCH /api/workers/[id]` always uses service client** after admin check — fixes dev mode where skipping auth check left the anon client in place (blocked by RLS).
- **Migration `004_admin_manage_profiles.sql`:** allows admins to update and insert any profile row.
- **Migration `005_bookings_admin_only.sql`:** restricts booking insert/update policies to `role = 'admin'` (previously also allowed managers).
- **Dead files removed:** `workers-table.tsx`, `use-auth.ts`, `use-supabase.ts` — none were imported anywhere.
- **Sidebar cleaned up:** "Bokningar" and "Inställningar" links removed — no functional pages behind them. Calendar covers booking visibility.
- **Job documentation always visible:** `JobPhotos` section now shown for all non-cancelled bookings regardless of whether a worker is assigned. `workerId` prop made optional.
- **Notes section disabled for non-admins:** Customer wishes and internal notes now have the same `pointerEvents/opacity` treatment as booking fields — no more editable-looking fields that can't be saved.
- **"Tekniker" renamed to "Ansvarig"** across bookings table, detail panel, and calendar filter — reflects that admins and managers can also be assigned.

### 2026-06-11
- **Worker booking submission flow:** workers can now create bookings — status is forced to `pending`, admin gets notified. Migration `007_booking_worker_submit.sql` adds `created_by` column and opens INSERT to all authenticated users (workers locked to `pending` status only).
- **Booking approval flow:** new `POST /api/bookings/approve` endpoint — admin/manager approves or rejects a pending booking. On approve: status → `confirmed`. On reject: status → `cancelled`. Email sent to the worker either way.
- **Email notifications via Resend** (`src/lib/email/resend.ts`): placeholder architecture in place. `sendBookingSubmitted` (to admin), `sendBookingApproved` (to worker), `sendBookingRejected` (to worker). Currently logs to console — activate by setting `RESEND_API_KEY` in `.env.local`.
- **Pending bookings banner** (`src/components/bookings/pending-bookings-banner.tsx`): shown on dashboard for admin/manager, same pattern as pending shifts banner. Blue color to distinguish from shifts (amber).
- **Approve/reject UI on booking detail page:** amber banner with thumbs up/down buttons visible when `booking.status === 'pending'` and viewer is admin/manager. Worker receives email on approval.
- **`POST /api/bookings/create` updated:** saves `created_by`, resolves caller role, forces `pending` for workers, skips SMS for pending bookings.
- **Job board cards are now clickable** — each card links to `/bookings/[id]` so workers can navigate directly from the kanban board to the booking.
- **Role delegation guide on staff page:** collapsible panel on `/workers` explains each role's permissions and intended use case for Goran — Administratör (superadmin, full control), Admin (approve/reject bookings, delegated authority), Personal (submit bookings pending approval, default for all new accounts).
- **Manager can approve/reject bookings:** confirmed that `manager` role has full access to approve/reject UI on dashboard (blue banner) and booking detail page (amber banner). API already enforced `admin | manager` check.
- **Default role for new accounts:** all new employees created via the staff page default to `worker` (displayed as "Personal"). DB trigger (`handle_new_user`) also defaults to `worker` unless overridden by invite metadata.

### 2026-06-11 (SMS + fixes)
- **46elks SMS integration:** `src/lib/sms/46elks.ts` (server-only wrapper) sends confirmation SMS to customer when a booking is approved. Basic auth, E.164 phone normalisation, 10s timeout. Falls back to `console.log` if credentials not set.
- **SMS template system:** `sms_templates` table (migration `008`) with a single active row enforced by partial unique index. Default template seeded: `Hej {name}, din bokning för {service} är bekräftad den {date} kl {time}. Välkommen!`
- **SMS templates admin page** (`/admin/sms-templates`): textarea with cursor-aware variable insertion chips (`{name}`, `{service}`, `{date}`, `{time}`), GSM-7/Unicode part counter, last-modified timestamp. Admin-only (not visible to managers).
- **Duplicate SMS guard:** `sms_logs` row inserted as `pending` before sending — unique index on `(booking_id, sms_type)` blocks retries. On 23505: stale pending rows (>5 min) are marked `unknown` (delivery ambiguous, manual check required) rather than auto-resent to prevent duplicate texts.
- **`sms_logs.status` extended:** added `unknown` value for the ambiguous crash-after-send case. Migration 008 drops and re-adds the check constraint. `SmsStatus` type updated.
- **Stockholm timezone:** date/time in SMS messages use `timeZone: 'Europe/Stockholm'` — server runtime UTC no longer causes wrong appointment times.
- **Booking create RLS fix:** `POST /api/bookings/create` switched from `createRawClient` (session-based, breaks without middleware) to `createServiceClient` (bypasses RLS) — fixes "new row violates RLS policy for customers" error in dev.
- **SMS templates API dev bypass:** `GET /api/sms-templates` now allows unauthenticated access in `NODE_ENV=development`, matching the pattern used by other API routes.
- **TypeScript:** `calendar/page.tsx` cast updated to `as unknown as Booking[]` after regenerated types exposed `cleaning_job` shape mismatch. Database types regenerated post-migration-008.
- **`sms-parts.ts`** (`src/lib/sms/sms-parts.ts`): client-safe GSM-7/Unicode SMS part calculator. Swedish å/ä/ö correctly treated as GSM-7 basic (1 septet each); extended chars (^, {, }, €, etc.) count as 2.
- **⚠️ SMS not yet confirmed working end-to-end** — booking creation now works, approval flow wired, but live SMS delivery to phone not yet verified.

### 2026-07-09 (SMS provider migration + auth hardening)
- **GHL SMS removed** — all SMS now goes through 46elks exclusively. GHL env vars commented out in `.env.local` (reserved for future use).
- **`sendRawSms` exported** from `src/lib/sms/46elks.ts` — normalises phone and sends a pre-composed message body, used by the manual send endpoint.
- **`POST /api/bookings/create` SMS wired to 46elks** — admin/manager-created confirmed bookings now send SMS via the same path as the approval flow: fetch active template → insert pending `sms_log` → send via 46elks → update log to sent/failed. Worker-submitted pending bookings still skip SMS.
- **`POST /api/sms/send` rewritten** — manual SMS now uses 46elks instead of GHL. Requires admin or manager role (403 Forbidden for workers). Uses service client so RLS doesn't block the booking/log fetch. `sms_log` and `bookings.sms_confirmation_sent` errors now logged instead of silently ignored.
- **Auth hardened on booking create** — unauthenticated requests return 401 in production (matching the dev-bypass pattern used across other routes). Service client created after auth is verified. Unauthenticated fallback role changed from `admin` to `worker`.
- **Supabase service key** — project uses `SUPABASE_SECRET_KEY` (new Supabase publishable/secret key format). `service.ts` reads this key; `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is the browser client key.
- **Debug logs added** to `GET /api/bookings/[id]`, `POST /api/bookings/create` (SMS path), and `POST /api/bookings/approve` (SMS path) — visible in Vercel function logs, not browser devtools. Phone numbers redacted from all logs.

### 2026-07-23 (SMS sender fix + toast outcome surfacing + toast polish)
- **Root cause of 46elks 403 found:** `FORTYSIX_ELKS_FROM` was set to `KOM-FORT` — 46elks rejects hyphens in alphanumeric sender IDs (only A-Z, a-z, 0-9 allowed). Fixed to `KOMFORT` in `.env.local`. The SMS template body itself (Swedish å/ä/ö) was never the problem — that's normal Unicode SMS content, unrelated to the sender-ID charset rule.
- **SMS outcome now surfaced to the UI, not just logged.** `POST /api/bookings/create` and `POST /api/bookings/approve` both now return `smsSent` (existing) plus a new `smsError` string describing exactly why the send failed (no active template, `sms_log` insert failure, missing customer phone, duplicate-send guard, or the 46elks error itself).
- **Toasts wired to those fields** in `create-booking-modal.tsx`, `pending-bookings-banner.tsx`, and `bookings/[id]/page.tsx`: success toast when SMS actually sends, error toast with the reason when it doesn't. Previously `smsSent` was returned by the API but silently ignored client-side — failures (like the sender-ID 403) were invisible outside server logs.
- **Toast visual design overhauled** (`src/components/layout/providers.tsx`, `src/app/globals.css`): dropped Sonner's `richColors` prop, which was painting the whole toast in a flat, hardcoded light pink/green fill — disconnected from the app's actual near-black gold-accent token system and low-contrast as a result. Replaced with `toastOptions.classNames` styled from the app's own tokens: toast surface is `--card` with a `1px --border`, status is carried only by a 3px left accent bar + icon color (`--destructive` red for errors, `--status-completed` green for success) rather than tinting the entire toast, title/description use `--foreground` / `--muted-foreground` for a sharp, high-contrast read, and a proper drop shadow was added so it lifts off the page. No call sites changed — this is a global restyle, so every `toast.error`/`toast.success` in the app picked up the new look automatically.
- **Stale comment fixed** in `approve/route.ts` — stale pending rows are marked `unknown` and skipped (not failed/retried).
