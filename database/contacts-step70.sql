-- ============================================================
-- Contacts database - Step 70: sharing the Family Tree (ML406)
--
-- Whoever owns a tree ticks who else can see it. Those people can look
-- at the whole tree, open anyone in it, and see their photos and PDFs,
-- but only the owner can change it. Someone in the tree who is also one
-- of the owner's everyday contacts shows their whole card. A contact
-- that someone else shared with the owner stays out, unless it has been
-- shared with the viewer as well.
--
-- Nothing step 4, 9 or 68 made is changed. The tree comes through one
-- new function, family_tree, which answers only someone the tree is
-- shared with, so the everyday contact list, its searches, birthdays
-- and Today are just as they were for everybody.
--
-- One new table, tree_shares: both backup scripts have it added.
-- Safe to run more than once.
-- ============================================================


-- ---------- Who can see whose tree ----------
create table if not exists tree_shares (
  owner_id   uuid not null references profiles on delete cascade,
  viewer_id  uuid not null references profiles on delete cascade,
  created_at timestamptz default now(),
  primary key (owner_id, viewer_id),
  check (owner_id <> viewer_id)
);

comment on table tree_shares is
  'Family Tree (step 70): the owner''s tree can be seen, not changed, by the viewer.';

alter table tree_shares enable row level security;

drop policy if exists "manage my tree shares" on tree_shares;
create policy "manage my tree shares" on tree_shares
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "tree shares naming me" on tree_shares;
create policy "tree shares naming me" on tree_shares
  for select to authenticated
  using (viewer_id = auth.uid());


-- ---------- Who is in someone's tree ----------
-- The same people the app draws in their own tree: their family-only
-- people, their contacts with family details or brought in from
-- Ancestry, the contact that is them, and both ends of every family
-- link (parent, child, partner, sibling) between contacts they can see.
-- For the database's own use only: the functions below ask it.
create or replace function tree_ids(o uuid)
returns setof bigint language sql security definer stable set search_path = public as $$
  with seen as (
    select c.id from contacts c
    where c.created_by = o
       or exists (select 1 from contact_shares s where s.contact_id = c.id and s.user_id = o)
  ), fl as (
    select r.from_contact, r.to_contact
    from relationships r join link_kinds k on k.name = r.kind
    where k.tree_role is not null
      and r.from_contact in (select id from seen)
      and r.to_contact   in (select id from seen)
  )
  select c.id from contacts c
  where c.created_by = o
    and (c.tree_only or c.ged_id is not null or c.family <> '{}'::jsonb
         or c.id = (select p.my_contact_id from profiles p where p.id = o))
  union select from_contact from fl
  union select to_contact   from fl;
$$;

revoke all on function tree_ids(uuid) from public, anon, authenticated;


-- ---------- The tree, for someone it is shared with ----------
-- Everyone in it the viewer may see (the owner's own, or already the
-- viewer's or shared with them), the family links between them, and
-- which of them is the owner. Read only: nothing here changes anything.
create or replace function family_tree(o uuid)
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare
  me  uuid := auth.uid();
  out jsonb;
begin
  if me is null or not exists (select 1 from tree_shares where owner_id = o and viewer_id = me) then
    raise exception 'That family tree is not shared with you';
  end if;
  with ok as (
    select c.* from contacts c
    where c.id in (select tree_ids(o))
      and (c.created_by = o or c.created_by = me
           or exists (select 1 from contact_shares s where s.contact_id = c.id and s.user_id = me))
  ), fl as (
    select r.* from relationships r
    where r.kind in (select name from link_kinds where tree_role is not null)
      and r.from_contact in (select id from ok)
      and r.to_contact   in (select id from ok)
  )
  select jsonb_build_object(
    'people', coalesce((select jsonb_agg(to_jsonb(ok) order by ok.id) from ok), '[]'::jsonb),
    'links',  coalesce((select jsonb_agg(to_jsonb(fl) order by fl.id) from fl), '[]'::jsonb),
    'mid',    (select p.my_contact_id from profiles p
               where p.id = o and p.my_contact_id in (select id from ok)))
  into out;
  return out;
end;
$$;

revoke all on function family_tree(uuid) from public, anon;
grant execute on function family_tree(uuid) to authenticated;


-- ---------- Their photos and PDFs ----------
-- A contact's photos are kept as  <contact id>/...  and the rest of the
-- tree's photos and PDFs as  fam/<owner>/...  These two rules sit beside
-- step 9's and step 68's, and only ever let someone look.
create or replace function tree_contact_seen(cid bigint)
returns boolean language plpgsql security definer stable set search_path = public as $$
declare o uuid;
begin
  select c.created_by into o
  from contacts c join tree_shares t on t.owner_id = c.created_by and t.viewer_id = auth.uid()
  where c.id = cid;
  if o is null then return false; end if;
  return exists (select 1 from tree_ids(o) as i(id) where i.id = cid);
end;
$$;

create or replace function tree_files_seen(objname text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from tree_shares
                 where owner_id::text = split_part(objname, '/', 2) and viewer_id = auth.uid());
$$;

revoke all on function tree_contact_seen(bigint) from public, anon;
revoke all on function tree_files_seen(text)     from public, anon;
grant execute on function tree_contact_seen(bigint) to authenticated;
grant execute on function tree_files_seen(text)     to authenticated;

drop policy if exists "see photos in trees shared with me" on storage.objects;
create policy "see photos in trees shared with me" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos'
         and photo_contact_id(name) is not null
         and tree_contact_seen(photo_contact_id(name)));

drop policy if exists "see family files shared with me" on storage.objects;
create policy "see family files shared with me" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and name like 'fam/%' and tree_files_seen(name));


-- ---------- Check it took ----------
-- You should see 9 lines: the new table, its 2 rules, the 4 new
-- functions and the 2 new storage rules.
select 'table' as "what", table_name::text as "name"
from information_schema.tables
where table_schema = 'public' and table_name = 'tree_shares'
union all
select 'table rule', policyname::text
from pg_policies
where schemaname = 'public' and tablename = 'tree_shares'
union all
select 'function', p.proname::text
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('tree_ids','family_tree','tree_contact_seen','tree_files_seen')
union all
select 'storage rule', policyname::text
from pg_policies
where schemaname = 'storage'
  and policyname in ('see photos in trees shared with me','see family files shared with me')
order by 1, 2;
