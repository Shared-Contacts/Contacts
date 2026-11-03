-- ============================================================
-- Contacts database - Step 54: a status on appointments
--
-- What became of an appointment: Completed, Missed, Delayed, On hold
-- or Cancelled. Empty means Booked, which is every appointment until
-- now. The app keeps the list of choices, so there is deliberately no
-- rule here limiting what it can say (a new choice then needs no step).
--
-- Anyone who can see or change the appointment already (its owner and
-- the people in "Who else to remind") sees and changes the status the
-- same way, so no new rules are needed.
--
-- A new column, not a new table, so the backup scripts are unchanged:
-- they already take every column of items.
-- Safe to run more than once.
-- ============================================================

alter table items add column if not exists status text;


-- ---------- Check it took ----------
-- You should see 1 line: status, text.
select column_name::text as "column", data_type::text as "kind"
from information_schema.columns
where table_schema = 'public' and table_name = 'items'
  and column_name = 'status';
