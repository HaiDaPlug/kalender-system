# KOM-fort Bilvård — Portal: Current State
_Last updated: 2026-07-12_

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
| Styling | Tailwind CSS v4 + shadcn/ui, dark theme, Swedish yellow accent (#F5C842) |
| Database / Auth | Supabase (Postgres + Auth) — Hai's project: `vsnbaylcgcksabwradgu` |
| Image storage | Supabase Storage (buckets: `car-before-images`, `car-after-images`) |
| GHL integration | HighLevel API v2 |
| SMS | 46elks (confirmation on booking approval) |
| Font | DM Sans + DM Mono |
| Animations | Framer Motion (installed, used for modal/panel transitions) |

---

## File structure — key files

```
src/
  proxy.ts                             # Auth proxy (passthrough in dev)
  types/index.ts                       # All types: Booking, Shift, CleaningJob, ImageRecord, etc.
  lib/
    supabase/
      client.ts                        # Browser client (typed)
      server.ts                        # Server client for reads
      server-raw.ts                    # Untyped client for mutation routes
      service.ts                       # Service-role, bypasses RLS (webhooks only)
      middleware.ts                    # updateSession (activated when auth is enabled)
    gohighlevel/
      client.ts                        # GHL API v2: calendar, contacts, SMS
      webhooks.ts                      # Payload parsers for appointment + contact
  app/
    (auth)/login/                      # Login page (Swedish UI)
    (dashboard)/
      layout.tsx                       # Reads profile from session; DEV_PROFILE stub otherwise
      dashboard/page.tsx               # Overview: stats + pending shifts banner + recent bookings
      calendar/page.tsx                # Calendar — fetches data from Supabase
      bookings/page.tsx                # Bookings list — not linked in sidebar (calendar covers this)
      bookings/[id]/page.tsx           # ✅ Booking detail page with full editing + job photo section
      customers/[id]/page.tsx          # ✅ Customer history: visits, cars, SMS, notes
      my-shifts/page.tsx               # ✅ My shifts: add, search, view linked bookings
      jobs/page.tsx                    # ✅ Kanban board — fetches live data from /api/jobs
      admin/job-reviews/page.tsx       # ✅ Admin before/after photo review page (Goran only)
      admin/sms-templates/page.tsx     # ✅ Admin SMS template editor — variable chips, GSM-7 part counter
      workers/page.tsx                 # ✅ Staff management — list all employees, change roles, activate/deactivate, add new
      settings/page.tsx                # Placeholder — not linked in sidebar
    api/
      bookings/route.ts                # GET list, POST simple
      bookings/create/route.ts         # ✅ POST customer+car+booking+SMS in one call
      bookings/[id]/route.ts           # GET, PATCH, DELETE single booking
      shifts/route.ts                  # ✅ GET filter shifts, POST create shift
      shifts/approve/route.ts          # ✅ POST approve/reject (requires admin/manager)
      customers/[id]/route.ts          # ✅ GET full customer profile, PATCH notes
      sms/send/route.ts                # POST manual SMS via 46elks (admin/manager only)
      webhooks/ghl/route.ts            # POST GHL appointment/contact sync
      jobs/route.ts                    # ✅ GET list (supports ?booking_id=), POST create job
      jobs/[id]/route.ts               # ✅ GET single job, PATCH status/notes
      jobs/[id]/images/route.ts        # ✅ POST upload image to Supabase Storage
      workers/route.ts                 # ✅ GET active/all employees; POST invites via Supabase Auth Admin API
      workers/[id]/route.ts           # ✅ PATCH role or is_active (admin only, uses service client)
  components/
    ui/
      modal.tsx                        # ✅ Reusable Modal + SidePanel with smooth CSS transitions
      lightbox.tsx                     # ✅ Fullscreen image lightbox with arrow + keyboard navigation
      button.tsx
    calendar/
      calendar-view.tsx                # Full-bleed toolbar (nav, title, view dropdown, status/worker filters, "Ny bokning" at far right) + status legend footer below the grid
      day-view.tsx                     # 24h grid, 15-min snap slot clicks, live time line
      week-view.tsx                    # 7-col grid, 15-min snap per column, compact day headers (day name above date circle, V{week} in the left spacer)
      month-view.tsx                   # Month view, click → day view
      booking-detail-panel.tsx         # Slide-in panel from right on booking click
      calendar-utils.ts                # Layout math, time helpers, HOUR_PX / TIME_COL_PX constants
      create-booking-modal.tsx         # ✅ Modal: customer, car, service, status, worker, price
    shifts/
      create-shift-modal.tsx           # ✅ Modal for worker to submit a shift
      pending-shifts-banner.tsx        # ✅ Yellow banner on dashboard — Goran approves directly
      pending-shifts-panel.tsx         # Reusable panel for pending shifts
    jobs/
      jobs-board.tsx                   # ✅ Kanban board component (4 columns by status) — cards link to /bookings/[id]
      job-photos.tsx                   # ✅ Before/after photo upload component for workers
    layout/
      sidebar.tsx                      # Side menu: Översikt, Kalender, Mina pass, Jobb, Granskning*, SMS-mallar**, Personal* (*admin/manager, **admin only). Collapsible (icon rail, persisted in localStorage). No wordmark/logo. Bottom-up: notifications bell → account section (avatar/name/role, click opens "Logga ut" popup, wired to Supabase sign-out).
      top-bar.tsx                      # Top bar with page title + date only — no avatar/notifications/logout (moved into sidebar account section)
      providers.tsx
    auth/login-form.tsx
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
10. **Not yet a migration file** — `alter function handle_new_user() set search_path = public;` applied directly to the live DB on 2026-07-11. See changelog for why. Should be captured as `009_fix_handle_new_user_search_path.sql` before the next fresh-DB setup.

**Storage buckets (create manually in Supabase dashboard, set to public):**
- `car-before-images`
- `car-after-images`

---

## Auth

- Supabase Auth, three roles: `admin` (Administratör) / `manager` (Admin) / `worker` (Personal)
- **Currently disabled** — `proxy.ts` returns `NextResponse.next()` unconditionally
- Layout uses `DEV_PROFILE` stub (Hai Pham Bui, admin) when no session exists
- **To enable:** replace `proxy.ts` body with `return updateSession(request)`, remove `DEV_PROFILE` from `layout.tsx`

---

## Calendar — the core

Three views: **Day / Week / Month**

- Hover over empty time → 30-min highlight block appears, snapped to **15-min grid**, showing the time label in the top-left corner (Google Calendar style)
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
| `/api/bookings/create` | POST | Customer+car+booking+SMS atomically |
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
| `/api/me` | GET | Current user's profile (id, role, full_name); returns dev stub when no session |
| `/api/bookings/approve` | POST | Admin/manager approves or rejects a pending booking — triggers email to worker + SMS to customer |
| `/api/sms-templates` | GET, PATCH | GET: active template (auth required); PATCH: update body (admin only) |

---

## What's not built yet / next steps

| Feature | Priority |
|---|---|
| Auth enabled (proxy.ts is passthrough) | **Before production** |
| Storage bucket RLS policies | **Before production** |
| SMS via 46elks — wired up, debug logs added, blocked on live test (see 2026-07-12 entry) | **In progress** |
| Auto-SMS on booking create — now wired via 46elks (same path as approval) | Done |
| Auto-SMS when car is ready | High |
| Dashboard stats with real data (totalBookings, activeJobs, completedToday) | Medium |
| Recent bookings on dashboard with real data | Medium |
| Bookings list page (`/bookings`) | Removed from nav — calendar covers this use case |
| Staff page (`/workers`) | ~~Done~~ — roles, activate/deactivate, add employee |
| my-shifts page: replace DEV_USER with real session user | Requires auth |
| Drag-and-drop in calendar | Low |
| Customer list (`/customers`) | Low |
| Activity log UI | Low |
| GHL_WEBHOOK_PUBLIC_KEY configured | Before webhooks go live |

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

---

## Changelog

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
- **Sidebar given a distinct warm gold-tinted dark tone** (`--sidebar: #17140F`, `--sidebar-accent: #241F17`, `--sidebar-border: #332C1F`) — same hue family as the `#F5C842` brand yellow but near-black in lightness, so the sidebar reads as its own zone instead of blending into the neutral-gray main content background.

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
- **Stale comment fixed** in `approve/route.ts` — stale pending rows are marked `unknown` and skipped (not failed/retried).
