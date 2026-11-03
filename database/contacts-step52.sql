-- ============================================================
-- Contacts database - Step 52: a contact that is used somewhere
-- else in the app cannot be deleted, and two contacts can be
-- blended into one (ML153, ML154).
-- Paste into the Supabase SQL Editor and Run.
-- Safe to run more than once.
-- ============================================================

-- Until now deleting a contact quietly blanked whatever pointed at
-- it: the person an appointment was about, a Finances payee's
-- contact, "which contact is you", a My Stuff service's Where. And
-- the names kept inside My Stuff and the Daily Log purchases were
-- left pointing at nothing. From here on the database refuses.
--
-- Connections to other contacts do not count: they belong to the
-- contact and go with it, as before.


-- ---------- Where a contact is used ----------
-- Counts only, from everybody's records (someone else's diary can be
-- about a contact you share with them), never what those records say.
-- contact_use_counts is for the database's own use; the app asks
-- contact_uses, which only answers about a contact you can see.
create or replace function contact_use_counts(cid bigint)
returns jsonb language sql security definer stable set search_path = public as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'diary',    nullif((select count(*) from items where contact_id = cid), 0),
    'payees',   nullif((select count(*) from payees where contact_id = cid), 0),
    'me',       nullif((select count(*) from profiles
                         where my_contact_id = cid or partner_contact_id = cid), 0),
    'stuff',    nullif((select count(*) from stuff
                         where details->>'bought_from_id' = cid::text
                            or details->>'insurer_id' = cid::text), 0),
    'services', nullif((select count(*) from stuff_service where where_contact = cid), 0),
    'log',      nullif((select count(*) from log_days d
                         where jsonb_typeof(d.buys) = 'object'
                           and exists (select 1 from jsonb_each(d.buys) b
                             where jsonb_typeof(b.value) = 'object'
                               and b.value->>'from_id' = cid::text)), 0),
    'links',    nullif((select count(*) from relationships
                         where from_contact = cid or to_contact = cid), 0)));
$$;

create or replace function contact_uses(cid bigint)
returns jsonb language sql security definer stable set search_path = public as $$
  select case when mine(cid) or shared_to_me(cid) then contact_use_counts(cid) end;
$$;

-- Every contact you can see that something else uses, for the link
-- mark on the contact list. Connections are left out here too.
create or replace function linked_contacts()
returns setof bigint language sql security definer stable set search_path = public as $$
  select distinct u.id from (
    select contact_id as id from items where contact_id is not null
    union select contact_id from payees where contact_id is not null
    union select my_contact_id from profiles where my_contact_id is not null
    union select partner_contact_id from profiles where partner_contact_id is not null
    union select where_contact from stuff_service where where_contact is not null
    union select (details->>'bought_from_id')::bigint from stuff
            where details->>'bought_from_id' ~ '^\d+$'
    union select (details->>'insurer_id')::bigint from stuff
            where details->>'insurer_id' ~ '^\d+$'
    union select (b.value->>'from_id')::bigint from log_days d,
            jsonb_each(case when jsonb_typeof(d.buys) = 'object' then d.buys else '{}' end) b
            where jsonb_typeof(b.value) = 'object' and b.value->>'from_id' ~ '^\d+$'
  ) u
  join contacts c on c.id = u.id
  where c.created_by = auth.uid() or shared_to_me(c.id);
$$;


-- ---------- The guard ----------
-- Lets through: a delete that is part of a blend (merge_contacts says
-- which one), and a delete set off by something else being deleted
-- (pg_trigger_depth above 1), so removing a person's whole account
-- is never stopped by this.
create or replace function refuse_if_contact_in_use()
returns trigger language plpgsql security definer set search_path = public as $$
declare u jsonb;
begin
  if pg_trigger_depth() > 1 then return old; end if;
  if coalesce(current_setting('app.blending_contact', true), '') = old.id::text then
    return old;
  end if;
  u := contact_use_counts(old.id) - 'links';
  if u <> '{}'::jsonb then
    raise exception 'CONTACT IN USE %', u::text
      using hint = 'Change those first, or blend this contact into another one.';
  end if;
  return old;
end; $$;

drop trigger if exists contacts_in_use_guard on contacts;
create trigger contacts_in_use_guard before delete on contacts
  for each row execute function refuse_if_contact_in_use();


-- ---------- Blending two contacts into one ----------
-- Everything that pointed at "gone" is moved to "keep", then "gone" is
-- deleted. The app has already written the chosen details onto "keep".
-- Only the owner of "gone" can do this (only an owner can delete), and
-- only into a contact they can change.
create or replace function merge_contacts(keep bigint, gone bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if keep is null or gone is null or keep = gone then
    raise exception 'Choose two different contacts';
  end if;
  if not mine(gone) then
    raise exception 'Only the person who added % can blend it away', gone;
  end if;
  if not (mine(keep) or shared_to_me_editable(keep)) then
    raise exception 'You cannot change the contact you are keeping';
  end if;

  update items          set contact_id = keep         where contact_id = gone;
  update payees         set contact_id = keep         where contact_id = gone;
  update profiles       set my_contact_id = keep      where my_contact_id = gone;
  update profiles       set partner_contact_id = keep where partner_contact_id = gone;
  update stuff_service  set where_contact = keep      where where_contact = gone;
  update stuff set details = jsonb_set(details, '{bought_from_id}', to_jsonb(keep))
    where details->>'bought_from_id' = gone::text;
  update stuff set details = jsonb_set(details, '{insurer_id}', to_jsonb(keep))
    where details->>'insurer_id' = gone::text;
  update log_days d set buys = (
      select jsonb_object_agg(b.key,
        case when jsonb_typeof(b.value) = 'object' and b.value->>'from_id' = gone::text
             then jsonb_set(b.value, '{from_id}', to_jsonb(keep)) else b.value end)
      from jsonb_each(d.buys) b)
    where jsonb_typeof(d.buys) = 'object'
      and exists (select 1 from jsonb_each(d.buys) b
                  where jsonb_typeof(b.value) = 'object' and b.value->>'from_id' = gone::text);
  update contact_offers set source_id = keep where source_id = gone;

  -- Connections: moved across, unless it would link "keep" to itself or
  -- the same connection is there already.
  delete from relationships r
    where (r.from_contact = gone and (r.to_contact = keep or exists (
             select 1 from relationships x where x.from_contact = keep
               and x.to_contact = r.to_contact and x.kind = r.kind)))
       or (r.to_contact = gone and (r.from_contact = keep or exists (
             select 1 from relationships x where x.to_contact = keep
               and x.from_contact = r.from_contact and x.kind = r.kind)));
  update relationships set from_contact = keep where from_contact = gone;
  update relationships set to_contact   = keep where to_contact   = gone;

  -- Groups, favourites and sharing: each person keeps theirs.
  insert into contact_groups (contact_id, group_id, user_id)
    select keep, group_id, user_id from contact_groups where contact_id = gone
    on conflict do nothing;
  insert into contact_favourites (contact_id, user_id)
    select keep, user_id from contact_favourites where contact_id = gone
    on conflict do nothing;
  insert into contact_shares (contact_id, user_id, can_edit)
    select keep, user_id, can_edit from contact_shares where contact_id = gone
    on conflict do nothing;

  perform set_config('app.blending_contact', gone::text, true);
  delete from contacts where id = gone;
  perform set_config('app.blending_contact', '', true);
end; $$;

revoke all on function contact_use_counts(bigint)    from public, anon, authenticated;
revoke all on function contact_uses(bigint)          from public, anon;
revoke all on function linked_contacts()             from public, anon;
revoke all on function merge_contacts(bigint,bigint) from public, anon;
grant execute on function contact_uses(bigint)          to authenticated;
grant execute on function linked_contacts()             to authenticated;
grant execute on function merge_contacts(bigint,bigint) to authenticated;


-- ---------- Check ----------
-- Should show 5 rows: contact_use_counts, contact_uses, linked_contacts,
-- merge_contacts and refuse_if_contact_in_use.
select proname from pg_proc
where proname in ('contact_use_counts','contact_uses','linked_contacts','merge_contacts','refuse_if_contact_in_use')
order by proname;
