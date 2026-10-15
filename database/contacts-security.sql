-- ============================================================
-- Contacts database - Step 2: security rules
-- Paste into the Supabase SQL Editor and Run.
-- ============================================================

-- ---------- Helper functions ----------
-- These run with elevated rights so the rules below don't chase
-- their own tail. They answer: what is this logged-in user allowed to do?

create or replace function can_see_contact(cid bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from contact_groups cg
    join group_members gm on gm.group_id = cg.group_id
    where cg.contact_id = cid
      and gm.user_id = auth.uid()
  );
$$;

create or replace function can_edit_contact(cid bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from contact_groups cg
    join group_members gm on gm.group_id = cg.group_id
    where cg.contact_id = cid
      and gm.user_id = auth.uid()
      and gm.role = 'editor'
  );
$$;

create or replace function i_own_contact(cid bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from contacts where id = cid and created_by = auth.uid()
  );
$$;

create or replace function my_editable_groups()
returns setof bigint language sql security definer stable set search_path = public as $$
  select group_id from group_members
  where user_id = auth.uid() and role = 'editor';
$$;


-- ---------- Turn protection on ----------
alter table profiles       enable row level security;
alter table groups         enable row level security;
alter table group_members  enable row level security;
alter table contacts       enable row level security;
alter table contact_groups enable row level security;
alter table relationships  enable row level security;


-- ---------- profiles: you can only see your own ----------
create policy "own profile" on profiles
  for select to authenticated
  using (id = auth.uid());

create policy "update own profile" on profiles
  for update to authenticated
  using (id = auth.uid());


-- ---------- groups: everyone signed in can read the list ----------
-- (You add and rename groups yourself in the dashboard.)
create policy "read groups" on groups
  for select to authenticated
  using (true);


-- ---------- group_members: you can see your own memberships ----------
-- (You grant people access yourself in the dashboard.)
create policy "own memberships" on group_members
  for select to authenticated
  using (user_id = auth.uid());


-- ---------- contacts ----------
create policy "see contacts in my groups" on contacts
  for select to authenticated
  using (created_by = auth.uid() or can_see_contact(id));

create policy "add contacts" on contacts
  for insert to authenticated
  with check (created_by = auth.uid());

create policy "edit contacts in my groups" on contacts
  for update to authenticated
  using (created_by = auth.uid() or can_edit_contact(id));

create policy "delete contacts in my groups" on contacts
  for delete to authenticated
  using (created_by = auth.uid() or can_edit_contact(id));


-- ---------- contact_groups ----------
create policy "see group tags" on contact_groups
  for select to authenticated
  using (i_own_contact(contact_id) or can_see_contact(contact_id));

create policy "add group tags" on contact_groups
  for insert to authenticated
  with check (
    group_id in (select my_editable_groups())
    and (i_own_contact(contact_id) or can_edit_contact(contact_id))
  );

create policy "remove group tags" on contact_groups
  for delete to authenticated
  using (
    group_id in (select my_editable_groups())
    and (i_own_contact(contact_id) or can_edit_contact(contact_id))
  );


-- ---------- relationships ----------
-- You only see a link if you can see BOTH people in it.
create policy "see links" on relationships
  for select to authenticated
  using (
    (i_own_contact(from_contact) or can_see_contact(from_contact))
    and
    (i_own_contact(to_contact) or can_see_contact(to_contact))
  );

create policy "add links" on relationships
  for insert to authenticated
  with check (
    (i_own_contact(from_contact) or can_edit_contact(from_contact))
    and
    (i_own_contact(to_contact) or can_see_contact(to_contact))
  );

create policy "edit links" on relationships
  for update to authenticated
  using (i_own_contact(from_contact) or can_edit_contact(from_contact));

create policy "delete links" on relationships
  for delete to authenticated
  using (i_own_contact(from_contact) or can_edit_contact(from_contact));
