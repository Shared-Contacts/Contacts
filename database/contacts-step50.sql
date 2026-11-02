-- ============================================================
-- Contacts database - Step 50: My Stuff
--
-- The things you own and the papers that go with them: vehicles,
-- items, property, documents and insurance policies, each with its
-- own boxes, photos, PDFs and (for the first three) a record of
-- every service.
--
--   stuff          one row per thing. Its own boxes (make, model,
--                  registration, MOT due and so on) are kept in
--                  details, so each type can have different ones.
--                  photos and files are lists of {path} and
--                  {path, name} in the photos store. reminders says
--                  which Diary to-do belongs to each due date.
--   stuff_service  the service record: date, where, price, parts
--                  and work done, next due date.
--
-- Yours only, unless you tick people under "Share with": they can
-- look, but only you can change it or its service record. No
-- passwords are kept here, only where the login is kept.
--
-- Files are stored as  stf/<owner's user id>/<random name>.jpg|.pdf
--
-- The photos store's limit per file goes up from 5 MB to 20 MB,
-- so a scanned document fits.
--
-- Two new tables: stuff and stuff_service. Both backup scripts
-- have been updated to take them (same session, 2 Nov 2026).
-- Safe to run more than once.
-- ============================================================


-- ---------- The things ----------
create table if not exists stuff (
  id          bigint generated always as identity primary key,
  created_by  uuid not null default auth.uid() references profiles on delete cascade,
  kind        text not null check (kind in ('vehicle','item','property','document','policy')),
  name        text not null,
  details     jsonb not null default '{}',
  notes       text,
  login_where text,                        -- where the login is kept, never the password
  photos      jsonb not null default '[]', -- [{path}]
  files       jsonb not null default '[]', -- [{path, name}], PDFs
  shared_with uuid[] not null default '{}',
  reminders   jsonb not null default '{}', -- {due date's name: Diary item id}
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table stuff is
  'Things you own and their papers. Seen by the owner and anyone in shared_with; changed only by the owner.';

-- ---------- Their service records ----------
create table if not exists stuff_service (
  id          bigint generated always as identity primary key,
  stuff_id    bigint not null references stuff on delete cascade,
  created_by  uuid not null default auth.uid() references profiles on delete cascade,
  done_on     date,
  where_done  text,
  price       numeric(12,2),
  work        text,                        -- parts and work done
  next_due    date,
  created_at  timestamptz not null default now()
);

create index if not exists stuff_service_stuff_idx on stuff_service (stuff_id);


-- ---------- Who may see and change them ----------
-- The rules for the service record ask these rather than reading
-- stuff themselves.
create or replace function stuff_seen_by_me(sid bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from stuff s where s.id = sid
                 and (s.created_by = auth.uid() or auth.uid() = any(s.shared_with)));
$$;

create or replace function stuff_is_mine(sid bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from stuff s where s.id = sid and s.created_by = auth.uid());
$$;

alter table stuff         enable row level security;
alter table stuff_service enable row level security;

drop policy if exists "see stuff"    on stuff;
drop policy if exists "add stuff"    on stuff;
drop policy if exists "change stuff" on stuff;
drop policy if exists "remove stuff" on stuff;

create policy "see stuff" on stuff for select to authenticated
  using (created_by = auth.uid() or auth.uid() = any(shared_with));
create policy "add stuff" on stuff for insert to authenticated
  with check (created_by = auth.uid());
create policy "change stuff" on stuff for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "remove stuff" on stuff for delete to authenticated
  using (created_by = auth.uid());

drop policy if exists "see services"    on stuff_service;
drop policy if exists "add services"    on stuff_service;
drop policy if exists "change services" on stuff_service;
drop policy if exists "remove services" on stuff_service;

create policy "see services" on stuff_service for select to authenticated
  using (stuff_seen_by_me(stuff_id));
create policy "add services" on stuff_service for insert to authenticated
  with check (stuff_is_mine(stuff_id) and created_by = auth.uid());
create policy "change services" on stuff_service for update to authenticated
  using (stuff_is_mine(stuff_id)) with check (stuff_is_mine(stuff_id));
create policy "remove services" on stuff_service for delete to authenticated
  using (stuff_is_mine(stuff_id));


-- ---------- Photos and PDFs ----------
-- A file can be seen by whoever can see the thing it is on.
create or replace function stuff_file_seen_by_me(p text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from stuff s
    where (s.photos @> jsonb_build_array(jsonb_build_object('path', p))
           or exists (select 1 from jsonb_array_elements(s.files) f where f->>'path' = p))
      and (s.created_by = auth.uid() or auth.uid() = any(s.shared_with)));
$$;

drop policy if exists "see stuff files"    on storage.objects;
drop policy if exists "add stuff files"    on storage.objects;
drop policy if exists "remove stuff files" on storage.objects;

create policy "see stuff files" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and name like 'stf/%'
         and (name like 'stf/' || auth.uid()::text || '/%'
              or stuff_file_seen_by_me(name)));

create policy "add stuff files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos'
              and name like 'stf/' || auth.uid()::text || '/%');

create policy "remove stuff files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos'
         and name like 'stf/' || auth.uid()::text || '/%');

-- Room for a scanned document: 20 MB a file (it was 5 MB).
update storage.buckets set file_size_limit = 20971520 where id = 'photos';


-- ---------- Check it took ----------
-- You should see 14 lines: the photos store at 20971520, 4 rules on stuff, 4 on stuff_service,
-- 3 storage rules with "stuff files",
-- and the 2 new tables.
select 'rule on ' || tablename::text as "what", policyname::text as "name", cmd::text as "kind"
from pg_policies
where schemaname = 'public' and tablename in ('stuff','stuff_service')
union all
select 'storage rule', policyname::text, cmd::text
from pg_policies
where schemaname = 'storage' and policyname like '%stuff files%'
union all
select 'photos store limit', file_size_limit::text, ''
from storage.buckets where id = 'photos'
union all
select 'table', table_name::text, ''
from information_schema.tables
where table_schema = 'public' and table_name in ('stuff','stuff_service')
order by 1, 2;
