-- ============================================================
-- Contacts database - Step 8: maiden and previous names
-- Paste into the Supabase SQL Editor and Run.
-- ============================================================

-- A list, not a single field: people can go through several names,
-- and sometimes back to one they had before.
alter table contacts
  add column former_names jsonb not null default '[]'::jsonb;
