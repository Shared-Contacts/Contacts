-- ============================================================
-- Contacts database - Step 63: TV/Movies
--
-- Films and TV series: the ones watched, the ones being watched and
-- the ones still to watch. Like Books (step 61).
--
--   shows         one row per film or series: title, film or series,
--                 year, director, running time, seasons, genre,
--                 actors, synopsis, channel or service; watched /
--                 watching / want to watch, your stars and notes,
--                 recommended by; how far into a series you are
--                 (season and episode); each time you watched it
--                 (viewings, as {on, where, how, with, cost}); your
--                 own copy (DVD, Blu-ray and so on) with its barcode,
--                 price, where it was bought and who it is lent to;
--                 links to reviews elsewhere ({url, quote}) and
--                 photos ({path}, the poster first). Recommended by,
--                 bought from and lent to can each be a contact: the
--                 name is kept as well, for someone who cannot see
--                 that contact. tvmaze_id and wikidata_id say where
--                 the details were found, so a series can fetch its
--                 list of episodes again.
--   show_reviews  everyone else's stars and a few words: one each,
--                 from the people a film or series is shared with.
--
-- Yours only, unless you tick people under "Share with": they can
-- see it and add their own review, but only you can change it.
--
-- Photos are stored as  tv/<owner's user id>/<random name>.jpg
--
-- Two new tables: shows and show_reviews. Both backup scripts have
-- been updated to take them (same session, 16 Nov 2026).
-- Safe to run more than once.
-- ============================================================


-- ---------- The films and series ----------
create table if not exists shows (
  id                bigint generated always as identity primary key,
  created_by        uuid not null default auth.uid() references profiles on delete cascade,
  title             text not null,
  kind              text not null default 'film' check (kind in ('film','series')),
  year              smallint,
  director          text,
  running_mins      smallint,                 -- a film's length, or an episode's
  seasons           smallint,
  genre             text,
  actors            text,
  synopsis          text,
  channel           text,                     -- BBC One, Netflix, at the cinema
  tvmaze_id         integer,
  wikidata_id       text,
  status            text not null default 'watched' check (status in ('watched','watching','want')),
  stars             smallint check (stars between 1 and 5),
  notes             text,
  recommended_by    text,
  recommended_by_id bigint,                   -- a contact, when it is one
  at_season         smallint,                 -- how far into a series
  at_episode        smallint,
  viewings          jsonb not null default '[]',   -- [{on, where, how, with, cost}]
  copy              text check (copy in ('dvd','bluray','uhd','digital','vhs','other')),
  barcode           text,
  price             numeric(12,2),
  bought_from       text,
  bought_from_id    bigint,
  lent_to           text,
  lent_to_id        bigint,
  lent_on           date,
  links             jsonb not null default '[]',   -- [{url, quote}]
  photos            jsonb not null default '[]',   -- [{path}], the poster first
  shared_with       uuid[] not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists shows_owner_idx on shows (created_by);

comment on table shows is
  'TV/Movies. Seen by the owner and anyone in shared_with; changed only by the owner.';

-- ---------- Everyone else's say ----------
create table if not exists show_reviews (
  id          bigint generated always as identity primary key,
  show_id     bigint not null references shows on delete cascade,
  user_id     uuid not null default auth.uid() references profiles on delete cascade,
  stars       smallint check (stars between 1 and 5),
  words       text,
  updated_at  timestamptz not null default now(),
  unique (show_id, user_id)
);

comment on table show_reviews is
  'One review each a film or series, by the people it is shared with. Each changes only their own.';


-- ---------- Who may see and change them ----------
-- The rules for reviews ask this rather than reading shows themselves.
create or replace function show_seen_by_me(sid bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from shows s where s.id = sid
                 and (s.created_by = auth.uid() or auth.uid() = any(s.shared_with)));
$$;

alter table shows        enable row level security;
alter table show_reviews enable row level security;

drop policy if exists "see shows"    on shows;
drop policy if exists "add shows"    on shows;
drop policy if exists "change shows" on shows;
drop policy if exists "remove shows" on shows;

create policy "see shows" on shows for select to authenticated
  using (created_by = auth.uid() or auth.uid() = any(shared_with));
create policy "add shows" on shows for insert to authenticated
  with check (created_by = auth.uid());
create policy "change shows" on shows for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "remove shows" on shows for delete to authenticated
  using (created_by = auth.uid());

drop policy if exists "see show reviews"    on show_reviews;
drop policy if exists "add show reviews"    on show_reviews;
drop policy if exists "change show reviews" on show_reviews;
drop policy if exists "remove show reviews" on show_reviews;

create policy "see show reviews" on show_reviews for select to authenticated
  using (show_seen_by_me(show_id));
create policy "add show reviews" on show_reviews for insert to authenticated
  with check (user_id = auth.uid() and show_seen_by_me(show_id));
create policy "change show reviews" on show_reviews for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and show_seen_by_me(show_id));
create policy "remove show reviews" on show_reviews for delete to authenticated
  using (user_id = auth.uid());


-- ---------- Photos ----------
-- A photo can be seen by whoever can see the film or series it is on.
create or replace function show_file_seen_by_me(p text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from shows s
    where s.photos @> jsonb_build_array(jsonb_build_object('path', p))
      and (s.created_by = auth.uid() or auth.uid() = any(s.shared_with)));
$$;

drop policy if exists "see show photos"    on storage.objects;
drop policy if exists "add show photos"    on storage.objects;
drop policy if exists "remove show photos" on storage.objects;

create policy "see show photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and name like 'tv/%'
         and (name like 'tv/' || auth.uid()::text || '/%'
              or show_file_seen_by_me(name)));

create policy "add show photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos'
              and name like 'tv/' || auth.uid()::text || '/%');

create policy "remove show photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos'
         and name like 'tv/' || auth.uid()::text || '/%');


-- ---------- Check it took ----------
-- You should see 13 lines: 4 rules on shows, 4 on show_reviews,
-- 3 storage rules with "show photos", and the 2 new tables.
select 'rule on ' || tablename::text as "what", policyname::text as "name", cmd::text as "kind"
from pg_policies
where schemaname = 'public' and tablename in ('shows','show_reviews')
union all
select 'storage rule', policyname::text, cmd::text
from pg_policies
where schemaname = 'storage' and policyname like '%show photos%'
union all
select 'table', table_name::text, ''
from information_schema.tables
where table_schema = 'public' and table_name in ('shows','show_reviews')
order by 1, 2;
