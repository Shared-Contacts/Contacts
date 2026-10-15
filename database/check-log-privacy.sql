-- ============================================================
-- Is the Daily Log private to each person?
-- Read-only. Changes nothing. Paste into the SQL Editor and Run.
-- ============================================================

-- Every rule on the log should say  created_by = auth.uid()
-- which means "only your own rows", for reading, adding,
-- changing and deleting alike.
select tablename  as "table",
       policyname as "rule",
       cmd        as "applies to",
       coalesce(qual, with_check) as "the test it applies"
from pg_policies
where schemaname = 'public'
  and tablename in ('log_days','log_options')
order by tablename, cmd, policyname;


-- And protection must actually be switched on for those tables.
select relname as "table",
       relrowsecurity as "protection on"
from pg_class
where relname in ('log_days','log_options');


-- How many days each person has. You should see your own count
-- and Sandra's as separate rows — separate logs, same table.
select p.display_name, count(l.*) as days
from profiles p
left join log_days l on l.created_by = p.id
group by p.display_name
order by days desc;
