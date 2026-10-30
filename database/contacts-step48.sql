-- ============================================================
-- Contacts database - Step 48: Aisles on shopping lists
--
-- A shopping list can have aisles, in the order you walk round
-- the shop, and each thing on it can sit in one, so the list
-- reads in shop order.
--
--   shopping_lists.aisles  the list's aisles, in order:
--                          [{id, name}]. Only the list's owner
--                          can change them.
--   shopping.aisle         the id of the aisle a thing is in,
--                          or empty for "not sorted yet".
--   shopping_aisle_memory  which aisle a thing went in last
--                          time, per list, so "Milk" lands in
--                          Dairy by itself next time. Anyone who
--                          can use the list can read and add to it.
--
-- New table: shopping_aisle_memory. Both backup scripts have been
-- updated to take it (same session, 30 Oct 2026). Safe to run
-- more than once.
-- ============================================================


-- ---------- The new columns ----------
alter table shopping_lists add column if not exists aisles jsonb not null default '[]';
alter table shopping       add column if not exists aisle  text;

comment on column shopping_lists.aisles is
  'The aisles in the order you walk round the shop: [{id, name}].';
comment on column shopping.aisle is
  'The id of the aisle (from shopping_lists.aisles) this is in; empty for not sorted yet.';


-- ---------- Where things went last time ----------
create table if not exists shopping_aisle_memory (
  list_id    bigint not null references shopping_lists on delete cascade,
  name       text   not null,           -- the thing's name, in lower case
  aisle      text   not null,           -- an id from shopping_lists.aisles
  updated_at timestamptz not null default now(),
  primary key (list_id, name)
);

alter table shopping_aisle_memory enable row level security;

drop policy if exists "use aisle memory" on shopping_aisle_memory;

create policy "use aisle memory" on shopping_aisle_memory for all to authenticated
  using (may_see_list(list_id))
  with check (may_see_list(list_id));


-- ---------- Check it took ----------
-- You should see 3 lines: shopping aisle, shopping_lists aisles,
-- and the rule "use aisle memory".
select table_name::text as "what", column_name::text as "name", data_type::text as "kind"
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'shopping' and column_name = 'aisle')
    or (table_name = 'shopping_lists' and column_name = 'aisles'))
union all
select 'rule on ' || tablename::text, policyname::text, cmd::text
from pg_policies
where schemaname = 'public' and tablename = 'shopping_aisle_memory'
order by 1, 2;
