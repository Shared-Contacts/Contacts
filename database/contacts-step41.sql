-- ============================================================
-- Contacts database - Step 41: what you buy for the boat
--
-- The Daily Log gets five new sections: Diesel, Coal, Pump outs,
-- Gas and Boat servicing. Whatever you fill in under them is kept
-- with the day, in one new pocket called "buys", in the same way
-- your own sections keep theirs in "extra". It is as private as the
-- rest of the day, and shared only where the day itself is shared.
--
-- Three new choice lists go with them, kept with the others in
-- log_options: coal types, gas bottle sizes, and kinds of servicing.
--
-- No table is added or removed, so the backup scripts are unchanged.
-- Safe to run more than once. Nothing existing is touched.
-- ============================================================


-- ---------- Where the purchases live ----------
alter table log_days
  add column if not exists buys jsonb not null default '{}'::jsonb;

comment on column log_days.buys is
  'Purchases that day, as {"diesel":{...}, "coal":{...}, "pumpout":{...}, '
  '"gas":{...}, "service":{...}}. Worked-out figures are not stored.';


-- ---------- Three more kinds of choice list ----------
-- The list of allowed kinds was fixed in step 16. Take the old rule
-- off, whatever it was called, and put the longer one on.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.log_options'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%kind%'
  loop
    execute format('alter table log_options drop constraint %I', c);
  end loop;
end $$;

alter table log_options
  add constraint log_options_kind_check
  check (kind in ('medication','who_aboard','bike_ride','alcohol',
                  'coal_type','gas_bottle','service_kind'));


-- ---------- Check ----------
-- You should see two lines: log_days.buys (jsonb), and the rule
-- listing coal_type, gas_bottle and service_kind among the kinds.
select 'log_days.buys' as "what", data_type as "detail"
from information_schema.columns
where table_schema = 'public' and table_name = 'log_days' and column_name = 'buys'
union all
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.log_options'::regclass and contype = 'c';
