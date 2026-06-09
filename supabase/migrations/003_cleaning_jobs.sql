-- Cleaning jobs: kopplar en bokning till ett tvättjobb med status och bilder
create table if not exists cleaning_jobs (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references bookings(id) on delete cascade,
  worker_id    uuid not null references profiles(id),
  status       text not null default 'not_started'
               check (status in ('not_started','in_progress','completed','needs_review')),
  started_at   timestamptz,
  completed_at timestamptz,
  worker_notes text,
  admin_notes  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (booking_id)
);

alter table cleaning_jobs enable row level security;

drop policy if exists "jobs_select" on cleaning_jobs;
create policy "jobs_select" on cleaning_jobs for select
  using (
    auth.uid() = worker_id
    or exists (select 1 from profiles where id = auth.uid() and role in ('admin','manager'))
  );

drop policy if exists "jobs_insert" on cleaning_jobs;
create policy "jobs_insert" on cleaning_jobs for insert
  with check (auth.uid() = worker_id);

drop policy if exists "jobs_update" on cleaning_jobs;
create policy "jobs_update" on cleaning_jobs for update
  using (
    auth.uid() = worker_id
    or exists (select 1 from profiles where id = auth.uid() and role in ('admin','manager'))
  );

-- Bilder kopplade till ett tvättjobb
create table if not exists job_images (
  id               uuid primary key default gen_random_uuid(),
  job_id           uuid not null references cleaning_jobs(id) on delete cascade,
  storage_path     text not null,
  public_url       text not null,
  type             text not null check (type in ('before','after')),
  uploaded_by      uuid not null references profiles(id),
  file_size_bytes  bigint,
  created_at       timestamptz not null default now()
);

alter table job_images enable row level security;

drop policy if exists "images_select" on job_images;
create policy "images_select" on job_images for select
  using (
    exists (
      select 1 from cleaning_jobs
      where id = job_id and worker_id = auth.uid()
    )
    or exists (select 1 from profiles where id = auth.uid() and role in ('admin','manager'))
  );

drop policy if exists "images_insert_auth" on job_images;
drop policy if exists "images_insert_own_job" on job_images;

create policy "images_insert_own_job" on job_images for insert
  with check (
    auth.uid() = uploaded_by
    and (
      exists (
        select 1 from cleaning_jobs
        where id = job_id and worker_id = auth.uid()
      )
      or exists (
        select 1 from profiles
        where id = auth.uid() and role in ('admin','manager')
      )
    )
  );

-- Storage buckets (körs manuellt i Supabase dashboard om de inte finns)
-- insert into storage.buckets (id, name, public) values ('car-before-images', 'car-before-images', true) on conflict do nothing;
-- insert into storage.buckets (id, name, public) values ('car-after-images',  'car-after-images',  true) on conflict do nothing;

-- updated_at trigger för cleaning_jobs
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists cleaning_jobs_updated_at on cleaning_jobs;
create trigger cleaning_jobs_updated_at
  before update on cleaning_jobs
  for each row execute function set_updated_at();
