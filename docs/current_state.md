# KOM-fort Bilvård — Portal: Current State
_Last updated: 2026-06-09_

---

## About the project

Internal all-in-one system for KOM-fort Bilvård. The calendar is the core — everything flows from it.
Built specifically for Göran's and the workers' daily workflow, not a generic calendar tool.

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
| SMS | GHL Conversations API (ready for 46elks swap) |
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
      bookings/page.tsx                # Bookings list (hardcoded empty — not prioritised)
      bookings/[id]/page.tsx           # ✅ Booking detail page with full editing + job photo section
      customers/[id]/page.tsx          # ✅ Customer history: visits, cars, SMS, notes
      my-shifts/page.tsx               # ✅ My shifts: add, search, view linked bookings
      jobs/page.tsx                    # ✅ Kanban board — fetches live data from /api/jobs
      admin/job-reviews/page.tsx       # ✅ Admin before/after photo review page (Göran only)
      workers/page.tsx                 # ✅ Staff management — list all employees, change roles, activate/deactivate, add new
      settings/page.tsx                # Placeholder
    api/
      bookings/route.ts                # GET list, POST simple
      bookings/create/route.ts         # ✅ POST customer+car+booking+SMS in one call
      bookings/[id]/route.ts           # GET, PATCH, DELETE single booking
      shifts/route.ts                  # ✅ GET filter shifts, POST create shift
      shifts/approve/route.ts          # ✅ POST approve/reject (requires admin/manager)
      customers/[id]/route.ts          # ✅ GET full customer profile, PATCH notes
      sms/send/route.ts                # POST manual SMS via GHL
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
      calendar-view.tsx                # Toolbar, filters, view switcher, "New booking" button
      day-view.tsx                     # 24h grid, 15-min snap slot clicks, live time line
      week-view.tsx                    # 7-col grid, 15-min snap per column
      month-view.tsx                   # Month view, click → day view
      booking-detail-panel.tsx         # Slide-in panel from right on booking click
      calendar-utils.ts                # Layout math, time helpers, HOUR_PX constant
      create-booking-modal.tsx         # ✅ Modal: customer, car, service, status, worker, price
    shifts/
      create-shift-modal.tsx           # ✅ Modal for worker to submit a shift
      pending-shifts-banner.tsx        # ✅ Yellow banner on dashboard — Göran approves directly
      pending-shifts-panel.tsx         # Reusable panel for pending shifts
    jobs/
      jobs-board.tsx                   # ✅ Kanban board component (4 columns by status)
      job-photos.tsx                   # ✅ Before/after photo upload component for workers
    layout/
      sidebar.tsx                      # Side menu — "Granskning" link visible for admin/manager
      top-bar.tsx                      # Top bar with date, avatar, logout
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
```

---

## Database

| Table | Purpose |
|---|---|
| `profiles` | Workers/admins, roles: admin/manager/worker |
| `customers` | Customer registry linked to GHL |
| `cars` | Cars per customer (make, model, plate, color) |
| `bookings` | Core booking — customer, car, worker, status, SMS flags |
| `shifts` | Work shifts — worker_id, starts_at, ends_at, status (pending/approved/rejected) |
| `cleaning_jobs` | Job execution — one per booking, tracks status + timestamps |
| `job_images` | Before/after photos — job_id, storage_path, public_url, type (before/after), uploaded_by |
| `sms_logs` | SMS log with type, provider, delivery time |
| `activity_log` | Audit trail |
| `highlevel_sync_logs` | Webhook log with idempotency |

**Migrations to run in order:**
1. `schema.sql` (fresh DB) or skip if tables already exist
2. `001_additive.sql`
3. `002_shifts.sql`
4. `003_cleaning_jobs.sql`
5. `004_admin_manage_profiles.sql` — admins can update/insert any profile row
6. `005_bookings_admin_only.sql` — booking insert/update restricted to admin only (was admin+manager)

**Storage buckets (create manually in Supabase dashboard, set to public):**
- `car-before-images`
- `car-after-images`

---

## Auth

- Supabase Auth, three roles: `admin` / `manager` / `worker`
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

- **`HOUR_PX = 72`** in `calendar-utils.ts` — base font 18px makes `h-16` (4rem) = 72px per hour row. All pixel calculations use this constant. Never hardcode `64`.
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
4. SMS confirmation sent via GHL (requires `highlevel_contact_id` on the customer)
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

**Göran's review flow (`/admin/job-reviews`):**
1. Sidebar shows "Granskning" link (only for admin/manager)
2. Badge shows how many jobs are waiting
3. Filter: *Waiting / All / Done*
4. Jobs are grouped by date (Today / Yesterday / older dates) and sorted newest first
5. Each job card expands to show before and after photos side by side
6. Click any photo → opens fullscreen lightbox with arrow navigation (keyboard arrows + Escape supported)
7. Before approving, Göran can optionally write a comment to the worker
8. Click "Godkänn jobbet" → status changes to `completed`, comment saved as `admin_notes`
9. Worker sees Göran's comment on their booking page once the job is approved

**Technical notes:**
- `cleaning_jobs` has a `unique(booking_id)` constraint — one job per booking
- Job is created lazily: first photo upload triggers `POST /api/jobs` if no job exists yet
- Images are stored at `{jobId}/{timestamp}.{ext}` inside the bucket
- `GET /api/jobs?booking_id=` is used by `JobPhotos` to check if a job already exists
- `admin_notes` field on `cleaning_jobs` stores Göran's feedback comment
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
3. Göran sees yellow banner on dashboard → approves ✓ or rejects ✗ with one click
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
| `/api/sms/send` | POST | Manual SMS via GHL |
| `/api/webhooks/ghl` | POST | GHL sync |
| `/api/jobs` | GET, POST | List jobs (`?booking_id=` filter), create job |
| `/api/jobs/[id]` | GET, PATCH | Single job — status, notes, timestamps |
| `/api/jobs/[id]/images` | POST | Upload image to Supabase Storage |
| `/api/workers` | GET, POST | GET: `?all=true` includes inactive; POST: invite new employee via Supabase Auth |
| `/api/workers/[id]` | PATCH | Update role or `is_active` — admin only, uses service client |
| `/api/me` | GET | Current user's profile (id, role, full_name); returns dev stub when no session |

---

## What's not built yet / next steps

| Feature | Priority |
|---|---|
| Auth enabled (proxy.ts is passthrough) | **Before production** |
| Storage bucket RLS policies | **Before production** |
| SMS via 46elks (replace GHL) | High |
| Auto-SMS on booking create (requires highlevel_contact_id) | High |
| Auto-SMS when car is ready | High |
| Dashboard stats with real data (totalBookings, activeJobs, completedToday) | Medium |
| Recent bookings on dashboard with real data | Medium |
| Bookings list page (`/bookings`) with real data | Medium |
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

### 2026-06-09
- **Job photo flow:** `JobPhotos` component on `/bookings/[id]` — workers upload before/after photos, status auto-updates (`not_started` → `in_progress` → `needs_review`). Lightbox for fullscreen image viewing with keyboard navigation.
- **Admin job review page** (`/admin/job-reviews`): before/after photos side by side, date grouping (Today/Yesterday/older), approve with optional comment. Only visible to admin/manager.
- **Pending shifts banner:** now only rendered for admin/manager roles. Error handling added for failed fetch and approve/reject actions.
- **Calendar refetch fix:** `window.location.reload()` replaced with `router.refresh()` — filter state and scroll position preserved after creating a booking.
- **Workers assignment dropdown fixed:** `/bookings/[id]` now fetches all active employees via `GET /api/workers` — Göran can assign any employee including himself. Label changed from "Tekniker" to "Ansvarig".
- **New API route:** `GET /api/workers` — returns all active profiles (worker + manager + admin), sorted by name.
- **Calendar worker filter:** now includes admins so bookings assigned to Göran appear correctly.
- **Hardcoded "Goran" strings removed** from `job-photos.tsx` and `create-shift-modal.tsx` — replaced with role-neutral text.
- **Lint fixes:** `useEffect` async calls wrapped with `void`, `<img>` elements in lightbox and job-reviews suppressed with eslint comments (external Supabase URLs, dimensions unknown).
- **Job review bug fixes:** `handleMarkDone` now checks `res.ok` before updating UI; local state updated from full API response (includes `admin_notes` and `completed_at`).
- **Staff management page** (`/workers`): rebuilt from scratch — `GET /api/workers?all=true`, inline role dropdown, activate/deactivate toggle, add employee form. Admin's own row is locked from editing.
- **Add employee via Supabase Auth invite** (`POST /api/workers`): uses `supabase.auth.admin.inviteUserByEmail` to create auth user first (avoids FK violation from inserting profiles with random UUID), then upserts the profile row with name/role/phone. Employee receives a signup email.
- **Booking edit restricted to admin only:** `canEdit = myRole === 'admin'` (managers are read-only). DB RLS updated via `005_bookings_admin_only.sql` to match. Stale "admin and manager" comments in booking page removed.
- **`PATCH /api/workers/[id]` always uses service client** after admin check — fixes dev mode where skipping auth check left the anon client in place (blocked by RLS).
- **Migration `004_admin_manage_profiles.sql`:** allows admins to update and insert any profile row.
- **Migration `005_bookings_admin_only.sql`:** restricts booking insert/update policies to `role = 'admin'` (previously also allowed managers).
