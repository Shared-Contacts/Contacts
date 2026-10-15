-- ============================================================
-- Contacts database - Step 21: stop the shared lists being
-- deleted out from under the data that uses them.
-- Safe to run more than once.
-- ============================================================

-- The groups incident could repeat with statuses, connection types
-- and pet types: any signed-in person can still delete those, and
-- the rows using them would go quiet or lose the setting.

create or replace function refuse_if_status_in_use()
returns trigger language plpgsql as $$
declare n int;
begin
  select count(*) into n from contacts where status_id = old.id;
  if n > 0 then
    raise exception 'The status "%" is on % contact(s) and cannot be deleted.', old.name, n;
  end if;
  return old;
end; $$;

drop trigger if exists statuses_guard on statuses;
create trigger statuses_guard before delete on statuses
  for each row execute function refuse_if_status_in_use();


create or replace function refuse_if_kind_in_use()
returns trigger language plpgsql as $$
declare n int;
begin
  select count(*) into n from relationships where kind = old.name;
  if n > 0 then
    raise exception 'The connection type "%" is used by % link(s) and cannot be deleted.',
      old.name, n;
  end if;
  return old;
end; $$;

drop trigger if exists link_kinds_guard on link_kinds;
create trigger link_kinds_guard before delete on link_kinds
  for each row execute function refuse_if_kind_in_use();


create or replace function refuse_if_pet_type_in_use()
returns trigger language plpgsql as $$
declare n int;
begin
  select count(*) into n from contacts
   where pets @> jsonb_build_array(jsonb_build_object('label', old.name));
  if n > 0 then
    raise exception 'The pet type "%" is on % contact(s) and cannot be deleted.', old.name, n;
  end if;
  return old;
end; $$;

drop trigger if exists pet_types_guard on pet_types;
create trigger pet_types_guard before delete on pet_types
  for each row execute function refuse_if_pet_type_in_use();
