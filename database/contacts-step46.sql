-- ============================================================
-- Contacts database - Step 46: Photos on appointments, to-dos
-- and regular jobs
--
-- Each appointment, to-do and regular job can now carry photos,
-- listed the same way as recipe photos: [{path}], in order.
--
-- Photos are stored as  dia/<owner's user id>/<random name>.jpg
--
-- You can see your own photos, and the photos on any appointment
-- or to-do that is yours or has been shared with you (Who else to
-- remind). Regular jobs are private, so their photos are too.
-- You can only add or remove photos in your own folder.
--
-- Two new columns: items.photos and routines.photos. Both backup
-- scripts already take every column of items and routines, so
-- nothing changes there. Safe to run more than once.
-- ============================================================


-- ---------- The new columns ----------
alter table items    add column if not exists photos jsonb not null default '[]';
alter table routines add column if not exists photos jsonb not null default '[]';

comment on column items.photos is
  'A list of {path} in the photos store, in the order they were added.';
comment on column routines.photos is
  'A list of {path} in the photos store, in the order they were added.';


-- ---------- Photos ----------
-- A photo belongs to an appointment or to-do that is yours or has
-- been shared with you.
create or replace function diary_photo_seen_by_me(p text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from items i
    where i.photos @> jsonb_build_array(jsonb_build_object('path', p))
      and (i.created_by = auth.uid()
           or exists (select 1 from item_shares s
                      where s.item_id = i.id and s.user_id = auth.uid())));
$$;

drop policy if exists "see diary photos"    on storage.objects;
drop policy if exists "add diary photos"    on storage.objects;
drop policy if exists "remove diary photos" on storage.objects;

create policy "see diary photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and name like 'dia/%'
         and (name like 'dia/' || auth.uid()::text || '/%'
              or diary_photo_seen_by_me(name)));

create policy "add diary photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos'
              and name like 'dia/' || auth.uid()::text || '/%');

create policy "remove diary photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos'
         and name like 'dia/' || auth.uid()::text || '/%');


-- ---------- Check it took ----------
-- You should see 5 lines: items photos and routines photos, then
-- 3 rules with "diary photos".
select table_name::text as "what", column_name::text as "name", data_type::text as "kind"
from information_schema.columns
where table_schema = 'public' and column_name = 'photos'
  and table_name in ('items','routines')
union all
select 'storage rule', policyname::text, cmd::text
from pg_policies
where schemaname = 'storage' and policyname like '%diary photos%'
order by 1, 2;
