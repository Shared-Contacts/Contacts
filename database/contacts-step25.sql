-- ============================================================
-- Contacts database - Step 25: name the second person in the log
-- Safe to run more than once.
-- ============================================================

-- The log has two "if not aboard" slots. The first is you; this says
-- who the second one is, so it stops showing an email address.
alter table profiles
  add column if not exists partner_contact_id bigint references contacts on delete set null;
