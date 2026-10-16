-- ============================================================
-- Contacts database - Step 38: away from home
--
-- A holiday, a work trip or a stay in hospital is an appointment
-- that runs for days. This lets an appointment say it is time away
-- from home, and why, so the month calendar can shade every one of
-- those days in a colour for the reason.
--
-- Adds one column. Nothing is removed or renamed.
-- Safe to run more than once.
-- ============================================================


alter table items add column if not exists away text
  check (away in ('holiday','work','hospital','visiting','other'));

comment on column items.away is
  'Set on an appointment that is time away from home: holiday, work, '
  'hospital, visiting or other. Empty for an ordinary appointment.';
