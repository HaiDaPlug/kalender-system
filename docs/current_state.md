# RenGör — Current State
_Last updated: 2026-06-03_

---

## What was built this session

### 1. Tech stack scaffolded from scratch

| Layer | Choice |
|---|---|
| Framework | Next.js 15 / App Router, TypeScript, `src/` dir |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database / Auth | Supabase (Postgres + Auth) |
| Image storage | Supabase Storage |
| Client cache | TanStack Query |
| GHL integration | HighLevel API v2 |
| SMS | GHL Conversations API (provider abstraction ready for 46elks swap) |
| Font | DM Sans + DM Mono |

---

### 2. Database schema (`supabase/schema.sql`)

Full Postgres schema written and ready to run in Supabase SQL editor.

| Table | Purpose |
|---|---|
| `profiles` | Workers/admins (extends `auth.users` via trigger) |
| `customers` | Customer records, linked to GHL contact ID |
| `cars` | Cars per customer (make, model, reg plate, VIN, color) |
| `bookings` | Core booking: customer, car, worker, status, GHL appointment ID, SMS flag |
| `cleaning_jobs` | Job execution: worker, status, started/completed timestamps, notes |
| `job_images` | Before/after images with storage path, uploader, type |
| `sms_logs` | Full SMS audit trail (status, provider message ID, error) |
| `highlevel_sync_logs` | Webhook + sync audit trail |

RLS policies set on all tables. Auto-trigger creates `profiles` row on signup.

---

### 3. Supabase client setup (`src/lib/supabase/`)

- `client.ts` — typed browser client
- `server.ts` — typed server client (for read paths in Server Components)
- `server-raw.ts` — untyped server client (for API routes that accept dynamic JSON)
- `middleware.ts` — session refresh (currently bypassed for dev)

---

### 4. GoHighLevel integration layer (`src/lib/gohighlevel/`)

- `client.ts` — full API v2 wrappers: `ghlCalendar`, `ghlContacts`, `ghlConversations`
- `webhooks.ts` — typed payload parsers for appointment + contact events

---

### 5. API routes (`src/app/api/`)

| Route | Method | Purpose |
|---|---|---|
| `/api/bookings` | GET, POST | List/create bookings |
| `/api/bookings/[id]` | GET, PATCH, DELETE | Single booking CRUD |
| `/api/jobs/[id]/images` | POST | Upload before/after image to Supabase Storage |
| `/api/sms/send` | POST | Send SMS via GHL, write SMS log |
| `/api/webhooks/ghl` | POST | Receive GHL appointment/contact webhooks |

---

### 6. Auth

- Supabase Auth with three roles: `admin`, `manager`, `worker`
- **Currently bypassed for local dev** — `DEV_PROFILE` stub in dashboard layout, middleware returns `NextResponse.next()` unconditionally
- To re-enable: restore `src/middleware.ts` to call `updateSession` and restore `src/app/(dashboard)/layout.tsx` to fetch real user

---

### 7. Design system

- **Theme**: Swedish industrial dark — near-black `#0A0A0B`, warm off-white `#F0EDE8`, Swedish yellow `#F5C842` as single accent
- **Typography**: DM Sans (body), DM Mono (numbers/code)
- **Language**: 100% Swedish UI (nav, headings, empty states, status labels, dates)
- **Globals**: custom scrollbar, `label-caps` utility, `animate-fade-up`, tabular nums

---

### 8. Pages built

| Route | Status |
|---|---|
| `/dashboard` | Stats (0-state) + recent bookings list |
| `/calendar` | Full Google Calendar-like view (see below) |
| `/bookings` | Table with status badges |
| `/jobs` | Kanban board (4 columns) |
| `/workers` | Table with avatar initials |
| `/settings` | Placeholder |
| `/login` | Swedish login form (Supabase auth, bypassed) |

---

### 9. Calendar — the main feature built this session

A full Google Calendar-like experience built from scratch, specific to the car cleaning workflow.

#### Three views

**Dagvy (Day):**
- Full 24h vertical time grid
- Booking blocks sized proportionally to duration in minutes
- Red current-time indicator line
- Event card shows: customer name, car make/model, reg plate, worker, status badge, SMS dot (green = sent, grey = not sent)
- Customer notes visible on tall events
- Click event → detail panel

**Veckovy (Week):**
- 7-column time grid with week number (V.xx format)
- Same proportional event blocks
- Current-time line on today's column only
- 3 detail levels depending on event height (name → car → worker)
- SMS dot on all events

**Månadsvy (Month):**
- Compact monthly grid
- Up to 3 events shown per cell with left-border color coding
- Click day → drills into dag view

#### Filters
- Status filter dropdown (Alla statusar / Väntande / Bekräftad / Pågående / Klar / Avbokad)
- Worker filter dropdown (populated from workers prop)
- Status legend bar — click any status pill to filter/unfilter instantly with counts

#### Booking detail side panel
Slides in on event click, shows:
- Status badge
- Service type + time + address
- Customer name + phone
- Car make/model + reg plate + color
- Assigned worker (avatar initial)
- Customer notes
- Internal service notes
- SMS confirmation status

#### Navigation
- Idag button (jump to today)
- Prev/next chevrons (moves by day/week/month depending on view)
- Swedish month names, Swedish day abbreviations (Mån–Sön), week numbers

---

## What is NOT built yet

| Feature | Priority |
|---|---|
| Booking detail page (`/bookings/[id]`) | High |
| Create booking form + booking confirmation SMS | High |
| Two-SMS flow (order confirmation + cleaning complete) | High |
| 46elks SMS provider (vs GHL) — decision pending | Medium |
| `/my-cars` and `/my-cars/today` worker views | High |
| `/customers` and `/cars` pages | Medium |
| `/settings/integrations/highlevel` page | Medium |
| Activity logs (who did what, when) | Medium |
| Image thumbnail gallery on booking detail | Medium |
| Smart alerts (missing worker, overdue, SMS failed) | Medium |
| Supabase Auth wired up (currently bypassed) | High — before any real use |
| Real data wired to calendar/bookings/jobs pages | High — requires Supabase credentials in `.env.local` |
| Drag-and-drop booking movement on calendar | Low |

---

## To get the app running locally

```bash
# 1. Install dependencies (already done)
npm install

# 2. Copy env file and fill in your Supabase + GHL credentials
cp .env.local.example .env.local

# 3. Run schema in Supabase SQL editor
# → paste contents of supabase/schema.sql

# 4. Create storage buckets in Supabase dashboard
# → car-before-images
# → car-after-images

# 5. Start dev server
npm run dev
# → http://localhost:3000 (redirects to /dashboard, auth bypassed)
```

---

## Repo

[github.com/HaiDaPlug/kalender-system](https://github.com/HaiDaPlug/kalender-system)
