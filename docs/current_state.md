# KOM-fort Bilvård — Portal: Current State
_Senast uppdaterad: 2026-06-05_

---

## Om projektet

Internt all-in-one system för KOM-fort Bilvård. Kalender är kärnan — allt flödar därifrån.
Byggt specifikt för Gorans och de anställdas vardag, inte ett generiskt kalenderverktyg.

- **Repo:** [github.com/HaiDaPlug/kalender-system](https://github.com/HaiDaPlug/kalender-system)
- **Lokalt:** `/Users/erikryden/kalender-system`
- **Dev-server:** `npm run dev` → http://localhost:3000

---

## Tech stack

| Lager | Val |
|---|---|
| Ramverk | Next.js 16.2.7 / App Router, TypeScript, `src/`-struktur |
| Styling | Tailwind CSS v4 + shadcn/ui, mörkt tema, svensk gul accent (#F5C842) |
| Databas / Auth | Supabase (Postgres + Auth) — Hais projekt: `vsnbaylcgcksabwradgu` |
| Bildlagring | Supabase Storage |
| GHL-integration | HighLevel API v2 |
| SMS | GHL Conversations API (redo för 46elks-byte) |
| Font | DM Sans + DM Mono |

---

## Filstruktur — viktiga filer

```
src/
  proxy.ts                             # Auth-proxy (passthrough under dev)
  types/index.ts                       # Alla typer: Booking, Shift, Customer, Car, SmsLog, m.fl.
  lib/
    supabase/
      client.ts                        # Browser-klient (typed)
      server.ts                        # Server-klient för läsning
      server-raw.ts                    # Okopplad klient för mutation-routes
      service.ts                       # Service-role, kringgår RLS (endast webhooks)
      middleware.ts                    # updateSession (aktiveras när auth slås på)
    gohighlevel/
      client.ts                        # GHL API v2: kalender, kontakter, SMS
      webhooks.ts                      # Payload-parsers för appointment + contact
  app/
    (auth)/login/                      # Inloggningssida (svenska)
    (dashboard)/
      layout.tsx                       # Läser profil från session; DEV_PROFILE-stub annars
      dashboard/page.tsx               # Översikt: stats + väntande pass-banner + senaste bokningar
      calendar/page.tsx                # Kalender — hämtar data från Supabase
      bookings/page.tsx                # Bokningslista (hårdkodad tom — ej prioriterad)
      bookings/[id]/page.tsx           # ✅ Bokningsdetaljsida med full redigering
      customers/[id]/page.tsx          # ✅ Kundhistorik: besök, bilar, SMS, anteckningar
      my-shifts/page.tsx               # ✅ Mina pass: lägg in, sök, se kopplade bokningar
      jobs/page.tsx                    # Kanban-board (hårdkodad tom)
      workers/page.tsx                 # Personallista (hårdkodad tom)
      settings/page.tsx                # Platshållare
    api/
      bookings/route.ts                # GET lista, POST enkel
      bookings/create/route.ts         # ✅ POST kund+bil+bokning+SMS i ett anrop
      bookings/[id]/route.ts           # GET, PATCH, DELETE enskild bokning
      shifts/route.ts                  # ✅ GET filtrera pass, POST skapa pass
      shifts/approve/route.ts          # ✅ POST godkänn/avvisa (kräver admin/manager)
      customers/[id]/route.ts          # ✅ GET full kundprofil, PATCH anteckningar
      sms/send/route.ts                # POST manuellt SMS via GHL
      webhooks/ghl/route.ts            # POST GHL appointment/contact sync
      jobs/[id]/images/route.ts        # POST ladda upp bild till Storage
  components/
    calendar/
      calendar-view.tsx                # Toolbar, filter, vybyte, "Ny bokning"-knapp
      day-view.tsx                     # 24h-grid, hover-slot (1h) med +, live tidslinje
      week-view.tsx                    # 7-kol grid, hover-slot per kolumn
      month-view.tsx                   # Månadsvy, klick → dagvy
      booking-detail-panel.tsx         # Slide-in panel från höger vid klick på bokning
      calendar-utils.ts                # Layout-math, tidshjälpare
      create-booking-modal.tsx         # ✅ Modal: kund, bil, tjänst, status, tekniker, pris
    shifts/
      create-shift-modal.tsx           # ✅ Modal för anställd att lägga in pass
      pending-shifts-banner.tsx        # ✅ Gul banner på dashboard — Goran godkänner direkt
      pending-shifts-panel.tsx         # Återanvändbar panel för väntande pass
    layout/
      sidebar.tsx                      # Sidomeny med nav-länkar
      top-bar.tsx                      # Toprad med datum, avatar, utloggning
      providers.tsx
    auth/login-form.tsx
    booking/bookings-table.tsx
    dashboard/dashboard-stats.tsx
    dashboard/recent-bookings.tsx
supabase/
  schema.sql                           # Fullt schema — kör en gång på ny DB
  migrations/
    001_additive.sql                   # Additivt: calendar_color, SMS-kolumner, RLS-fixes
    002_shifts.sql                     # ✅ Shifts-tabell med RLS
```

---

## Databas

| Tabell | Syfte |
|---|---|
| `profiles` | Anställda/admin, roller: admin/manager/worker |
| `customers` | Kundregister kopplat till GHL |
| `cars` | Bilar per kund (märke, modell, regnr, färg) |
| `bookings` | Kärnbokning — kund, bil, tekniker, status, SMS-flaggor |
| `shifts` | Arbetspass — worker_id, starts_at, ends_at, status (pending/approved/rejected) |
| `cleaning_jobs` | Jobbkörning — tekniker, status, start/klar-timestamps |
| `job_images` | Före/efter-bilder med storage-path |
| `sms_logs` | SMS-logg med typ, provider, leveranstid |
| `activity_log` | Revisionsspår |
| `highlevel_sync_logs` | Webhook-logg med idempotens |

**Migrations att köra i ordning:**
1. `schema.sql` (ny DB) eller hoppa till steg 2 om tabeller finns
2. `001_additive.sql`
3. `002_shifts.sql`

---

## Auth

- Supabase Auth, tre roller: `admin` / `manager` / `worker`
- **Just nu avslagen** — `proxy.ts` returnerar `NextResponse.next()` direkt
- Layout använder `DEV_PROFILE`-stub (Hai Pham Bui, admin) när ingen session finns
- **För att slå på:** ersätt `proxy.ts` med `return updateSession(request)`, ta bort `DEV_PROFILE` i `layout.tsx`

---

## Kalender — kärnan

Tre vyer: **Dag / Vecka / Månad**

- Klick på tom tid (1h-slot) → hover lyser upp med `+` → öppnar "Ny bokning"-modalen med tid förifylld
- Klick på befintlig bokning → detaljpanel glider in från höger
- "Ny bokning"-knapp i toolbar → samma modal
- Dubbelbokningar tillåtna
- Live-tidslinje uppdateras var 60:e sekund
- Statusfilter + teknikerfilter i toolbar

---

## Bokningsflöde (skapa)

1. Klick på tid i kalender → modal öppnas
2. Fyll i: kund (namn + telefon krävs), bil (märke + modell krävs), tjänst, längd, status, tekniker, pris, anteckningar
3. `POST /api/bookings/create` — skapar kund (återanvänder om telefonnr finns) + bil + bokning
4. SMS-bekräftelse skickas via GHL (kräver `highlevel_contact_id` på kunden)
5. Kalender laddas om

---

## Bokningsdetaljsida (`/bookings/[id]`)

Redigera direkt på sidan — inga dolda formulär:
- **Status** — klicka på rätt statusbadge
- **Tid, längd, tjänst, tekniker, pris** — redigerbara fält
- **Kundönskemål + interna anteckningar** — tydligt separerade
- **Historik-länk** → hoppar till kundens fullständiga historik
- **Ta bort** med bekräftelsedialog

---

## Kundhistorik (`/customers/[id]`)

- Statistik: antal besök, antal klara, antal bilar, totalt spenderat
- Alla bilar kunden haft inne med regnummer
- Senaste besök
- Anteckningar om kunden (sparas direkt)
- **Bokningshistorik** — klickbar lista, varje rad → bokningssidan
- **SMS-fliken** — alla SMS med typ, tidsstämpel, meddelandetext

---

## Arbetspass-system

**Flöde:**
1. Anställd går till "Mina pass" → "Lägg in pass" → fyller i starttid/sluttid/kommentar
2. Pass skapas med `status=pending`
3. Goran ser gul banner på dashboard → godkänner ✓ eller avvisar ✗ med ett klick
4. Anställd ser sina pass med sök + statusfilter
5. Under varje pass visas kopplade bokningar (bokningar vars tid faller inom passet)

---

## Animationer & UX

- **Modaler:** scale-in från mitten med spring-känsla
- **Detaljpanel:** slide-in från höger
- **Sidnavigation:** fade-up vid sidbyte
- **Sidomenyns hover:** glider 0.5px åt höger
- **Knappar:** scale(0.97) på klick
- **Hover-slot i kalender:** fade-in, subtil bakgrund

---

## GHL webhook (`/api/webhooks/ghl`)

- Ed25519-signatur via `X-GHL-Signature` (`GHL_WEBHOOK_PUBLIC_KEY` = raw 32-byte base64)
- Idempotens: `${type}:${entityId}:${contentHash}`
- Race-safe: rad sätts `success=false` före, flippas efter — retries blockeras aldrig

---

## API-routes

| Route | Metoder | Notering |
|---|---|---|
| `/api/bookings` | GET, POST | Filter: status, worker_id, from, to |
| `/api/bookings/create` | POST | Kund+bil+bokning+SMS atomärt |
| `/api/bookings/[id]` | GET, PATCH, DELETE | Enskild bokning |
| `/api/shifts` | GET, POST | Filter: worker_id, status, from, to |
| `/api/shifts/approve` | POST | Godkänn/avvisa (admin/manager) |
| `/api/customers/[id]` | GET, PATCH | Kundprofil + historik |
| `/api/sms/send` | POST | Manuellt SMS via GHL |
| `/api/webhooks/ghl` | POST | GHL sync |
| `/api/jobs/[id]/images` | POST | Bilduppladdning |

---

## Vad som saknas / nästa steg

| Funktion | Prioritet |
|---|---|
| Auth aktiverad (proxy.ts är passthrough) | **Före produktionsbruk** |
| SMS via 46elks (byta ut GHL) | Hög |
| Auto-SMS vid bokning (kräver highlevel_contact_id) | Hög |
| Auto-SMS när bil är klar | Hög |
| Bokningslista med riktig data (`/bookings`) | Hög |
| Personal-sida med riktig data (`/workers`) | Medium |
| Drag-and-drop i kalender | Låg |
| Kundlista (`/customers`) | Medium |
| Aktivitetslogg-UI | Låg |

---

## Komma igång lokalt

```bash
npm install
# Skapa .env.local med Supabase-nycklar (se .env.example)
# Kör schema.sql + migrations i Supabase SQL editor
npm run dev
# → http://localhost:3000
```
