-- ============================================================
-- Contacts database - Step 29: your own sections in the Daily Log
--
-- Lets each person invent their own headings and the things to
-- fill in under them — Sewing, Garden, Grandchildren, whatever
-- suits. Entirely private, like the rest of the log: Sandra's
-- sections are hers and yours are yours.
--
-- Safe to run more than once. Nothing existing is touched.
-- ============================================================

-- ---------- A heading you made up ----------
create table if not exists log_cats (
  id         bigint generated always as identity primary key,
  created_by uuid not null references profiles on delete cascade,
  label      text not null,
  sort_order int  not null default 100,
  created_at timestamptz default now()
);

-- ---------- Something to fill in under that heading ----------
create table if not exists log_fields (
  id         bigint generated always as identity primary key,
  created_by uuid   not null references profiles on delete cascade,
  cat_id     bigint not null references log_cats on delete cascade,
  label      text   not null,
  kind       text   not null default 'number'
             check (kind in ('number','text','note','yesno','choice')),
  unit       text,                                  -- litres, hours, miles
  choices    jsonb  not null default '[]'::jsonb,   -- for the pick-one kind
  carry      boolean not null default false,        -- bring yesterday's answer forward
  sort_order int    not null default 100
);

create index if not exists log_fields_cat_idx on log_fields (cat_id);

-- ---------- Where the answers live ----------
-- One pocket per day, keyed by the field it belongs to.
alter table log_days
  add column if not exists extra jsonb not null default '{}'::jsonb;

comment on column log_days.extra is
  'Answers to your own fields, as {"<log_fields.id>": value}.';


-- ---------- Private to whoever made them ----------
alter table log_cats   enable row level security;
alter table log_fields enable row level security;

drop policy if exists "my log sections" on log_cats;
create policy "my log sections" on log_cats
  for all to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "my log fields" on log_fields;
create policy "my log fields" on log_fields
  for all to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());


-- ---------- Check ----------
select 'log_cats'   as "table", count(*) as rows from log_cats
union all
select 'log_fields', count(*) from log_fields;
