-- ============================================================
-- Contacts database - Step 42: URL Links
--
-- A library of web links, like the bookmarks in Chrome but kept in
-- the app. Each link has a title, the address, an optional
-- description, a level (Everyday, Favourites and so on) and any
-- number of subjects (Weather, New Zealand, News ...). The app counts
-- how often you open each one, so the most used can come first.
--
-- A link is yours alone unless you share it: with everyone, or with
-- the people you tick. Only you can change or remove your own links.
-- Somebody you share with can open it, keep a copy of their own, or
-- stop seeing it.
--
-- Your levels and your list of subjects are kept with your other
-- home screen choices, so they need nothing here.
--
-- Two new tables: url_links and url_link_shares. Both backup
-- scripts include them from 26 Oct 2026, so run this before the
-- next backup. Nothing existing is changed. Safe to run more than once.
-- ============================================================


-- ---------- The links ----------
create table if not exists url_links (
  id          bigint generated always as identity primary key,
  created_by  uuid not null default auth.uid() references profiles on delete cascade,
  url         text not null check (url ~* '^https?://'),
  title       text not null,
  description text,
  level       text,
  subjects    text[] not null default '{}',
  share_all   boolean not null default false,
  opens       integer not null default 0,
  last_opened timestamptz,
  created_at  timestamptz not null default now()
);

comment on column url_links.level is
  'Which of the owner''s levels it sits on, e.g. everyday. The names '
  'are kept with the owner''s home screen choices, so they can be renamed.';
comment on column url_links.share_all is
  'True when everyone who signs in to the app can see it.';

create index if not exists url_links_created_by on url_links (created_by);


-- ---------- Who each link is shared with ----------
create table if not exists url_link_shares (
  link_id    bigint not null references url_links on delete cascade,
  viewer_id  uuid   not null references profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (link_id, viewer_id)
);

create index if not exists url_link_shares_viewer on url_link_shares (viewer_id);

alter table url_links       enable row level security;
alter table url_link_shares enable row level security;


-- ---------- The two questions the rules ask ----------
-- "Is this link mine?" and "Has it been shared with me by name?"
-- Asked through these rather than by looking at the other table
-- directly, so the two tables' rules never go round in a circle.
create or replace function url_link_is_mine(l bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from url_links where id = l and created_by = auth.uid());
$$;

create or replace function url_link_shared_with_me(l bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from url_link_shares where link_id = l and viewer_id = auth.uid());
$$;


-- ---------- Rules on the links ----------
drop policy if exists "manage my links"          on url_links;
drop policy if exists "see links shared with me" on url_links;

create policy "manage my links" on url_links
  for all to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy "see links shared with me" on url_links
  for select to authenticated
  using (share_all or url_link_shared_with_me(id));


-- ---------- Rules on who they are shared with ----------
drop policy if exists "share my links"          on url_link_shares;
drop policy if exists "link shares naming me"   on url_link_shares;
drop policy if exists "stop seeing a link"      on url_link_shares;

create policy "share my links" on url_link_shares
  for all to authenticated
  using (url_link_is_mine(link_id)) with check (url_link_is_mine(link_id));

create policy "link shares naming me" on url_link_shares
  for select to authenticated
  using (viewer_id = auth.uid());

create policy "stop seeing a link" on url_link_shares
  for delete to authenticated
  using (viewer_id = auth.uid());


-- ---------- Check it took ----------
-- You should see 5 lines: 2 rules on url_links and 3 on url_link_shares.
select tablename as "table", policyname as "rule", cmd as "applies to"
from pg_policies
where schemaname = 'public' and tablename in ('url_links','url_link_shares')
order by tablename, policyname;
