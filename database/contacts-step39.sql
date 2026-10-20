-- ============================================================
-- Contacts database - Step 39: sharing your Daily Log
--
-- Until now each person's log was theirs alone. This lets you
-- share yours with someone you choose, one person at a time.
-- Only the people you choose can see it. Nobody else does.
--
-- For each person you share with, you decide:
--   * whether they can add and change days (and add photos)
--   * whether they can delete days and photos
--   * which sections they do not see (the app hides those)
--
-- They also see your own sections, fields and choice lists, so
-- your log looks the same to them as it does to you. They can
-- never change those, only fill in the days.
--
-- Nothing existing is changed or removed. Your own rules on your
-- own log stay exactly as they were; these only add to them.
-- Safe to run more than once.
-- ============================================================


-- ---------- Who you have shared your log with ----------
create table if not exists log_shares (
  owner_id   uuid    not null references profiles on delete cascade,
  viewer_id  uuid    not null references profiles on delete cascade,
  can_edit   boolean not null default true,
  can_delete boolean not null default false,
  hidden     jsonb   not null default '[]'::jsonb,
  created_at timestamptz default now(),
  primary key (owner_id, viewer_id),
  check (owner_id <> viewer_id)
);

comment on column log_shares.hidden is
  'Sections of the log the other person is not shown, as a list of '
  'section ids, e.g. ["bp","medication"]. Hidden by the app.';

alter table log_shares enable row level security;

drop policy if exists "manage my log shares" on log_shares;
create policy "manage my log shares" on log_shares
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "log shares naming me" on log_shares;
create policy "log shares naming me" on log_shares
  for select to authenticated
  using (viewer_id = auth.uid());


-- ---------- The one question every rule below asks ----------
-- "Has the owner of this log shared it with me, and may I do this?"
-- what is 'see', 'edit' or 'delete'. The owner is passed as text so
-- the photo rules can hand over a folder name without converting it.
create or replace function log_shared_with_me(owner text, what text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from log_shares
    where owner_id::text = owner
      and viewer_id = auth.uid()
      and (what = 'see'
           or (what = 'edit'   and can_edit)
           or (what = 'delete' and can_delete))
  );
$$;


-- ---------- The days themselves ----------
drop policy if exists "see logs shared with me"    on log_days;
drop policy if exists "add to logs shared with me" on log_days;
drop policy if exists "edit logs shared with me"   on log_days;
drop policy if exists "delete from logs shared with me" on log_days;

create policy "see logs shared with me" on log_days
  for select to authenticated
  using (log_shared_with_me(created_by::text, 'see'));

create policy "add to logs shared with me" on log_days
  for insert to authenticated
  with check (log_shared_with_me(created_by::text, 'edit'));

create policy "edit logs shared with me" on log_days
  for update to authenticated
  using (log_shared_with_me(created_by::text, 'edit'))
  with check (log_shared_with_me(created_by::text, 'edit'));

create policy "delete from logs shared with me" on log_days
  for delete to authenticated
  using (log_shared_with_me(created_by::text, 'delete'));


-- ---------- Their sections, fields and choices: look, don't touch ----------
drop policy if exists "see shared log options" on log_options;
create policy "see shared log options" on log_options
  for select to authenticated
  using (log_shared_with_me(created_by::text, 'see'));

drop policy if exists "see shared log sections" on log_cats;
create policy "see shared log sections" on log_cats
  for select to authenticated
  using (log_shared_with_me(created_by::text, 'see'));

drop policy if exists "see shared log fields" on log_fields;
create policy "see shared log fields" on log_fields
  for select to authenticated
  using (log_shared_with_me(created_by::text, 'see'));


-- ---------- The photos ----------
-- Log photos are stored as  log/<owner's user id>/<random name>.jpg
-- (step 30), so the second part of the name says whose log it is.
drop policy if exists "see shared log photos"    on storage.objects;
drop policy if exists "add shared log photos"    on storage.objects;
drop policy if exists "remove shared log photos" on storage.objects;

create policy "see shared log photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and name like 'log/%'
         and log_shared_with_me(split_part(name, '/', 2), 'see'));

create policy "add shared log photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and name like 'log/%'
              and log_shared_with_me(split_part(name, '/', 2), 'edit'));

create policy "remove shared log photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and name like 'log/%'
         and log_shared_with_me(split_part(name, '/', 2), 'delete'));


-- ---------- Check it took ----------
-- You should see 2 rules on log_shares, 4 new "shared" rules on
-- log_days alongside your own 4, 1 each on log_options, log_cats and
-- log_fields, and 3 on storage.objects with "shared log photos".
select tablename as "table", policyname as "rule", cmd as "applies to"
from pg_policies
where (schemaname = 'public'
       and tablename in ('log_shares','log_days','log_options','log_cats','log_fields'))
   or (schemaname = 'storage' and policyname like '%shared log photos%')
order by tablename, policyname;
