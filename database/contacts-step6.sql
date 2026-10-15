-- ============================================================
-- Contacts database - Step 6: fuller addresses
-- Paste into the Supabase SQL Editor and Run.
-- ============================================================

alter table contacts
  add column address_2 text,
  add column county    text;

-- Your existing "address" becomes line 1. Nothing is lost.
