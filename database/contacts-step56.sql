-- ============================================================
-- Contacts database - Step 56: people who can sign in
--
-- Every sign-in already has a row in profiles, made when the
-- account is set up and linked to it by the sign-in's own id, with
-- the email it signs in with. Its name was filled in with the email
-- address, which is why emails showed wherever you choose people.
--
-- This adds a phone number beside the name, and lets each person's
-- name and phone be filled in properly (from Contacts, in the app):
-- by that person, or by one of the app's owners for anyone.
--
-- The owners are kept in a new small table, app_owners, filled here
-- once with Barry and Sandra. Only the SQL Editor can change it.
-- Both backup scripts include it from 5 Nov 2026.
--
-- Nothing existing is changed or removed. Safe to run more than once.
-- ============================================================


-- ---------- A phone number on each person ----------
alter table profiles add column if not exists phone text;

comment on column profiles.phone is
  'The number other people see when choosing who to share with.';


-- ---------- The app's owners ----------
create table if not exists app_owners (
  user_id  uuid primary key references profiles on delete cascade,
  added_at timestamptz not null default now()
);

comment on table app_owners is
  'Who may fill in other people''s names and phones. Changed only in the SQL Editor.';

alter table app_owners enable row level security;

-- Everyone signed in may see who the owners are (the app asks).
-- There is no rule for adding, changing or removing, so nobody can
-- from the app: only here, in the SQL Editor.
drop policy if exists "see owners" on app_owners;
create policy "see owners" on app_owners
  for select to authenticated using (true);

-- Barry and Sandra: the same rule the app has used until now, a name
-- or email starting with barry or sandra. Already there: left alone.
insert into app_owners (user_id)
select id from profiles
 where lower(coalesce(display_name,'')) like 'barry%'
    or lower(coalesce(email,''))        like 'barry%'
    or lower(coalesce(display_name,'')) like 'sandra%'
    or lower(coalesce(email,''))        like 'sandra%'
on conflict (user_id) do nothing;


-- ---------- Is whoever is asking an owner? ----------
create or replace function is_app_owner()
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from app_owners where user_id = auth.uid());
$$;

revoke all on function is_app_owner() from public, anon;
grant execute on function is_app_owner() to authenticated;


-- ---------- Filling in a person's name and phone ----------
-- Yourself, or anyone if you are an owner. An empty name goes back
-- to the email address, as when the account was made.
create or replace function set_person(who uuid, full_name text, phone_no text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or (who <> auth.uid() and not is_app_owner()) then
    raise exception 'Only that person, or an owner of the app, can change their details';
  end if;
  update profiles
     set display_name = coalesce(nullif(trim(full_name), ''), email),
         phone        = nullif(trim(phone_no), '')
   where id = who;
  if not found then
    raise exception 'There is nobody with that sign-in';
  end if;
end $$;

revoke all on function set_person(uuid, text, text) from public, anon;
grant execute on function set_person(uuid, text, text) to authenticated;


-- ---------- Check ----------
-- It should show 5 lines: the phone column, the two owners
-- (Barry and Sandra), then the two functions.
select 'column' as what, column_name as name
  from information_schema.columns
 where table_schema = 'public' and table_name = 'profiles' and column_name = 'phone'
union all
select 'owner', coalesce(p.display_name, p.email)
  from app_owners o join profiles p on p.id = o.user_id
union all
select 'function', routine_name
  from information_schema.routines
 where routine_schema = 'public' and routine_name in ('is_app_owner', 'set_person');
