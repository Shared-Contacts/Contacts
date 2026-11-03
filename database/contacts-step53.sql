-- ============================================================
-- Contacts database - Step 53: My Stuff, boats and loyalty cards
--
-- Step 50 only let a thing be one of five types: vehicle, item,
-- property, document or policy. The app now has two more, a boat and
-- a loyalty or membership card, so the database refused them (and
-- refused Change the type to either).
--
-- This swaps the old rule for one with all seven. Their boxes are
-- kept in stuff.details as before, so nothing else changes.
--
-- No new tables, so the backup scripts are unchanged.
-- Safe to run more than once.
-- ============================================================

-- The old rule, whatever name Postgres gave it.
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.stuff'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute format('alter table public.stuff drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.stuff add constraint stuff_kind_check
  check (kind in ('vehicle','boat','item','property','document','policy','loyalty'));


-- ---------- Check it took ----------
-- You should see 1 line: stuff_kind_check, with boat and loyalty in it.
select conname::text as "rule", pg_get_constraintdef(oid) as "what it allows"
from pg_constraint
where conrelid = 'public.stuff'::regclass and contype = 'c';
