-- ============================================================
-- Contacts database - Step 9: photos
-- Paste into the Supabase SQL Editor and Run.
-- ============================================================

alter table contacts
  add column avatar_path text,
  add column photos      jsonb not null default '[]'::jsonb;


-- ---------- A private place to keep them ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('photos', 'photos', false, 5242880)
on conflict (id) do nothing;


-- ---------- Photos follow the contact they belong to ----------
-- Every file is stored as  <contact id>/<random name>.jpg
-- so the rules can work out whose photo it is from the path.

create or replace function photo_contact_id(objname text)
returns bigint language sql immutable as $$
  select case when objname ~ '^\d+/' then split_part(objname,'/',1)::bigint end;
$$;

create policy "see contact photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos'
    and photo_contact_id(name) is not null
    and (mine(photo_contact_id(name)) or shared_to_me(photo_contact_id(name)))
  );

create policy "add contact photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and photo_contact_id(name) is not null
    and (mine(photo_contact_id(name)) or shared_to_me_editable(photo_contact_id(name)))
  );

create policy "remove contact photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos'
    and photo_contact_id(name) is not null
    and (mine(photo_contact_id(name)) or shared_to_me_editable(photo_contact_id(name)))
  );
