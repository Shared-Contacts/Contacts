-- ============================================================
-- Contacts database - Step 4: ownership, sharing, personal groups
--
-- BEFORE RUNNING: replace the two email addresses below with
-- yours and Sandra's, exactly as they appear under
-- Authentication > Users.
-- ============================================================

-- ---------- Businesses as contacts ----------
alter table contacts add column is_organisation boolean not null default false;


-- ---------- Groups can belong to one person, or to everyone ----------
alter table groups add column owner_id uuid references profiles on delete cascade;

alter table groups drop constraint groups_name_key;
create unique index groups_name_owner_idx
  on groups (name, coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Family, Friend, Professional and Casual stay shared by everyone.
-- The rest become yours; Sandra can make her own.
update groups set owner_id = (select id from profiles where email = 'YOUR-EMAIL-HERE')
where name in ('Friend''s Family', 'Boater', 'D&K');


-- ---------- Filing is personal: my tags are not your tags ----------
alter table contact_groups add column user_id uuid references profiles on delete cascade;

update contact_groups cg set user_id = c.created_by
from contacts c where c.id = cg.contact_id;

delete from contact_groups where user_id is null;
alter table contact_groups alter column user_id set not null;

alter table contact_groups drop constraint contact_groups_pkey;
alter table contact_groups add primary key (contact_id, group_id, user_id);


-- ---------- Explicit sharing ----------
create table contact_shares (
  contact_id bigint not null references contacts on delete cascade,
  user_id    uuid   not null references profiles on delete cascade,
  can_edit   boolean not null default true,
  created_at timestamptz default now(),
  primary key (contact_id, user_id)
);

alter table contact_shares enable row level security;


-- ---------- Out with the old rules ----------
drop policy if exists "see contacts in my groups"    on contacts;
drop policy if exists "add contacts"                 on contacts;
drop policy if exists "edit contacts in my groups"   on contacts;
drop policy if exists "delete contacts in my groups" on contacts;
drop policy if exists "see group tags"               on contact_groups;
drop policy if exists "add group tags"               on contact_groups;
drop policy if exists "remove group tags"            on contact_groups;
drop policy if exists "see links"                    on relationships;
drop policy if exists "add links"                    on relationships;
drop policy if exists "edit links"                   on relationships;
drop policy if exists "delete links"                 on relationships;
drop policy if exists "read groups"                  on groups;
drop policy if exists "manage groups"                on groups;
drop policy if exists "own profile"                  on profiles;
drop policy if exists "own memberships"              on group_members;

drop function if exists can_see_contact(bigint);
drop function if exists can_edit_contact(bigint);
drop function if exists i_own_contact(bigint);
drop function if exists my_editable_groups();

-- Group membership no longer decides who sees what.
drop table if exists group_members;


-- ---------- New helpers ----------
create or replace function mine(cid bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from contacts where id = cid and created_by = auth.uid());
$$;

create or replace function shared_to_me(cid bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from contact_shares where contact_id = cid and user_id = auth.uid());
$$;

create or replace function shared_to_me_editable(cid bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from contact_shares
                 where contact_id = cid and user_id = auth.uid() and can_edit);
$$;


-- ---------- Contacts: mine, or shared with me ----------
create policy "see my contacts" on contacts
  for select to authenticated
  using (created_by = auth.uid() or shared_to_me(id));

create policy "add my contacts" on contacts
  for insert to authenticated
  with check (created_by = auth.uid());

create policy "edit my contacts" on contacts
  for update to authenticated
  using (created_by = auth.uid() or shared_to_me_editable(id));

-- Only the owner can delete. A shared copy can be edited, never destroyed.
create policy "delete my contacts" on contacts
  for delete to authenticated
  using (created_by = auth.uid());


-- ---------- Filing: only ever my own rows ----------
create policy "see my filing" on contact_groups
  for select to authenticated using (user_id = auth.uid());

create policy "file contacts" on contact_groups
  for insert to authenticated
  with check (user_id = auth.uid() and (mine(contact_id) or shared_to_me(contact_id)));

create policy "unfile contacts" on contact_groups
  for delete to authenticated using (user_id = auth.uid());


-- ---------- Sharing: the owner decides ----------
create policy "see shares" on contact_shares
  for select to authenticated
  using (user_id = auth.uid() or mine(contact_id));

create policy "make shares" on contact_shares
  for insert to authenticated with check (mine(contact_id));

create policy "change shares" on contact_shares
  for update to authenticated using (mine(contact_id));

create policy "drop shares" on contact_shares
  for delete to authenticated using (mine(contact_id));


-- ---------- Groups: global ones, plus my own ----------
create policy "see groups" on groups
  for select to authenticated
  using (owner_id is null or owner_id = auth.uid());

create policy "add groups" on groups
  for insert to authenticated
  with check (owner_id is null or owner_id = auth.uid());

create policy "edit groups" on groups
  for update to authenticated
  using (owner_id is null or owner_id = auth.uid());

create policy "remove groups" on groups
  for delete to authenticated
  using (owner_id is null or owner_id = auth.uid());


-- ---------- Links follow the contacts they join ----------
create policy "see links" on relationships
  for select to authenticated
  using ((mine(from_contact) or shared_to_me(from_contact))
     and (mine(to_contact)   or shared_to_me(to_contact)));

create policy "add links" on relationships
  for insert to authenticated
  with check ((mine(from_contact) or shared_to_me_editable(from_contact))
          and (mine(to_contact)   or shared_to_me(to_contact)));

create policy "edit links" on relationships
  for update to authenticated
  using (mine(from_contact) or shared_to_me_editable(from_contact));

create policy "delete links" on relationships
  for delete to authenticated
  using (mine(from_contact) or shared_to_me_editable(from_contact));


-- ---------- Everyone signed in can see who else exists ----------
-- Needed so the Share list can show names. Only a handful of people.
create policy "see people" on profiles
  for select to authenticated using (true);

create policy "edit own profile" on profiles
  for update to authenticated using (id = auth.uid());


-- ============================================================
-- OPTIONAL: share everything you own with Sandra straight away.
-- Delete these three lines if you would rather share selectively.
-- ============================================================
insert into contact_shares (contact_id, user_id, can_edit)
select c.id, (select id from profiles where email = 'SANDRAS-EMAIL-HERE'), true
from contacts c where c.created_by = (select id from profiles where email = 'YOUR-EMAIL-HERE')
on conflict do nothing;
