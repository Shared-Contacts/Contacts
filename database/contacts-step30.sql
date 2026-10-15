-- ============================================================
-- Contacts database - Step 30: photos on the Daily Log
--
-- Pictures belong to the day they were taken, and are as private
-- as the rest of your log. They live in the same photos bucket
-- the contacts use, but under a folder of your own, so the rules
-- can tell at a glance that a picture is yours.
--
-- Safe to run more than once.
-- ============================================================

alter table log_days
  add column if not exists photos jsonb not null default '[]'::jsonb;

comment on column log_days.photos is
  'Pictures for the day, as [{path, cap}] in the order shown. '
  'The first one is the big one at the top of Where.';


-- ---------- Only you can see, add or remove your own ----------
-- Every file is stored as  log/<your user id>/<random name>.jpg
-- The rules below simply check that folder name against who is asking.

drop policy if exists "see my log photos"    on storage.objects;
drop policy if exists "add my log photos"    on storage.objects;
drop policy if exists "remove my log photos" on storage.objects;

create policy "see my log photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos'
         and name like 'log/' || auth.uid()::text || '/%');

create policy "add my log photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos'
              and name like 'log/' || auth.uid()::text || '/%');

create policy "remove my log photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos'
         and name like 'log/' || auth.uid()::text || '/%');


-- ---------- Check ----------
-- The three rules above should be listed, each mentioning log/.
select policyname as "rule", cmd as "applies to"
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname like '%log photos%'
order by policyname;
