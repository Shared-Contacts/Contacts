-- ============================================================
-- Contacts database - Step 10: choose tile connections separately
-- Paste into the Supabase SQL Editor and Run.
-- ============================================================

-- "pinned"  shows the connection at the top of the contact's own page.
-- "on_tile" shows it on their line in the main list. Set by hand only,
-- so the list stays short.
alter table relationships
  add column on_tile boolean not null default false;
