-- ============================================================
-- Contacts database - Step 13: a standing list of regular jobs
-- Paste into the Supabase SQL Editor and Run.
-- ============================================================

-- Unlike a diary entry, these are never finished with. Ticking one
-- moves it down the list; unticking brings it back to the top.
create table routines (
  id         bigint generated always as identity primary key,
  created_by uuid not null references profiles on delete cascade,
  heading    text,                      -- optional grouping, e.g. Boat, Admin
  title      text not null,
  done       boolean not null default false,
  sort_order int not null default 100,
  done_at    timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index routines_owner_idx on routines (created_by, sort_order);

create trigger routines_touch
  before update on routines
  for each row execute function touch_updated_at();

alter table routines enable row level security;

create policy "see my routines" on routines
  for select to authenticated using (created_by = auth.uid());
create policy "add my routines" on routines
  for insert to authenticated with check (created_by = auth.uid());
create policy "edit my routines" on routines
  for update to authenticated using (created_by = auth.uid());
create policy "delete my routines" on routines
  for delete to authenticated using (created_by = auth.uid());
