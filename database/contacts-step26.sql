-- ============================================================
-- Contacts database - Step 26: place names for the away pins
-- Safe to run more than once.
-- ============================================================

-- Coordinates on their own tell you nothing. When a pin is dropped,
-- the nearest place name is looked up and kept here.
alter table log_days
  add column if not exists barry_place  text,
  add column if not exists sandra_place text;
