-- ============================================================
-- Contacts database - Step 16: log options, preferences, sharing a location
-- Paste into the Supabase SQL Editor and Run.
-- ============================================================

-- ---------- Ointment goes, along with anything recorded in it ----------
alter table log_days drop column if exists ointment;


-- ---------- Editable choice lists for the log ----------
create table log_options (
  id         bigint generated always as identity primary key,
  created_by uuid not null references profiles on delete cascade,
  kind       text not null check (kind in ('medication','who_aboard','bike_ride','alcohol')),
  name       text not null,
  sort_order int not null default 100,
  unique (created_by, kind, name)
);

alter table log_options enable row level security;
create policy "see my log options" on log_options
  for select to authenticated using (created_by = auth.uid());
create policy "manage my log options" on log_options
  for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

-- Start the lists off from what is already in twelve years of entries
insert into log_options (created_by, kind, name, sort_order)
select distinct created_by, 'medication', medication, 10
from log_days where medication is not null and btrim(medication) <> ''
on conflict do nothing;

insert into log_options (created_by, kind, name, sort_order)
select distinct created_by, 'who_aboard', who_aboard, 10
from log_days where who_aboard is not null and btrim(who_aboard) <> ''
on conflict do nothing;

insert into log_options (created_by, kind, name, sort_order)
select distinct created_by, 'bike_ride', bike_ride, 10
from log_days where bike_ride is not null and btrim(bike_ride) <> ''
on conflict do nothing;

insert into log_options (created_by, kind, name, sort_order)
select distinct created_by, 'alcohol', alcohol, 10
from log_days where alcohol is not null and btrim(alcohol) <> ''
on conflict do nothing;


-- ---------- Which parts of the log you want, and in what order ----------
alter table profiles
  add column log_sections jsonb;


-- ---------- Sharing where you are, on purpose and briefly ----------
create table live_locations (
  user_id    uuid primary key references profiles on delete cascade,
  lat        numeric not null,
  lng        numeric not null,
  accuracy   numeric,
  label      text,
  updated_at timestamptz not null default now(),
  until      timestamptz not null
);

alter table live_locations enable row level security;

-- You may always see and change your own.
create policy "my location" on live_locations
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Others see it only while it is still being shared.
create policy "locations shared with me" on live_locations
  for select to authenticated
  using (until > now());
