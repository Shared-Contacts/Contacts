-- ============================================================
-- Contacts database - Step 47: Photos on Wishlist ideas and
-- shopping items
--
-- Each Wishlist idea and each shopping item can now carry photos
-- (a screenshot, say, or the packet you are after), listed the
-- same way as the other photos: [{path}], in order.
--
-- Photos are stored as  wsh/<owner's user id>/<random name>.jpg
--                  and  shp/<owner's user id>/<random name>.jpg
--
-- Everybody can see every Wishlist idea, so everybody can see
-- their photos too. A shopping item's photos can be seen by
-- anyone who can use that list (the owner and the people ticked
-- under "Who can use this list"). You can only add or remove
-- photos in your own folder.
--
-- Two new columns: wishes.photos and shopping.photos. Both backup
-- scripts already take every column of wishes and shopping, so
-- nothing changes there. Safe to run more than once.
-- ============================================================


-- ---------- The new columns ----------
alter table wishes   add column if not exists photos jsonb not null default '[]';
alter table shopping add column if not exists photos jsonb not null default '[]';

comment on column wishes.photos is
  'A list of {path} in the photos store, in the order they were added.';
comment on column shopping.photos is
  'A list of {path} in the photos store, in the order they were added.';


-- ---------- Wishlist photos ----------
drop policy if exists "see wish photos"    on storage.objects;
drop policy if exists "add wish photos"    on storage.objects;
drop policy if exists "remove wish photos" on storage.objects;

create policy "see wish photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and name like 'wsh/%');

create policy "add wish photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos'
              and name like 'wsh/' || auth.uid()::text || '/%');

create policy "remove wish photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos'
         and name like 'wsh/' || auth.uid()::text || '/%');


-- ---------- Shopping photos ----------
-- A photo belongs to an item on a list you can use.
create or replace function shop_photo_seen_by_me(p text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from shopping s
    where s.photos @> jsonb_build_array(jsonb_build_object('path', p))
      and may_see_list(s.list_id));
$$;

drop policy if exists "see shopping photos"    on storage.objects;
drop policy if exists "add shopping photos"    on storage.objects;
drop policy if exists "remove shopping photos" on storage.objects;

create policy "see shopping photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and name like 'shp/%'
         and (name like 'shp/' || auth.uid()::text || '/%'
              or shop_photo_seen_by_me(name)));

create policy "add shopping photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos'
              and name like 'shp/' || auth.uid()::text || '/%');

create policy "remove shopping photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos'
         and name like 'shp/' || auth.uid()::text || '/%');


-- ---------- Check it took ----------
-- You should see 8 lines: shopping photos and wishes photos, then
-- 3 rules with "shopping photos" and 3 with "wish photos".
select table_name::text as "what", column_name::text as "name", data_type::text as "kind"
from information_schema.columns
where table_schema = 'public' and column_name = 'photos'
  and table_name in ('wishes','shopping')
union all
select 'storage rule', policyname::text, cmd::text
from pg_policies
where schemaname = 'storage'
  and (policyname like '%wish photos%' or policyname like '%shopping photos%')
order by 1, 2;
