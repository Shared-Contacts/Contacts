-- ============================================================
-- Contacts database - Step 20: your own order for the groups
-- Safe to run more than once.
-- ============================================================

-- Shared groups are read-only to everyone, which stopped the order
-- being changed. The order is now a personal preference instead, so
-- you and Sandra can each have your own without touching the group.
alter table profiles
  add column if not exists group_order jsonb;
