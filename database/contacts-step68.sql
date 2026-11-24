-- ============================================================
-- Contacts database - Step 68: the Family Tree
-- Paste into the Supabase SQL Editor and Run. Safe to run twice.
-- ============================================================
-- The people in the tree are contacts. Anyone ticked "Family tree only"
-- (most ancestors) stays out of the everyday contact list, its searches,
-- birthdays and Today. Their family details sit in one "family" box on the
-- contact: places of birth and death, christening and burial, addresses
-- lived at, PDFs, and how sure each date is (just a year, about, before).
-- Ancestry's own number for each person (ged_id) lets a later import update
-- people instead of adding them twice.
-- No new tables, so the two backup scripts need no change: they copy whole
-- rows of contacts, relationships and link_kinds.

-- ---------- Contacts ----------
alter table contacts
  add column if not exists tree_only boolean not null default false,
  add column if not exists sex       text,
  add column if not exists ged_id    text,
  add column if not exists family    jsonb not null default '{}'::jsonb;

alter table contacts drop constraint if exists contacts_sex_check;
alter table contacts add constraint contacts_sex_check
  check (sex is null or sex in ('M','F'));

-- One person per Ancestry number, for each of us.
create unique index if not exists contacts_ged_id_idx
  on contacts (created_by, ged_id) where ged_id is not null;
create index if not exists contacts_tree_only_idx
  on contacts (created_by) where tree_only;

comment on column contacts.tree_only is
  'Family Tree (step 68): kept out of the everyday contact list, searches and birthdays.';
comment on column contacts.family is
  'Family Tree (step 68): {birth, death, chr, burial: {d, p, q, pl}, homes: [...], files: [...], ged: {...}}.';


-- ---------- Links between people ----------
-- A link is "tree only" when both people are; the everyday list leaves those
-- out, so it stays quick however big the tree grows. Kept right by the
-- database itself, below. "family" holds a marriage's date and place.
alter table relationships
  add column if not exists tree_only boolean not null default false,
  add column if not exists family    jsonb not null default '{}'::jsonb;
create index if not exists relationships_tree_only_idx on relationships (tree_only);

create or replace function rel_tree_only()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.tree_only :=
        coalesce((select c.tree_only from contacts c where c.id = new.from_contact), false)
    and coalesce((select c.tree_only from contacts c where c.id = new.to_contact), false);
  return new;
end;
$$;
drop trigger if exists rel_tree_only on relationships;
create trigger rel_tree_only
  before insert or update of from_contact, to_contact on relationships
  for each row execute function rel_tree_only();

create or replace function contact_tree_only_links()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update relationships r
     set tree_only = coalesce(a.tree_only, false) and coalesce(b.tree_only, false)
    from contacts a, contacts b
   where (r.from_contact = new.id or r.to_contact = new.id)
     and a.id = r.from_contact and b.id = r.to_contact;
  return null;
end;
$$;
drop trigger if exists contact_tree_only_links on contacts;
create trigger contact_tree_only_links
  after update of tree_only on contacts
  for each row when (old.tree_only is distinct from new.tree_only)
  execute function contact_tree_only_links();


-- ---------- Which connection types make the tree ----------
-- parent: "A Parent of B" means A is B's parent; child: the other way round;
-- partner and sibling work both ways. Set for the usual names; any others
-- can be set later.
alter table link_kinds add column if not exists tree_role text;
alter table link_kinds drop constraint if exists link_kinds_tree_role_check;
alter table link_kinds add constraint link_kinds_tree_role_check
  check (tree_role is null or tree_role in ('parent','child','partner','sibling'));

update link_kinds set tree_role = 'parent'  where tree_role is null and name = 'Parent of';
update link_kinds set tree_role = 'child'   where tree_role is null and name = 'Child of';
update link_kinds set tree_role = 'partner' where tree_role is null and name in ('Married to','Partner of');
update link_kinds set tree_role = 'sibling' where tree_role is null and name = 'Sibling of';

-- The tree needs at least a parent kind and a partner kind.
insert into link_kinds (name, inverse_name, sort_order, tree_role)
select 'Parent of', 'Child of', 30, 'parent'
where not exists (select 1 from link_kinds where tree_role = 'parent')
  and not exists (select 1 from link_kinds where name = 'Parent of');
insert into link_kinds (name, inverse_name, sort_order, tree_role)
select 'Married to', 'Married to', 20, 'partner'
where not exists (select 1 from link_kinds where tree_role = 'partner')
  and not exists (select 1 from link_kinds where name = 'Married to');


-- ---------- Photos and PDFs: fam/<you>/..., yours alone for now ----------
drop policy if exists "see family files"    on storage.objects;
drop policy if exists "add family files"    on storage.objects;
drop policy if exists "remove family files" on storage.objects;

create policy "see family files" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and name like 'fam/' || auth.uid()::text || '/%');

create policy "add family files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and name like 'fam/' || auth.uid()::text || '/%');

create policy "remove family files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and name like 'fam/' || auth.uid()::text || '/%');


-- ---------- Check it took ----------
-- You should see 12 lines: 4 new columns on contacts, 2 on relationships,
-- 1 on link_kinds, 2 triggers and 3 storage rules with "family files";
-- then a line for each connection type the tree uses (usually 5:
-- Married to, Partner of, Parent of, Child of, Sibling of).
select 'column' as "what", table_name || '.' || column_name as "name"
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'contacts'      and column_name in ('tree_only','sex','ged_id','family'))
    or (table_name = 'relationships' and column_name in ('tree_only','family'))
    or (table_name = 'link_kinds'    and column_name = 'tree_role'))
union all
select 'trigger', trigger_name::text || ' on ' || event_object_table::text
from information_schema.triggers
where trigger_name in ('rel_tree_only','contact_tree_only_links')
group by trigger_name, event_object_table
union all
select 'storage rule', policyname::text
from pg_policies
where schemaname = 'storage' and policyname like '%family files%'
union all
select 'zz connection type', name || ' = ' || tree_role
from link_kinds where tree_role is not null
order by 1, 2;
