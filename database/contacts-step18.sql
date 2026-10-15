-- ============================================================
-- Contacts database - Step 18: medication as a list, settings order
-- Safe to run more than once.
-- ============================================================

-- Mark the medicines you take every day so they tick themselves
alter table log_options
  add column if not exists is_default boolean not null default false;

-- Your own order for the cards on the Settings screen
alter table profiles
  add column if not exists settings_order jsonb;

-- Split any medication recorded as one long string into separate choices
insert into log_options (created_by, kind, name, sort_order, is_default)
select distinct l.created_by, 'medication', btrim(part), 10, true
from log_days l,
     lateral unnest(string_to_array(l.medication, ',')) as part
where l.medication is not null
  and btrim(part) <> ''
  and length(btrim(part)) < 80
on conflict (created_by, kind, name) do nothing;

-- Remove the old combined entries, now the parts exist on their own
delete from log_options
where kind = 'medication' and name like '%,%';

select kind, count(*) from log_options group by kind order by 1;
