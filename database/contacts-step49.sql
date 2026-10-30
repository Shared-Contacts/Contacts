-- ============================================================
-- Contacts database - Step 49: A partner's name on a contact
--
-- When someone is Married, Partner or Engaged, their partner's
-- name can go on their card, and the name at the top reads
-- "Mary and John Smith" (married) or "Mary Smith and John"
-- (partner or engaged). The list still reads "Smith, Mary".
--
--   contacts.partner_name  the partner's first name, plus their
--                          surname if it is different. Empty for
--                          no partner.
--
-- A new column only, no new table, so the backup scripts need no
-- change: they take every column already. Safe to run more than
-- once.
-- ============================================================


alter table contacts add column if not exists partner_name text;

comment on column contacts.partner_name is
  'The partner''s name, shown with theirs at the top of the card when Married, Partner or Engaged.';


-- ---------- Check it took ----------
-- You should see 1 line: contacts partner_name text.
select table_name::text as "what", column_name::text as "name", data_type::text as "kind"
from information_schema.columns
where table_schema = 'public'
  and table_name = 'contacts' and column_name = 'partner_name';
