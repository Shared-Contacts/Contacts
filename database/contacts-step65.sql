-- ============================================================
-- Contacts database - Step 65: Timeline
--
-- Your life as coloured lines, from the day you were born to today
-- (ML301).
--
--   timeline       one row for each thing on it:
--                    kind 'place'    where you lived: its country, and a
--                                    town or area as its title, from the
--                                    day you moved there. It ends where
--                                    the next one starts, so it has no
--                                    end date of its own.
--                    kind 'holiday'  a holiday: where (the title), its
--                                    country, from and to.
--                    any other kind  one of your own kinds (Work, Pets
--                                    and so on, named in timeline_keys):
--                                    a title, from and to. No end date
--                                    means it is still going; one_day
--                                    means it was on the one day.
--                  A date can be a whole year, a month or a day. The
--                  date kept is the first day of it, and start_prec and
--                  end_prec say which it is ('year', 'month' or 'day').
--   timeline_keys  one row each: your kinds with their colours and
--                  order, the colour of each country, and the day you
--                  were born, for when it is not on your own contact
--                  card.
--
-- Yours alone: nobody else can see or change your Timeline.
--
-- Two new tables: timeline and timeline_keys. Both backup scripts have
-- been updated to take them (same session, 17 Nov 2026).
-- Safe to run more than once.
-- ============================================================


-- ---------- What is on it ----------
create table if not exists timeline (
  id          bigint generated always as identity primary key,
  created_by  uuid not null default auth.uid() references profiles on delete cascade,
  kind        text not null check (char_length(kind) between 1 and 40),
  title       text not null default '',
  country     text,
  start_on    date not null,
  start_prec  text not null default 'day' check (start_prec in ('year','month','day')),
  end_on      date,
  end_prec    text not null default 'day' check (end_prec in ('year','month','day')),
  one_day     boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists timeline_owner_idx on timeline (created_by, start_on);

comment on table timeline is
  'Timeline (step 65): where you lived, holidays, and your own kinds of things. Seen and changed only by the owner.';

-- ---------- Your colours and kinds ----------
create table if not exists timeline_keys (
  created_by  uuid primary key default auth.uid() references profiles on delete cascade,
  born_on     date,
  kinds       jsonb not null default '[]',   -- [{k, name, colour, dot}], in the order shown
  countries   jsonb not null default '[]',   -- [{name, colour}]
  updated_at  timestamptz not null default now()
);

comment on table timeline_keys is
  'Timeline (step 65): one row each, your kinds, country colours and birth date. Seen and changed only by the owner.';


-- ---------- Who may see and change them: only you ----------
alter table timeline      enable row level security;
alter table timeline_keys enable row level security;

drop policy if exists "see own timeline"         on timeline;
drop policy if exists "add to own timeline"      on timeline;
drop policy if exists "change own timeline"      on timeline;
drop policy if exists "remove from own timeline" on timeline;

create policy "see own timeline" on timeline for select to authenticated
  using (created_by = auth.uid());
create policy "add to own timeline" on timeline for insert to authenticated
  with check (created_by = auth.uid());
create policy "change own timeline" on timeline for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "remove from own timeline" on timeline for delete to authenticated
  using (created_by = auth.uid());

drop policy if exists "see own timeline key"    on timeline_keys;
drop policy if exists "add own timeline key"    on timeline_keys;
drop policy if exists "change own timeline key" on timeline_keys;
drop policy if exists "remove own timeline key" on timeline_keys;

create policy "see own timeline key" on timeline_keys for select to authenticated
  using (created_by = auth.uid());
create policy "add own timeline key" on timeline_keys for insert to authenticated
  with check (created_by = auth.uid());
create policy "change own timeline key" on timeline_keys for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "remove own timeline key" on timeline_keys for delete to authenticated
  using (created_by = auth.uid());



-- ---------- Check it took ----------
-- You should see 10 lines: 4 rules on timeline, 4 on timeline_keys,
-- and the 2 new tables.
select 'rule on ' || tablename::text as "what", policyname::text as "name", cmd::text as "kind"
from pg_policies
where schemaname = 'public' and tablename in ('timeline','timeline_keys')
union all
select 'table', table_name::text, ''
from information_schema.tables
where table_schema = 'public' and table_name in ('timeline','timeline_keys')
order by 1, 2;
