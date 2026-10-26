-- ============================================================
-- Contacts database - Step 43: Recipes
--
-- A family cookbook. Each recipe has a title, any number of
-- categories, how many it serves, the times, a list of ingredients,
-- the preparing and cooking steps, notes, photos and a video link.
--
-- Everyone who signs in can see everyone's recipes: that is the
-- family cookbook. Only whoever added a recipe can change or delete
-- it. Anybody can make a copy of their own to change, or choose not
-- to see one (that choice is kept with their home screen settings,
-- so it needs nothing here). A recipe can also be kept to yourself.
--
-- Recipes found on the internet wait in a "To try" pile until you
-- keep or reject them. Nobody else sees the pile.
--
-- Photos are stored as  rec/<owner's user id>/<random name>.jpg
--
-- One new table: recipes. Both backup scripts include it from
-- 26 Oct 2026, so run this before the next backup. Nothing existing
-- is changed. Safe to run more than once.
-- ============================================================


-- ---------- The recipes ----------
create table if not exists recipes (
  id          bigint generated always as identity primary key,
  created_by  uuid not null default auth.uid() references profiles on delete cascade,
  title       text not null,
  categories  text[] not null default '{}',
  serves      integer check (serves between 1 and 100),
  prep_mins   integer check (prep_mins between 0 and 10000),
  cook_mins   integer check (cook_mins between 0 and 10000),
  ingredients jsonb not null default '[]',
  prep_steps  jsonb not null default '[]',
  cook_steps  jsonb not null default '[]',
  notes       text,
  photos      jsonb not null default '[]',
  video_url   text check (video_url is null or video_url ~* '^https?://'),
  source_url  text check (source_url is null or source_url ~* '^https?://'),
  source_name text,
  to_try      boolean not null default false,
  share_all   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on column recipes.ingredients is
  'A list, in order. Each is {qty, unit, name}, or {head} for a heading '
  'such as "For the sauce". qty is text so "1/2" and "2-3" are kept as typed.';
comment on column recipes.photos is
  'A list, the cover first. Each is {path} in the photos store, or {url} '
  'for a picture on the web that came with a recipe found there.';
comment on column recipes.to_try is
  'True while it waits in the To try pile, found on the web and not yet kept.';
comment on column recipes.share_all is
  'True when it is in the family cookbook for everyone to see.';

create index if not exists recipes_created_by on recipes (created_by);

alter table recipes enable row level security;


-- ---------- Rules on the recipes ----------
drop policy if exists "manage my recipes"     on recipes;
drop policy if exists "see the family cookbook" on recipes;

create policy "manage my recipes" on recipes
  for all to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy "see the family cookbook" on recipes
  for select to authenticated
  using (share_all and not to_try);


-- ---------- Photos ----------
-- Your own recipe photos go in a folder named after you. Anyone may
-- look at a photo that belongs to a recipe in the family cookbook.
create or replace function recipe_photo_in_cookbook(p text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from recipes
                 where share_all and not to_try
                   and photos @> jsonb_build_array(jsonb_build_object('path', p)));
$$;

drop policy if exists "see recipe photos"    on storage.objects;
drop policy if exists "add recipe photos"    on storage.objects;
drop policy if exists "remove recipe photos" on storage.objects;

create policy "see recipe photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and name like 'rec/%'
         and (name like 'rec/' || auth.uid()::text || '/%'
              or recipe_photo_in_cookbook(name)));

create policy "add recipe photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos'
              and name like 'rec/' || auth.uid()::text || '/%');

create policy "remove recipe photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos'
         and name like 'rec/' || auth.uid()::text || '/%');


-- ---------- Check it took ----------
-- You should see 5 lines: 2 rules on recipes and 3 on objects
-- with "recipe photos".
select tablename as "table", policyname as "rule", cmd as "applies to"
from pg_policies
where (schemaname = 'public' and tablename = 'recipes')
   or (schemaname = 'storage' and policyname like '%recipe photos%')
order by tablename, policyname;
