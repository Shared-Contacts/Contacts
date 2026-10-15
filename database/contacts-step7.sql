-- ============================================================
-- Contacts database - Step 7: pin key connections
-- Paste into the Supabase SQL Editor and Run.
-- ============================================================

-- A pinned connection shows at the top of the contact, beside their
-- name, as well as in the Connections list further down.
alter table relationships
  add column pinned boolean not null default false;
