-- ============================================================
-- Contacts database - Step 40: locking the finance_migrations table
--
-- Step 36 made a small table, finance_migrations, that notes which
-- one-off jobs have already run so they never run twice. It was
-- made without its lock (Row Level Security) switched on, so anyone
-- with the app's web address could read it, add to it or empty it.
-- Supabase's security check emailed about it on 17 Oct 2026.
--
-- This switches the lock on and gives nobody any rules, so the app
-- and the outside world cannot touch it at all. The app never uses
-- this table; only the step files do, and they run here in the SQL
-- Editor, which the lock does not apply to. Nothing else changes.
-- Safe to run more than once.
-- ============================================================


alter table finance_migrations enable row level security;


-- ---------- Check it took ----------
-- You should see one line saying finance_migrations, locked: true.
-- The second list shows any other table still unlocked. It should
-- come back empty ("Success. No rows returned").
select tablename as "table", rowsecurity as "locked"
from pg_tables
where schemaname = 'public' and tablename = 'finance_migrations';

select tablename as "still unlocked"
from pg_tables
where schemaname = 'public' and not rowsecurity
order by tablename;
