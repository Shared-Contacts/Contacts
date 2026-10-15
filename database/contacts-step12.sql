-- ============================================================
-- Contacts database - Step 12: know which contact is you
-- Paste into the Supabase SQL Editor and Run.
-- ============================================================

-- So a new diary entry can default to your own name, and so
-- "about which contact" starts somewhere sensible.
alter table profiles
  add column my_contact_id bigint references contacts on delete set null;
