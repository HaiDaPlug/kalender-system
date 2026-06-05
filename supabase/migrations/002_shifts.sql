-- ============================================================
-- Migration 002 — arbetspass (shifts)
-- Kör denna i Supabase SQL editor efter 001_additive.sql.
-- Idempotent — säker att köra om.
-- ============================================================

-- ── Shifts — arbetspass ───────────────────────────────────────────────────
create table if not exists shifts (
  id           uuid primary key default uuid_generate_v4(),
  worker_id    uuid not null references profiles(id) on delete cascade,
  -- Status: pending = väntar på Görans godkännande, approved = aktivt, rejected = avvisat
  status       text not null default 'pending'
                 check (status in ('pending', 'approved', 'rejected')),
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  notes        text,
  -- Vem godkände/avvisade och när
  reviewed_by  uuid references profiles(id),
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint shifts_end_after_start check (ends_at > starts_at)
);

create index if not exists shifts_worker_idx    on shifts(worker_id);
create index if not exists shifts_starts_at_idx on shifts(starts_at);
create index if not exists shifts_status_idx    on shifts(status);

alter table shifts enable row level security;

-- Alla inloggade kan läsa alla pass (så Göran ser allas pass i kalendern)
drop policy if exists "shifts_select" on shifts;
create policy "shifts_select" on shifts for select
  using (auth.uid() is not null);

-- Anställd kan bara skapa pass för sig själv
drop policy if exists "shifts_insert" on shifts;
create policy "shifts_insert" on shifts for insert
  with check (auth.uid() = worker_id);

-- Admin/manager kan uppdatera alla pass (godkänna/avvisa)
-- Anställd kan bara uppdatera sina egna pass om de är pending
drop policy if exists "shifts_update" on shifts;
create policy "shifts_update" on shifts for update
  using (
    auth.uid() = worker_id
    or exists (
      select 1 from profiles
      where id = auth.uid() and role in ('admin', 'manager')
    )
  );

-- Anställd kan ta bort sina egna pendande pass; admin kan ta bort alla
drop policy if exists "shifts_delete" on shifts;
create policy "shifts_delete" on shifts for delete
  using (
    (auth.uid() = worker_id and status = 'pending')
    or exists (
      select 1 from profiles
      where id = auth.uid() and role in ('admin', 'manager')
    )
  );
