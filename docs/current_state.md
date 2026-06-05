# KOM-fort Bilvård — Portal: Current State
_Last updated: 2026-06-05 (post-audit fixes)_

---

## About the project

Internal all-in-one system for KOM-fort Bilvård. The calendar is the core — everything flows from it.
Built specifically for Göran's and the workers' daily workflow, not a generic calendar tool.

- **Repo:** [github.com/HaiDaPlug/kalender-system](https://github.com/HaiDaPlug/kalender-system)
- **Local:** `/Users/erikryden/kalender-system`
- **Dev server:** `npm run dev` → http://localhost:3000

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.7 / App Router, TypeScript, `src/` structure |
| Styling | Tailwind CSS v4 + shadcn/ui, dark theme, Swedish yellow accent (#F5C842) |
| Animations | Framer Motion (modal transitions, panel slides) |
| Database / Auth | Supabase (Postgres + Auth) — Hai's project: `vsnbaylcgcksabwradgu` |
| Image storage | Supabase Storage |
| GHL integration | HighLevel API v2 |
| SMS | GHL Conversations API (ready for 46elks swap) |
| Font | DM Sans + DM Mono |

---

## File structure — key files

```
src/
  proxy.ts                             # Auth proxy (passthrough in dev)
  types/index.ts                       # All types: Booking, Shift, Customer, Car, SmsLog, etc.
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
      bookings/[id]/page.tsx           # ✅ Booking detail page with full editing
      customers/[id]/page.tsx          # ✅ Customer history: visits, cars, SMS, notes
      my-shifts/page.tsx               # ✅ My shifts: add, search, view linked bookings
      jobs/page.tsx                    # Kanban board (hardcoded empty)
      workers/page.tsx                 # Staff list (hardcoded empty)
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
      jobs/[id]/images/route.ts        # POST upload image to Storage
  components/
    ui/
      modal.tsx                        # ✅ Shared Modal + SidePanel (CSS transitions, escape key, delayed unmount)
    calendar/
      calendar-view.tsx                # Toolbar, filters, view switcher, "New booking" button
      day-view.tsx                     # 24h grid, hover slot (1h) with +, live time line
      week-view.tsx                    # 7-col grid, hover slot per column
      month-view.tsx                   # Month view, click → day view
      booking-detail-panel.tsx         # Slide-in panel from right on booking click
      calendar-utils.ts                # Layout math, time helpers, HOUR_PX constant
      create-booking-modal.tsx         # ✅ Modal: customer, car, service, status, worker, price
    shifts/
      create-shift-modal.tsx           # ✅ Modal for worker to submit a shift
      pending-shifts-banner.tsx        # ✅ Yellow banner on dashboard — reviewerId prop (no hardcoded id)
      pending-shifts-panel.tsx         # Reusable panel for pending shifts
    layout/
      sidebar.tsx                      # Side menu with nav links
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
| `cleaning_jobs` | Job execution — worker, status, start/complete timestamps |
| `job_images` | Before/after images with storage path |
| `sms_logs` | SMS log with type, provider, delivery time |
| `activity_log` | Audit trail |
| `highlevel_sync_logs` | Webhook log with idempotency |

**Migrations to run in order:**
1. `schema.sql` (fresh DB) or skip to step 2 if tables already exist
2. `001_additive.sql`
3. `002_shifts.sql`

---

## Auth

- Supabase Auth, three roles: `admin` / `manager` / `worker`
- **Currently disabled** — `proxy.ts` returns `NextResponse.next()` unconditionally
- Layout uses `DEV_PROFILE` stub (Hai Pham Bui, admin) when no session exists
- **To enable:** replace `proxy.ts` body with `return updateSession(request)`, remove `DEV_PROFILE` from `layout.tsx`

---

## Calendar — the core

Three views: **Day / Week / Month**

- Click on empty slot (1h) → hover highlights with `+` → opens "New booking" modal with time prefilled
- Modal remounts on each new slot click (`key={time.toISOString()}`) — form always resets to correct time
- Click on existing booking → detail panel slides in from right
- "New booking" button in toolbar → same modal
- Double bookings allowed — no blocking in API
- Live time line updates every 60 seconds, auto-scrolls to current time on load
- Status filter + worker filter in toolbar

---

## Calendar — technical notes

- **`HOUR_PX = 72`** in `calendar-utils.ts` — base font 18px makes `h-16` (4rem) = 72px per hour row. All pixel calculations (time line, slot clicks, booking height, hour lines, scroll targets) use this constant. Never hardcode `64`.
- Auto-scrolls to current time on load (day + week views).
- Time line in week view spans all 7 columns as a single absolute element.
- Slot click uses `scrollRef.current.scrollTop` directly — not `.closest('.overflow-y-auto')`.
- Supabase key is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (not `ANON_KEY`).

---

## Booking flow (create)

1. Click time in calendar → modal opens
2. Fill in: customer (name + phone required), car (make + model required), service, duration, status, worker, price, notes
3. `POST /api/bookings/create` — creates customer (reuses if phone number exists) + car + booking
4. SMS sent via GHL **only if** customer has `highlevel_contact_id` — log + `sms_confirmation_sent` flag only set on actual send
5. Calendar reloads

---

## Booking detail page (`/bookings/[id]`)

Edit directly on the page — no hidden forms:
- **Status** — click the right status badge
- **Time, duration, service, worker, price** — editable fields
- **Customer notes + internal notes** — clearly separated
- **History link** → jumps to customer's full history
- **Delete** with confirmation dialog

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

---

## Animations & UX

- **Modals:** scale-in from center with spring feel
- **Detail panel:** slide-in from right
- **Page navigation:** fade-up on page change
- **Sidebar hover:** slides 0.5px right
- **Buttons:** scale(0.97) on click
- **Hover slot in calendar:** fade-in, subtle background

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
| `/api/jobs/[id]/images` | POST | Image upload |

---

## What's not built yet / next steps

| Feature | Priority |
|---|---|
| Auth enabled (proxy.ts is passthrough) | **Before production** |
| SMS via 46elks (replace GHL) | High |
| Auto-SMS on booking create (requires highlevel_contact_id) | High |
| Auto-SMS when car is ready | High |
| Bookings list with real data (`/bookings`) | High |
| Staff page with real data (`/workers`) | Medium |
| Drag-and-drop in calendar | Low |
| Customer list (`/customers`) | Medium |
| Activity log UI | Low |
| GHL_WEBHOOK_PUBLIC_KEY configured | Before webhooks go live |

---

## Getting started locally

```bash
npm install
# Create .env.local with Supabase keys (see .env.local.example)
# Run schema.sql + migrations in Supabase SQL editor
npm run dev
# → http://localhost:3000
```

**Build:** `npm run build` — passes, 0 errors
**Lint:** `npm run lint` — passes, 0 errors, 0 warnings

---

## Recent fixes (2026-06-05)

- **Double-submit removed** — booking modal submit button was firing twice (form association + manual `requestSubmit`); now just `type="submit"`
- **SMS false-positive fixed** — `sms_logs` insert and `sms_confirmation_sent` flag now only set when GHL actually sends (customer has `highlevel_contact_id`)
- **Hardcoded reviewer removed** — `PendingShiftsBanner` now takes `reviewerId` prop; approve/reject buttons hidden when not provided
- **Shifts RLS tightened** — worker update policy now requires `status = 'pending'` and adds `with check` clause; workers can't self-approve
- **Modal extracted** — `src/components/ui/modal.tsx` with `Modal` + `SidePanel`, CSS transitions, escape key, delayed unmount
- **`CreateBookingModal` remount keys** — all three calendar views pass `key={time.toISOString()}` so form resets correctly on each slot click
- **Lint rule fixed** — all `useEffect(() => { fetchX() })` patterns wrapped as async IIFEs to satisfy `react-hooks/set-state-in-effect`
